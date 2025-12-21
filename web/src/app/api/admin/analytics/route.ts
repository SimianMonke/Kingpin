import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/auth';

// =============================================================================
// GET /api/admin/analytics
// Returns comprehensive analytics data for the admin dashboard
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '30d'; // 7d, 30d, 90d

  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [
    userGrowth,
    platformBreakdown,
    economyHealth,
    featureUsage,
    gamblingStats,
    topGamblers,
  ] = await Promise.all([
    getUserGrowthData(startDate, days),
    getPlatformBreakdown(),
    getEconomyHealth(startDate),
    getFeatureUsage(startDate),
    getGamblingStats(startDate),
    getTopGamblers(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      range,
      userGrowth,
      platformBreakdown,
      economyHealth,
      featureUsage,
      gamblingStats,
      topGamblers,
      generatedAt: new Date().toISOString(),
    },
  });
});

// =============================================================================
// User Growth Data
// =============================================================================

async function getUserGrowthData(startDate: Date, days: number) {
  // Get daily registration counts
  const registrations = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // Get daily active users
  const activeUsers = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT DATE(last_seen) as date, COUNT(*) as count
    FROM users
    WHERE last_seen >= ${startDate}
    GROUP BY DATE(last_seen)
    ORDER BY date ASC
  `;

  // Fill in missing dates
  const dailyData: Array<{
    date: string;
    newUsers: number;
    activeUsers: number;
  }> = [];

  const regMap = new Map(registrations.map(r => [r.date.toISOString().split('T')[0], Number(r.count)]));
  const activeMap = new Map(activeUsers.map(a => [a.date.toISOString().split('T')[0], Number(a.count)]));

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    dailyData.push({
      date: dateStr,
      newUsers: regMap.get(dateStr) || 0,
      activeUsers: activeMap.get(dateStr) || 0,
    });
  }

  // Get totals
  const totalUsers = await prisma.users.count();
  const totalNewInRange = await prisma.users.count({
    where: { created_at: { gte: startDate } },
  });
  const averageDaily = Math.round(totalNewInRange / days);

  return {
    daily: dailyData,
    totals: {
      totalUsers,
      newInRange: totalNewInRange,
      averageDailyNew: averageDaily,
    },
  };
}

// =============================================================================
// Platform Breakdown
// =============================================================================

async function getPlatformBreakdown() {
  const [kickCount, twitchCount, discordCount, totalUsers] = await Promise.all([
    prisma.users.count({ where: { kick_user_id: { not: null } } }),
    prisma.users.count({ where: { twitch_user_id: { not: null } } }),
    prisma.users.count({ where: { discord_user_id: { not: null } } }),
    prisma.users.count(),
  ]);

  // Count users with multiple platforms linked
  const multiPlatform = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM users
    WHERE (
      (kick_user_id IS NOT NULL)::int +
      (twitch_user_id IS NOT NULL)::int +
      (discord_user_id IS NOT NULL)::int
    ) > 1
  `;

  return {
    kick: {
      count: kickCount,
      percentage: totalUsers > 0 ? Math.round((kickCount / totalUsers) * 100) : 0,
    },
    twitch: {
      count: twitchCount,
      percentage: totalUsers > 0 ? Math.round((twitchCount / totalUsers) * 100) : 0,
    },
    discord: {
      count: discordCount,
      percentage: totalUsers > 0 ? Math.round((discordCount / totalUsers) * 100) : 0,
    },
    multiPlatform: Number(multiPlatform[0]?.count || 0),
    total: totalUsers,
  };
}

// =============================================================================
// Economy Health
// =============================================================================

