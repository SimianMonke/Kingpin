import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';
import { GamblingService } from '@/lib/services/gambling.service';

// =============================================================================
// GET /api/admin/economy/lottery - Get lottery status
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context) => {
  try {
    // Get all active lottery draws
    const activeDraws = await prisma.lottery_draws.findMany({
      where: { status: 'open' },
      include: {
        _count: { select: { lottery_tickets: true } },
      },
      orderBy: { draw_at: 'asc' },
    });

    // Get recent completed draws
    const recentDraws = await prisma.lottery_draws.findMany({
      where: { status: { in: ['completed', 'no_winner'] } },
      orderBy: { completed_at: 'desc' },
      take: 10,
    });

    // Get ticket stats
    const ticketStats = await prisma.lottery_tickets.aggregate({
      where: {
        lottery_draws: { status: 'open' },
      },
      _count: true,
      _sum: { cost: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        activeDraws: activeDraws.map(d => ({
          drawId: d.draw_id,
          drawType: d.draw_type,
          prizePool: d.prize_pool?.toString() || '0',
          status: d.status,
          drawAt: d.draw_at.toISOString(),
          ticketCount: d._count.lottery_tickets,
          createdAt: d.created_at?.toISOString(),
        })),
        recentDraws: recentDraws.map(d => ({
          drawId: d.draw_id,
          drawType: d.draw_type,
          prizePool: d.prize_pool?.toString() || '0',
          winningNumbers: d.winning_numbers,
          winnerId: d.winner_id,
          winnerPayout: d.winner_payout?.toString() || '0',
          status: d.status,
          drawAt: d.draw_at.toISOString(),
          completedAt: d.completed_at?.toISOString(),
        })),
        stats: {
          activeTickets: ticketStats._count,
          totalPoolValue: ticketStats._sum.cost?.toString() || '0',
        },
      },
    });
  } catch (error) {
    console.error('Lottery fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch lottery status' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_economy' });

// =============================================================================
// POST /api/admin/economy/lottery - Force a lottery draw
// =============================================================================

interface ForceDrawPayload {
  drawId: number;
  reason: string;
}

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: ForceDrawPayload = await req.json();
    const { drawId, reason } = body;

    if (!drawId || !reason || reason.length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'drawId and reason (min 5 chars) are required' } },
        { status: 400 }
      );
    }

    // Get draw info before execution
    const draw = await prisma.lottery_draws.findUnique({
      where: { draw_id: drawId },
      include: {
        _count: { select: { lottery_tickets: true } },
      },
    });

    if (!draw) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lottery draw not found' } },
        { status: 404 }
      );
    }

    if (draw.status !== 'open') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: `Draw is already ${draw.status}` } },
        { status: 400 }
      );
    }

    // Execute the draw
    const result = await GamblingService.executeLotteryDraw(drawId);

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.LOTTERY_FORCE_DRAW,
      category: 'economy',
      targetType: 'lottery',
      targetId: drawId.toString(),
      oldValue: {
        status: 'open',
        prizePool: draw.prize_pool?.toString(),
        ticketCount: draw._count.lottery_tickets,
        scheduledAt: draw.draw_at.toISOString(),
      },
      newValue: {
        status: 'completed',
        winningNumbers: result.winning_numbers,
        jackpotWinner: result.jackpotWinner,
        partialWinners: result.partialWinners.length,
        forcedAt: new Date().toISOString(),
      },
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        drawId,
        winningNumbers: result.winning_numbers,
        jackpotWinner: result.jackpotWinner ? {
          userId: result.jackpotWinner.user_id,
          payout: draw.prize_pool?.toString() || '0',
        } : null,
        partialWinners: result.partialWinners.map((w: { user_id: number; matches: number; payout: bigint }) => ({
          userId: w.user_id,
          matches: w.matches,
          payout: w.payout.toString(),
        })),
        forcedBy: context.admin.username,
        reason,
      },
    });
  } catch (error) {
    console.error('Force lottery draw error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to execute draw' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
