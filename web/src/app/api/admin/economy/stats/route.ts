import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';

// =============================================================================
// GET /api/admin/economy/stats - Get economy statistics
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context) => {
  try {
    // Run all queries in parallel for performance
    const [
      wealthStats,
      jackpotData,
      lotteryData,
      wealthDistribution,
      recentTransactions,
      gamblingStats,
    ] = await Promise.all([
      // Total wealth and XP across all users
      prisma.users.aggregate({
        _sum: { wealth: true, xp: true },
        _avg: { wealth: true },
        _count: true,
      }),

      // Current jackpot pool
      prisma.slot_jackpots.findFirst({
        orderBy: { jackpot_id: 'desc' },
      }),

      // Active lottery draw
      prisma.lottery_draws.findFirst({
        where: { status: 'open' },
        include: {
          _count: { select: { lottery_tickets: true } },
        },
        orderBy: { draw_at: 'asc' },
      }),

      // Wealth distribution by tiers (rough percentiles)
      getWealthDistribution(),

      // Recent wealth transactions (last 24h)
      getRecentWealthFlow(),

      // Gambling stats (last 24h)
      getGamblingStats24h(),
    ]);

    // Calculate wealth change in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const wealthChange24h = await prisma.game_events.aggregate({
      where: {
        created_at: { gte: twentyFourHoursAgo },
        wealth_change: { not: 0 },
      },
      _sum: { wealth_change: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalWealth: wealthStats._sum.wealth?.toString() || '0',
          totalXp: wealthStats._sum.xp?.toString() || '0',
          avgWealth: Math.round(Number(wealthStats._avg.wealth) || 0),
          totalPlayers: wealthStats._count,
          wealthChange24h: wealthChange24h._sum.wealth_change?.toString() || '0',
        },
        jackpot: jackpotData ? {
          currentPool: jackpotData.current_pool?.toString() || '0',
          lastWinnerId: jackpotData.last_winner_id,
          lastWinAmount: jackpotData.last_win_amount?.toString() || '0',
          lastWonAt: jackpotData.last_won_at?.toISOString() || null,
          contributionRate: jackpotData.contribution_rate?.toString() || '0.02',
        } : null,
        lottery: lotteryData ? {
          drawId: lotteryData.draw_id,
          drawType: lotteryData.draw_type,
          prizePool: lotteryData.prize_pool?.toString() || '0',
          status: lotteryData.status,
          drawAt: lotteryData.draw_at.toISOString(),
          ticketCount: lotteryData._count.lottery_tickets,
        } : null,
        distribution: wealthDistribution,
        recentFlow: recentTransactions,
        gambling24h: gamblingStats,
      },
    });
  } catch (error) {
    console.error('Economy stats error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch economy stats' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_economy' });

// =============================================================================
// Helper Functions
// =============================================================================

async function getWealthDistribution(): Promise<{
  ranges: Array<{ label: string; count: number; totalWealth: string }>;
}> {
  // Get wealth distribution in ranges
  const ranges = [
    { min: 0, max: 1000, label: '$0 - $1K' },
    { min: 1000, max: 10000, label: '$1K - $10K' },
    { min: 10000, max: 100000, label: '$10K - $100K' },
    { min: 100000, max: 1000000, label: '$100K - $1M' },
    { min: 1000000, max: 10000000, label: '$1M - $10M' },
    { min: 10000000, max: null, label: '$10M+' },
  ];

  const distribution = await Promise.all(
    ranges.map(async (range) => {
      const where: Record<string, unknown> = {
        wealth: { gte: range.min },
      };
      if (range.max !== null) {
        where.wealth = { ...where.wealth as object, lt: range.max };
      }

      const result = await prisma.users.aggregate({
        where,
        _count: true,
        _sum: { wealth: true },
      });

      return {
        label: range.label,
        count: result._count,
        totalWealth: result._sum.wealth?.toString() || '0',
      };
    })
  );

  return { ranges: distribution };
}

async function getRecentWealthFlow(): Promise<{
  sources: Record<string, { amount: string; count: number }>;
  sinks: Record<string, { amount: string; count: number }>;
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get wealth sources (positive changes)
  const sources = await prisma.game_events.groupBy({
    by: ['event_type'],
    where: {
      created_at: { gte: twentyFourHoursAgo },
      wealth_change: { gt: 0 },
    },
    _sum: { wealth_change: true },
    _count: true,
    orderBy: { _sum: { wealth_change: 'desc' } },
    take: 10,
  });

  // Get wealth sinks (negative changes)
  const sinks = await prisma.game_events.groupBy({
    by: ['event_type'],
    where: {
      created_at: { gte: twentyFourHoursAgo },
      wealth_change: { lt: 0 },
    },
    _sum: { wealth_change: true },
    _count: true,
    orderBy: { _sum: { wealth_change: 'asc' } },
    take: 10,
  });

  return {
    sources: Object.fromEntries(
      sources.map(s => [s.event_type, {
        amount: s._sum.wealth_change?.toString() || '0',
        count: s._count,
      }])
    ),
    sinks: Object.fromEntries(
      sinks.map(s => [s.event_type, {
        amount: s._sum.wealth_change?.toString() || '0',
        count: s._count,
      }])
    ),
  };
}

async function getGamblingStats24h(): Promise<{
  totalWagered: string;
  totalPaid: string;
  netHouseProfit: string;
  gamesPlayed: number;
  byGame: Record<string, { wagered: string; paid: string; count: number }>;
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totals, byGame] = await Promise.all([
    // Total stats
    prisma.gambling_sessions.aggregate({
      where: { created_at: { gte: twentyFourHoursAgo } },
      _sum: { wager_amount: true, payout: true },
      _count: true,
    }),

    // By game type
    prisma.gambling_sessions.groupBy({
      by: ['game_type'],
      where: { created_at: { gte: twentyFourHoursAgo } },
      _sum: { wager_amount: true, payout: true },
      _count: true,
    }),
  ]);

  const totalWagered = BigInt(totals._sum.wager_amount || 0);
  const totalPaid = BigInt(totals._sum.payout || 0);

  return {
    totalWagered: totalWagered.toString(),
    totalPaid: totalPaid.toString(),
    netHouseProfit: (totalWagered - totalPaid).toString(),
    gamesPlayed: totals._count,
    byGame: Object.fromEntries(
      byGame.map(g => [g.game_type, {
        wagered: g._sum.wager_amount?.toString() || '0',
        paid: g._sum.payout?.toString() || '0',
        count: g._count,
      }])
    ),
  };
}
