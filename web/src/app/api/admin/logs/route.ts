import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminContext, canPerform } from '@/lib/admin/auth';
import { queryAuditLogs, AuditCategory } from '@/lib/admin/audit';

/**
 * GET /api/admin/logs
 * Query audit logs with filtering and pagination
 *
 * Query params:
 * - admin_id: Filter by admin user ID
 * - category: Filter by category (player, setting, economy, content, system)
 * - action: Filter by action (partial match)
 * - target_type: Filter by target type
 * - target_id: Filter by target ID
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export const GET = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  try {
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const adminIdParam = searchParams.get('admin_id');
    const category = searchParams.get('category') as AuditCategory | null;
    const action = searchParams.get('action');
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    // Moderators can only view their own logs unless they have view_all_logs permission
    let adminId: number | undefined;
    if (adminIdParam) {
      adminId = parseInt(adminIdParam);
    }

    // If moderator without view_all_logs permission, force filter to own logs
    if (!canPerform(context.admin, 'view_all_logs') && !adminId) {
      adminId = context.admin.userId;
    }

    // Query logs
    const result = await queryAuditLogs({
      adminId,
      category: category || undefined,
      action: action || undefined,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.logs.map(log => ({
        id: log.id,
        adminId: log.admin_id,
        adminName: log.admin_name,
        action: log.action,
        category: log.category,
        targetType: log.target_type,
        targetId: log.target_id,
        targetName: log.target_name,
        oldValue: log.old_value,
        newValue: log.new_value,
        ipAddress: log.ip_address,
        reason: log.reason,
        createdAt: log.created_at,
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' } },
      { status: 500 }
    );
  }
});