async function getEconomyHealth(startDate: Date) {
  // Current totals
  const wealthStats = await prisma.users.aggregate({
    _sum: { wealth: true },
    _avg: { wealth: true },
    _max: { wealth: true },
    _min: { wealth: true },
  });

  // Wealth distribution by tier
  const tierDistribution = await prisma.$queryRaw<Array<{ status_tier: string; count: bigint; total_wealth: bigint }>>`
    SELECT status_tier, COUNT(*) as count, SUM(wealth) as total_wealth
    FROM users
    GROUP BY status_tier
    ORDER BY total_wealth DESC
  `;

  // Calculate Gini coefficient for wealth inequality
  const giniData = await prisma.$queryRaw<[{ gini: number }]>`
    WITH ranked AS (
      SELECT wealth, ROW_NUMBER() OVER (ORDER BY wealth) as rank
      FROM users
      WHERE wealth > 0
    ),
    stats AS (
      SELECT COUNT(*) as n, SUM(wealth) as total_wealth
      FROM users
      WHERE wealth > 0
    )
    SELECT CASE
      WHEN (SELECT total_wealth FROM stats) = 0 THEN 0
      ELSE (
        2.0 * SUM(ranked.rank * ranked.wealth) /
        ((SELECT n FROM stats) * (SELECT total_wealth FROM stats)) -
        ((SELECT n FROM stats) + 1.0) / (SELECT n FROM stats)
      )
    END as gini
    FROM ranked
  `;

  // Wealth flow (from game_events)
  const wealthFlow = await prisma.$queryRaw<[{
    total_gained: bigint | null;
    total_lost: bigint | null;
  }]>`
    SELECT
      SUM(CASE WHEN wealth_change > 0 THEN wealth_change ELSE 0 END) as total_gained,
      SUM(CASE WHEN wealth_change < 0 THEN ABS(wealth_change) ELSE 0 END) as total_lost
    FROM game_events
    WHERE created_at >= ${startDate}
  `;

  // Top wealth holders (top 10 have what % of total)
  const top10Wealth = await prisma.users.aggregate({
    _sum: { wealth: true },
    orderBy: { wealth: 'desc' },
    take: 10,
  });

  const totalWealth = wealthStats._sum.wealth || BigInt(0);
  const top10Total = top10Wealth._sum.wealth || BigInt(0);
  const top10Percentage = totalWealth > 0
    ? Number((top10Total * BigInt(100)) / totalWealth)
    : 0;

  return {
    totals: {
      totalWealth: totalWealth.toString(),
      averageWealth: Math.round(Number(wealthStats._avg.wealth || 0)),
      maxWealth: (wealthStats._max.wealth || BigInt(0)).toString(),
      minWealth: (wealthStats._min.wealth || BigInt(0)).toString(),
    },
    distribution: tierDistribution.map(t => ({
      tier: t.status_tier,
      count: Number(t.count),
      totalWealth: t.total_wealth.toString(),
    })),
    inequality: {
      giniCoefficient: Number(giniData[0]?.gini || 0).toFixed(3),
      top10Percentage,
    },
    flow: {
      totalGained: (wealthFlow[0]?.total_gained || BigInt(0)).toString(),
      totalLost: (wealthFlow[0]?.total_lost || BigInt(0)).toString(),
      netFlow: (
        (wealthFlow[0]?.total_gained || BigInt(0)) -
        (wealthFlow[0]?.total_lost || BigInt(0))
      ).toString(),
    },
  };
}

// =============================================================================
// Feature Usage
// =============================================================================

