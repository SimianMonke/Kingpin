import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

// =============================================================================
// GET /api/admin/content/heists/riddles - List all riddles
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

    const [riddles, total] = await Promise.all([
      prisma.heist_riddle_pool.findMany({
        where,
        orderBy: { riddle_id: 'desc' },
        skip,
        take: limit,
      }),
      prisma.heist_riddle_pool.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: riddles.map(r => ({
          id: r.riddle_id,
          riddle: r.riddle,
          answer: r.answer,
          alternateAnswers: r.alternate_answers?.split(',').filter(Boolean) || [],
          timesUsed: r.times_used,
          lastUsedAt: r.last_used_at?.toISOString() || null,
          isActive: r.is_active,
          createdAt: r.created_at?.toISOString(),
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
    console.error('Riddles list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch riddles' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_content' });

// =============================================================================
// POST /api/admin/content/heists/riddles - Create new riddle
// =============================================================================

interface CreateRiddlePayload {
  riddle: string;
  answer: string;
  alternateAnswers?: string[];
}

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: CreateRiddlePayload = await req.json();
    const { riddle, answer, alternateAnswers } = body;

    // Validation
    if (!riddle || !answer) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'riddle and answer are required' } },
        { status: 400 }
      );
    }

    if (answer.length > 200) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Answer must be 200 characters or less' } },
        { status: 400 }
      );
    }

    const newRiddle = await prisma.heist_riddle_pool.create({
      data: {
        riddle,
        answer,
        alternate_answers: alternateAnswers?.filter(Boolean).join(',') || null,
        is_active: true,
        times_used: 0,
      },
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_RIDDLE_CREATE,
      category: 'content',
      targetType: 'heist',
      targetId: newRiddle.riddle_id.toString(),
      targetName: 'Riddle',
      newValue: { riddle, answer },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: newRiddle.riddle_id,
        riddle: newRiddle.riddle,
        answer: newRiddle.answer,
        alternateAnswers: newRiddle.alternate_answers?.split(',').filter(Boolean) || [],
        isActive: newRiddle.is_active,
        createdAt: newRiddle.created_at?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Riddle create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create riddle' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });

// =============================================================================
// PATCH /api/admin/content/heists/riddles - Update riddle
// =============================================================================

interface UpdateRiddlePayload {
  id: number;
  riddle?: string;
  answer?: string;
  alternateAnswers?: string[];
  isActive?: boolean;
}

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: UpdateRiddlePayload = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Get current for audit log
    const current = await prisma.heist_riddle_pool.findUnique({
      where: { riddle_id: id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Riddle not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (updates.riddle !== undefined) updateData.riddle = updates.riddle;
    if (updates.answer !== undefined) updateData.answer = updates.answer;
    if (updates.alternateAnswers !== undefined) {
      updateData.alternate_answers = updates.alternateAnswers.filter(Boolean).join(',') || null;
    }
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const updated = await prisma.heist_riddle_pool.update({
      where: { riddle_id: id },
      data: updateData,
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_RIDDLE_UPDATE,
      category: 'content',
      targetType: 'heist',
      targetId: id.toString(),
      targetName: 'Riddle',
      oldValue: { riddle: current.riddle, answer: current.answer, isActive: current.is_active },
      newValue: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.riddle_id,
        riddle: updated.riddle,
        answer: updated.answer,
        alternateAnswers: updated.alternate_answers?.split(',').filter(Boolean) || [],
        isActive: updated.is_active,
      },
    });
  } catch (error) {
    console.error('Riddle update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update riddle' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });

// =============================================================================
// DELETE /api/admin/content/heists/riddles - Delete riddle
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
    const current = await prisma.heist_riddle_pool.findUnique({
      where: { riddle_id: id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Riddle not found' } },
        { status: 404 }
      );
    }

    await prisma.heist_riddle_pool.delete({
      where: { riddle_id: id },
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_RIDDLE_DELETE,
      category: 'content',
      targetType: 'heist',
      targetId: id.toString(),
      targetName: 'Riddle',
      oldValue: { riddle: current.riddle, answer: current.answer },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error('Riddle delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete riddle' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
