import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminContext, requirePermission } from '@/lib/admin/auth';
import { getAllSettings, updateSettings, invalidateSettingsCache } from '@/lib/admin/settings';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/settings
 * Get all settings grouped by category
 */
export const GET = withAdminAuth(async (_req: NextRequest, context: AdminContext) => {
  try {
    // Moderators can view settings but not edit them
    const settings = await getAllSettings();

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' } },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/settings
 * Update multiple settings at once
 * Body: { [key]: value, ... }
 */
export const PATCH = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  try {
    // Only owners can edit settings
    requirePermission(context.admin, 'edit_settings');

    const body = await req.json();
    const { updates, reason } = body;

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No updates provided' } },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldSettings = await prisma.admin_settings.findMany({
      where: { key: { in: Object.keys(updates) } },
    });
    const oldValues: Record<string, unknown> = {};
    for (const s of oldSettings) {
      oldValues[s.key] = s.value;
    }

    // Perform updates
    const result = await updateSettings(updates, context.admin.userId);

    // Create audit log for successful updates
    if (result.updated.length > 0) {
      const changedOldValues: Record<string, unknown> = {};
      const changedNewValues: Record<string, unknown> = {};

      for (const key of result.updated) {
        changedOldValues[key] = oldValues[key];
        changedNewValues[key] = updates[key];
      }

      await createAuditLog(context, {
        action: result.updated.length === 1 ? AUDIT_ACTIONS.SETTING_CHANGE : AUDIT_ACTIONS.SETTING_BULK_CHANGE,
        category: 'setting',
        targetType: 'setting',
        targetId: result.updated.join(','),
        targetName: result.updated.length === 1 ? result.updated[0] : `${result.updated.length} settings`,
        oldValue: changedOldValues,
        newValue: changedNewValues,
        reason,
      });
    }

    // Invalidate cache
    invalidateSettingsCache();

    return NextResponse.json({
      success: true,
      data: {
        updated: result.updated,
        errors: Object.keys(result.errors).length > 0 ? result.errors : undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 }
      );
    }

    console.error('Settings update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