async function getFeatureUsage(startDate: Date) {
  // Count events by type
  const eventCounts = await prisma.game_events.groupBy({
    by: ['event_type'],
    _count: { id: true },
    where: { created_at: { gte: startDate } },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  // Mission completions
  const missionCompletions = await prisma.mission_completions.count({
    where: { completed_at: { gte: startDate } },
  });

  // Crate opens
  const crateOpens = await prisma.crate_opens.count({
    where: { opened_at: { gte: startDate } },
  });

  // Heist participation
  const heistWins = await prisma.heist_events.count({
    where: {
      created_at: { gte: startDate },
      winner_user_id: { not: null },
    },
  });

  // Check-ins
  const checkIns = await prisma.game_events.count({
    where: {
      event_type: 'checkin',
      created_at: { gte: startDate },
    },
  });

  // Robbery attempts
  const robberyAttempts = await prisma.game_events.count({
    where: {
      event_type: { in: ['rob_success', 'rob_fail'] },
      created_at: { gte: startDate },
    },
  });

  return {
    eventBreakdown: eventCounts.map(e => ({
      type: e.event_type,
      count: e._count.id,
    })),
    highlights: {
      missionCompletions,
      crateOpens,
      heistWins,
      checkIns,
      robberyAttempts,
    },
  };
}

// =============================================================================
// Gambling Stats
// =============================================================================

async function getGamblingStats(startDate: Date) {
  // Aggregate by game type
  const gameStats = await prisma.gambling_sessions.groupBy({
    by: ['game_type'],
    _count: { session_id: true },
    _sum: { wager_amount: true, payout: true },
    where: { created_at: { gte: startDate } },
  });

  // Win rates by game type
  const winRates = await prisma.$queryRaw<Array<{
    game_type: string;
    total: bigint;
    wins: bigint;
  }>>`
    SELECT
      game_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE result = 'win') as wins
    FROM gambling_sessions
    WHERE created_at >= ${startDate}
    GROUP BY game_type
  `;

  // Current jackpot
  const jackpot = await prisma.slot_jackpots.findFirst();

  // Active lottery
  const activeLottery = await prisma.lottery_draws.findFirst({
    where: { status: 'open' },
    include: { _count: { select: { lottery_tickets: true } } },
  });

  return {
    byGame: gameStats.map(g => ({
      gameType: g.game_type,
      sessions: g._count.session_id,
      totalWagered: (g._sum.wager_amount || BigInt(0)).toString(),
      totalPayout: (g._sum.payout || BigInt(0)).toString(),
      houseEdge: calculateHouseEdge(g._sum.wager_amount, g._sum.payout),
    })),
    winRates: winRates.map(w => ({
      gameType: w.game_type,
      winRate: w.total > 0 ? Number((w.wins * BigInt(100)) / w.total) : 0,
    })),
    jackpot: {
      currentPool: (jackpot?.current_pool || BigInt(10000)).toString(),
      lastWinAmount: (jackpot?.last_win_amount || BigInt(0)).toString(),
      lastWonAt: jackpot?.last_won_at?.toISOString() || null,
    },
    lottery: activeLottery ? {
      drawId: activeLottery.draw_id,
      prizePool: (activeLottery.prize_pool || BigInt(0)).toString(),
      ticketCount: activeLottery._count.lottery_tickets,
      drawAt: activeLottery.draw_at.toISOString(),
    } : null,
  };
}

function calculateHouseEdge(wagered: bigint | null, payout: bigint | null): string {
  if (!wagered || wagered === BigInt(0)) return '0.00';
  const edge = Number(wagered - (payout || BigInt(0))) / Number(wagered) * 100;
  return edge.toFixed(2);
}

// =============================================================================
// Top Gamblers
// =============================================================================

async function getTopGamblers() {
  const topByWagered = await prisma.player_gambling_stats.findMany({
    take: 10,
    orderBy: { total_wagered: 'desc' },
    include: {
      users: {
        select: { username: true, display_name: true },
      },
    },
  });

  const topByProfit = await prisma.player_gambling_stats.findMany({
    take: 10,
    orderBy: { net_profit: 'desc' },
    where: { net_profit: { gt: 0 } },
    include: {
      users: {
        select: { username: true, display_name: true },
      },
    },
  });

  return {
    byVolume: topByWagered.map(p => ({
      username: p.users.username,
      displayName: p.users.display_name,
      totalWagered: (p.total_wagered || BigInt(0)).toString(),
      netProfit: (p.net_profit || BigInt(0)).toString(),
    })),
    byProfit: topByProfit.map(p => ({
      username: p.users.username,
      displayName: p.users.display_name,
      netProfit: (p.net_profit || BigInt(0)).toString(),
      totalWagered: (p.total_wagered || BigInt(0)).toString(),
    })),
  };
}
