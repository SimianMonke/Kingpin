import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

// =============================================================================
// GET /api/admin/content/heists/quickgrab - List all quick-grab phrases
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (activeOnly) where.is_active = true;

    const [phrases, total] = await Promise.all([
      prisma.heist_quick_grab_pool.findMany({
        where,
        orderBy: { grab_id: 'desc' },
        skip,
        take: limit,
      }),
      prisma.heist_quick_grab_pool.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: phrases.map(p => ({
          id: p.grab_id,
          phrase: p.phrase,
          timesUsed: p.times_used,
          lastUsedAt: p.last_used_at?.toISOString() || null,
          isActive: p.is_active,
          createdAt: p.created_at?.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Quick-grab list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch phrases' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_content' });

// =============================================================================
// POST /api/admin/content/heists/quickgrab - Create new phrase
// =============================================================================

interface CreatePhrasePayload {
  phrase: string;
}

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: CreatePhrasePayload = await req.json();
    const { phrase } = body;

    // Validation
    if (!phrase) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'phrase is required' } },
        { status: 400 }
      );
    }

    if (phrase.length > 50) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Phrase must be 50 characters or less' } },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.heist_quick_grab_pool.findUnique({
      where: { phrase },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'This phrase already exists' } },
        { status: 400 }
      );
    }

    const newPhrase = await prisma.heist_quick_grab_pool.create({
      data: {
        phrase,
        is_active: true,
        times_used: 0,
      },
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_QUICKGRAB_CREATE,
      category: 'content',
      targetType: 'heist',
      targetId: newPhrase.grab_id.toString(),
      targetName: `Quick-Grab: ${phrase}`,
      newValue: { phrase },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: newPhrase.grab_id,
        phrase: newPhrase.phrase,
        isActive: newPhrase.is_active,
        createdAt: newPhrase.created_at?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Quick-grab create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create phrase' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });

// =============================================================================
// PATCH /api/admin/content/heists/quickgrab - Update phrase
// =============================================================================

interface UpdatePhrasePayload {
  id: number;
  phrase?: string;
  isActive?: boolean;
}

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: UpdatePhrasePayload = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Get current for audit log
    const current = await prisma.heist_quick_grab_pool.findUnique({
      where: { grab_id: id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Phrase not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (updates.phrase !== undefined) {
      if (updates.phrase.length > 50) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Phrase must be 50 characters or less' } },
          { status: 400 }
        );
      }
      updateData.phrase = updates.phrase;
    }
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const updated = await prisma.heist_quick_grab_pool.update({
      where: { grab_id: id },
      data: updateData,
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_QUICKGRAB_UPDATE,
      category: 'content',
      targetType: 'heist',
      targetId: id.toString(),
      targetName: `Quick-Grab: ${current.phrase}`,
      oldValue: { phrase: current.phrase, isActive: current.is_active },
      newValue: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.grab_id,
        phrase: updated.phrase,
        isActive: updated.is_active,
      },
    });
  } catch (error) {
    console.error('Quick-grab update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update phrase' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });

// =============================================================================
// DELETE /api/admin/content/heists/quickgrab - Delete phrase
// =============================================================================

export const DELETE = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Get current for audit log
    const current = await prisma.heist_quick_grab_pool.findUnique({
      where: { grab_id: id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Phrase not found' } },
        { status: 404 }
      );
    }

    await prisma.heist_quick_grab_pool.delete({
      where: { grab_id: id },
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_QUICKGRAB_DELETE,
      category: 'content',
      targetType: 'heist',
      targetId: id.toString(),
      targetName: `Quick-Grab: ${current.phrase}`,
      oldValue: { phrase: current.phrase },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error('Quick-grab delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete phrase' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
