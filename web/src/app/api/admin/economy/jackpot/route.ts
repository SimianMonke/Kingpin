import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

// =============================================================================
// GET /api/admin/economy/jackpot - Get jackpot status
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const jackpot = await prisma.slot_jackpots.findFirst({
      orderBy: { jackpot_id: 'desc' },
    });

    if (!jackpot) {
      return NextResponse.json({
        success: true,
        data: {
          exists: false,
          currentPool: '10000',
          message: 'No jackpot record found - will use default seed amount',
        },
      });
    }

    // Get recent jackpot history (last 5 winners)
    const recentWins = await prisma.gambling_sessions.findMany({
      where: {
        game_type: 'slots',
        result: 'jackpot',
      },
      include: {
        users: { select: { id: true, username: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        exists: true,
        jackpotId: jackpot.jackpot_id,
        currentPool: jackpot.current_pool?.toString() || '10000',
        contributionRate: jackpot.contribution_rate?.toString() || '0.02',
        lastWinner: jackpot.last_winner_id ? {
          userId: jackpot.last_winner_id,
          amount: jackpot.last_win_amount?.toString() || '0',
          wonAt: jackpot.last_won_at?.toISOString() || null,
        } : null,
        recentWins: recentWins.map(w => ({
          sessionId: w.session_id,
          userId: w.users.id,
          username: w.users.username,
          payout: w.payout?.toString() || '0',
          wonAt: w.created_at?.toISOString(),
        })),
        updatedAt: jackpot.updated_at?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Jackpot fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch jackpot status' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_economy' });

// =============================================================================
// POST /api/admin/economy/jackpot - Reset jackpot to seed amount
// =============================================================================

interface ResetPayload {
  seedAmount?: number;
  reason: string;
}

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: ResetPayload = await req.json();
    const { seedAmount = 10000, reason } = body;

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required (min 5 characters)' } },
        { status: 400 }
      );
    }

    if (seedAmount < 0 || seedAmount > 10000000) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Seed amount must be between 0 and 10,000,000' } },
        { status: 400 }
      );
    }

    // Get current jackpot for audit log
    const currentJackpot = await prisma.slot_jackpots.findFirst({
      orderBy: { jackpot_id: 'desc' },
    });

    const previousPool = currentJackpot?.current_pool?.toString() || '0';

    // Update or create jackpot record
    const updatedJackpot = await prisma.slot_jackpots.upsert({
      where: { jackpot_id: currentJackpot?.jackpot_id || 1 },
      update: {
        current_pool: BigInt(seedAmount),
        updated_at: new Date(),
      },
      create: {
        current_pool: BigInt(seedAmount),
        contribution_rate: 0.02,
        updated_at: new Date(),
      },
    });

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.JACKPOT_RESET,
      category: 'economy',
      targetType: 'jackpot',
      targetId: updatedJackpot.jackpot_id.toString(),
      oldValue: { pool: previousPool },
      newValue: { pool: seedAmount.toString() },
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        jackpotId: updatedJackpot.jackpot_id,
        previousPool,
        newPool: seedAmount.toString(),
        resetBy: context.admin.username,
        reason,
      },
    });
  } catch (error) {
    console.error('Jackpot reset error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset jackpot' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
