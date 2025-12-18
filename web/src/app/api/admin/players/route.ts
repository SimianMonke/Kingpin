import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminContext } from '@/lib/admin/auth';

/**
 * GET /api/admin/players
 * Search and list players with pagination
 *
 * Query params:
 * - q: Search query (username, id:123, kick:abc, twitch:abc, discord:123)
 * - page: Page number (default 1)
 * - limit: Results per page (default 20, max 100)
 * - sort: Sort field (default: created_at)
 * - order: Sort order (asc/desc, default: desc)
 */
export const GET = withAdminAuth(async (req: NextRequest, _context: AdminContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const sortField = searchParams.get('sort') || 'created_at';
    const sortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    // Build where clause based on query
    const where = buildSearchWhere(query);

    // Build orderBy
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const allowedSortFields = ['created_at', 'username', 'wealth', 'xp', 'level', 'last_seen'];
    if (allowedSortFields.includes(sortField)) {
      orderBy[sortField] = sortOrder;
    } else {
      orderBy.created_at = 'desc';
    }

    // Execute query
    const [players, total] = await Promise.all([
      prisma.users.findMany({
        where,
        select: {
          id: true,
          username: true,
          display_name: true,
          kingpin_name: true,
          kick_user_id: true,
          twitch_user_id: true,
          discord_user_id: true,
          wealth: true,
          xp: true,
          level: true,
          status_tier: true,
          hp: true,
          faction_id: true,
          created_at: true,
          last_seen: true,
          player_bans: {
            where: {
              is_active: true,
              OR: [
                { expires_at: null },
                { expires_at: { gt: new Date() } },
              ],
            },
            select: { id: true, ban_type: true, expires_at: true },
            take: 1,
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.users.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: players.map(p => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        kingpinName: p.kingpin_name,
        platforms: {
          kick: !!p.kick_user_id,
          twitch: !!p.twitch_user_id,
          discord: !!p.discord_user_id,
        },
        wealth: p.wealth?.toString() || '0',
        xp: p.xp?.toString() || '0',
        level: p.level,
        tier: p.status_tier,
        hp: p.hp,
        factionId: p.faction_id,
        createdAt: p.created_at,
        lastSeen: p.last_seen,
        isBanned: p.player_bans.length > 0,
        banInfo: p.player_bans[0] ? {
          type: p.player_bans[0].ban_type,
          expiresAt: p.player_bans[0].expires_at,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Player search error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to search players' } },
      { status: 500 }
    );
  }
});

/**
 * Build Prisma where clause from search query
 */
function buildSearchWhere(query: string): Record<string, unknown> {
  if (!query.trim()) return {};

  // Handle special prefixes
  if (query.startsWith('id:')) {
    const id = parseInt(query.slice(3));
    if (!isNaN(id)) {
      return { id };
    }
  }

  if (query.startsWith('kick:')) {
    return { kick_user_id: query.slice(5) };
  }

  if (query.startsWith('twitch:')) {
    return { twitch_user_id: query.slice(7) };
  }

  if (query.startsWith('discord:')) {
    return { discord_user_id: query.slice(8) };
  }

  // Check if query is a numeric ID
  const numericId = parseInt(query);
  if (!isNaN(numericId) && query === numericId.toString()) {
    return { id: numericId };
  }

  // Default: search by username (case-insensitive)
  return {
    OR: [
      { username: { contains: query, mode: 'insensitive' } },
      { display_name: { contains: query, mode: 'insensitive' } },
      { kingpin_name: { contains: query, mode: 'insensitive' } },
    ],
  };
}
