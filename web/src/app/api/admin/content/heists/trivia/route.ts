import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

// =============================================================================
// GET /api/admin/content/heists/trivia - List all trivia questions
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (activeOnly) where.is_active = true;

    const [trivia, total, categories] = await Promise.all([
      prisma.heist_trivia_pool.findMany({
        where,
        orderBy: { trivia_id: 'desc' },
        skip,
        take: limit,
      }),
      prisma.heist_trivia_pool.count({ where }),
      prisma.heist_trivia_pool.groupBy({
        by: ['category'],
        _count: true,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: trivia.map(t => ({
          id: t.trivia_id,
          category: t.category,
          question: t.question,
          answer: t.answer,
          alternateAnswers: t.alternate_answers?.split(',').filter(Boolean) || [],
          timesUsed: t.times_used,
          lastUsedAt: t.last_used_at?.toISOString() || null,
          isActive: t.is_active,
          createdAt: t.created_at?.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        categories: categories.map(c => ({
          name: c.category,
          count: c._count,
        })),
      },
    });
  } catch (error) {
    console.error('Trivia list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trivia' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_content' });

// =============================================================================
// POST /api/admin/content/heists/trivia - Create new trivia question
// =============================================================================

interface CreateTriviaPayload {
  category: string;
  question: string;
  answer: string;
  alternateAnswers?: string[];
}

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: CreateTriviaPayload = await req.json();
    const { category, question, answer, alternateAnswers } = body;

    // Validation
    if (!category || !question || !answer) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'category, question, and answer are required' } },
        { status: 400 }
      );
    }

    if (category.length > 50) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Category must be 50 characters or less' } },
        { status: 400 }
      );
    }

    if (answer.length > 200) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Answer must be 200 characters or less' } },
        { status: 400 }
      );
    }

    const trivia = await prisma.heist_trivia_pool.create({
      data: {
        category,
        question,
        answer,
        alternate_answers: alternateAnswers?.filter(Boolean).join(',') || null,
        is_active: true,
        times_used: 0,
      },
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_TRIVIA_CREATE,
      category: 'content',
      targetType: 'heist',
      targetId: trivia.trivia_id.toString(),
      targetName: `Trivia: ${category}`,
      newValue: { category, question, answer },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: trivia.trivia_id,
        category: trivia.category,
        question: trivia.question,
        answer: trivia.answer,
        alternateAnswers: trivia.alternate_answers?.split(',').filter(Boolean) || [],
        isActive: trivia.is_active,
        createdAt: trivia.created_at?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Trivia create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create trivia' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });

// =============================================================================
// PATCH /api/admin/content/heists/trivia - Update trivia question
// =============================================================================

interface UpdateTriviaPayload {
  id: number;
  category?: string;
  question?: string;
  answer?: string;
  alternateAnswers?: string[];
  isActive?: boolean;
}

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: UpdateTriviaPayload = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Get current for audit log
    const current = await prisma.heist_trivia_pool.findUnique({
      where: { trivia_id: id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Trivia not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.question !== undefined) updateData.question = updates.question;
    if (updates.answer !== undefined) updateData.answer = updates.answer;
    if (updates.alternateAnswers !== undefined) {
      updateData.alternate_answers = updates.alternateAnswers.filter(Boolean).join(',') || null;
    }
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const updated = await prisma.heist_trivia_pool.update({
      where: { trivia_id: id },
      data: updateData,
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_TRIVIA_UPDATE,
      category: 'content',
      targetType: 'heist',
      targetId: id.toString(),
      targetName: `Trivia: ${current.category}`,
      oldValue: { category: current.category, question: current.question, answer: current.answer, isActive: current.is_active },
      newValue: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.trivia_id,
        category: updated.category,
        question: updated.question,
        answer: updated.answer,
        alternateAnswers: updated.alternate_answers?.split(',').filter(Boolean) || [],
        isActive: updated.is_active,
      },
    });
  } catch (error) {
    console.error('Trivia update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update trivia' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });

// =============================================================================
// DELETE /api/admin/content/heists/trivia - Delete trivia question
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
    const current = await prisma.heist_trivia_pool.findUnique({
      where: { trivia_id: id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Trivia not found' } },
        { status: 404 }
      );
    }

    await prisma.heist_trivia_pool.delete({
      where: { trivia_id: id },
    });

    // Audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.HEIST_TRIVIA_DELETE,
      category: 'content',
      targetType: 'heist',
      targetId: id.toString(),
      targetName: `Trivia: ${current.category}`,
      oldValue: { category: current.category, question: current.question, answer: current.answer },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error('Trivia delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete trivia' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
