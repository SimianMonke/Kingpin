import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminContext } from '@/lib/admin/auth';
import { getRecentAdminActions } from '@/lib/admin/audit';

/**
 * GET /api/admin/dashboard
 * Get dashboard statistics and overview data
 */
export const GET = withAdminAuth(async (_req: Request, _context: AdminContext) => {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Run all queries in parallel
    const [
      totalUsers,
      activeUsers24h,
      newUsersToday,
      bannedUsers,
      wealthStats,
      xpStats,
      streamingSession,
      recentActions,
      topWealthUsers,
      recentGameEvents,
    ] = await Promise.all([
      // Total users
      prisma.users.count(),

      // Active in last 24 hours
      prisma.users.count({
        where: { last_seen: { gte: yesterday } },
      }),

      // New users today
      prisma.users.count({
        where: { created_at: { gte: todayStart } },
      }),

      // Active bans
      prisma.player_bans.count({
        where: {
          is_active: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: now } },
          ],
        },
      }),

      // Total wealth in circulation
      prisma.users.aggregate({
        _sum: { wealth: true },
        _avg: { wealth: true },
      }),

      // Total XP
      prisma.users.aggregate({
        _sum: { xp: true },
      }),

      // Current streaming session
      prisma.streaming_sessions.findFirst({
        where: { is_active: true },
        include: {
          users: {
            select: { id: true, username: true, display_name: true },
          },
        },
        orderBy: { started_at: 'desc' },
      }),

      // Recent admin actions
      getRecentAdminActions(10),

      // Top 5 wealthiest users
      prisma.users.findMany({
        select: {
          id: true,
          username: true,
          display_name: true,
          wealth: true,
          level: true,
          status_tier: true,
        },
        orderBy: { wealth: 'desc' },
        take: 5,
      }),

      // Recent game events
      prisma.game_events.findMany({
        include: {
          users_game_events_user_idTousers: {
            select: { username: true },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate wealth change in last 24h (from leaderboard snapshots if available)
    let wealthChange24h = BigInt(0);
    try {
      const yesterdaySnapshots = await prisma.leaderboard_snapshots.aggregate({
        where: {
          period_type: 'daily',
          period_start: { gte: yesterday },
        },
        _sum: { wealth_earned: true },
      });
      wealthChange24h = yesterdaySnapshots._sum.wealth_earned || BigInt(0);
    } catch {
      // Snapshots may not exist yet
    }

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active24h: activeUsers24h,
          newToday: newUsersToday,
          banned: bannedUsers,
        },
        economy: {
          totalWealth: (wealthStats._sum.wealth || BigInt(0)).toString(),
          avgWealth: Math.round(Number(wealthStats._avg.wealth || 0)),
          totalXp: (xpStats._sum.xp || BigInt(0)).toString(),
          wealthChange24h: wealthChange24h.toString(),
        },
        streaming: streamingSession ? {
          isLive: true,
          sessionId: streamingSession.id,
          platform: streamingSession.platform,
          startedAt: streamingSession.started_at,
          currentJuicernaut: streamingSession.users ? {
            id: streamingSession.users.id,
            username: streamingSession.users.username,
            displayName: streamingSession.users.display_name,
          } : null,
          totalContributions: streamingSession.total_contributions_usd?.toString() || '0',
        } : {
          isLive: false,
          sessionId: null,
          currentJuicernaut: null,
        },
        topPlayers: topWealthUsers.map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.display_name,
          wealth: u.wealth?.toString() || '0',
          level: u.level,
          tier: u.status_tier,
        })),
        recentActions: recentActions.map(a => ({
          id: a.id,
          adminName: a.admin_name,
          action: a.action,
          category: a.category,
          targetName: a.target_name,
          createdAt: a.created_at,
        })),
        recentEvents: recentGameEvents.map(e => ({
          id: e.id,
          username: e.users_game_events_user_idTousers?.username || 'Unknown',
          eventType: e.event_type,
          wealthChange: e.wealth_change?.toString() || '0',
          success: e.success,
          createdAt: e.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard' } },
      { status: 500 }
    );
  }
});
