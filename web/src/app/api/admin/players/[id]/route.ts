import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminContext, canPerform, requirePermission } from '@/lib/admin/auth';
import { createAuditLog, extractChangedFields, AUDIT_ACTIONS } from '@/lib/admin/audit';
import { levelFromXp, getTierFromLevel } from '@/lib/game/formulas';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/players/[id]
 * Get detailed player information
 */
export const GET = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  const { id } = await (req as unknown as RouteParams).params;
  const playerId = parseInt(id);

  if (isNaN(playerId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid player ID' } },
      { status: 400 }
    );
  }

  try {
    const player = await prisma.users.findUnique({
      where: { id: playerId },
      include: {
        factions: { select: { id: true, name: true, color_hex: true } },
        player_bans: {
          where: { is_active: true },
          orderBy: { created_at: 'desc' },
          take: 5,
        },
        user_inventory: {
          include: { items: true },
          take: 20,
        },
        user_crates: {
          where: { is_escrowed: false },
        },
        cooldowns: {
          where: { expires_at: { gt: new Date() } },
        },
        active_buffs: {
          where: { is_active: true },
        },
        player_gambling_stats: true,
      },
    });

    if (!player) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Player not found' } },
        { status: 404 }
      );
    }

    // Get recent game events
    const recentEvents = await prisma.game_events.findMany({
      where: { user_id: playerId },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    // Get admin action history for this player
    const adminHistory = await prisma.admin_audit_log.findMany({
      where: {
        target_type: 'user',
        target_id: playerId.toString(),
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: player.id,
        username: player.username,
        displayName: player.display_name,
        kingpinName: player.kingpin_name,
        platforms: {
          kick: player.kick_user_id,
          twitch: player.twitch_user_id,
          discord: player.discord_user_id,
          discordUsername: player.discord_username,
        },
        stats: {
          wealth: player.wealth?.toString() || '0',
          xp: player.xp?.toString() || '0',
          level: player.level,
          tier: player.status_tier,
          hp: player.hp,
          checkinStreak: player.checkin_streak,
          lastCheckin: player.last_checkin_date,
          totalPlayCount: player.total_play_count,
          wins: player.wins,
          losses: player.losses,
        },
        faction: player.factions ? {
          id: player.factions.id,
          name: player.factions.name,
          color: player.factions.color_hex,
          joinedAt: player.joined_faction_at,
        } : null,
        bans: player.player_bans.map(b => ({
          id: b.id,
          type: b.ban_type,
          reason: b.reason,
          expiresAt: b.expires_at,
          createdAt: b.created_at,
        })),
        inventory: player.user_inventory.map(i => ({
          id: i.id,
          itemId: i.item_id,
          itemName: i.items.name,
          itemType: i.items.type,
          itemTier: i.items.tier,
          durability: i.durability,
          isEquipped: i.is_equipped,
          slot: i.slot,
          isEscrowed: i.is_escrowed,
        })),
        crates: player.user_crates.reduce((acc, c) => {
          acc[c.tier] = (acc[c.tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        cooldowns: player.cooldowns.map(c => ({
          type: c.command_type,
          expiresAt: c.expires_at,
        })),
        buffs: player.active_buffs.map(b => ({
          type: b.buff_type,
          multiplier: b.multiplier?.toString(),
          expiresAt: b.expires_at,
          source: b.source,
        })),
        gamblingStats: player.player_gambling_stats ? {
          totalWagered: player.player_gambling_stats.total_wagered?.toString() || '0',
          totalWon: player.player_gambling_stats.total_won?.toString() || '0',
          totalLost: player.player_gambling_stats.total_lost?.toString() || '0',
          netProfit: player.player_gambling_stats.net_profit?.toString() || '0',
          biggestWin: player.player_gambling_stats.biggest_win?.toString() || '0',
          jackpotsHit: player.player_gambling_stats.jackpots_hit,
        } : null,
        recentEvents: recentEvents.map(e => ({
          id: e.id,
          type: e.event_type,
          wealthChange: e.wealth_change?.toString() || '0',
          xpChange: e.xp_change,
          success: e.success,
          createdAt: e.created_at,
        })),
        adminHistory: adminHistory.map(a => ({
          id: a.id,
          adminName: a.admin_name,
          action: a.action,
          reason: a.reason,
          createdAt: a.created_at,
        })),
        createdAt: player.created_at,
        lastSeen: player.last_seen,
      },
    });
  } catch (error) {
    console.error('Player detail error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load player' } },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/players/[id]
 * Edit player stats
 */
export const PATCH = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop();
  const playerId = parseInt(id || '');

  if (isNaN(playerId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid player ID' } },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { wealth, xp, hp, checkin_streak, kingpin_name, faction_id, reason } = body;

    // Get existing player
    const player = await prisma.users.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Player not found' } },
        { status: 404 }
      );
    }

    // Check permissions for each field
    const updateData: Record<string, unknown> = {};

    if (wealth !== undefined) {
      const wealthChange = typeof wealth === 'string' && (wealth.startsWith('+') || wealth.startsWith('-'))
        ? parseInt(wealth)
        : parseInt(wealth) - Number(player.wealth || 0);

      requirePermission(context.admin, 'edit_player_wealth', { amount: Math.abs(wealthChange) });

      if (typeof wealth === 'string' && (wealth.startsWith('+') || wealth.startsWith('-'))) {
        updateData.wealth = BigInt(Number(player.wealth || 0) + parseInt(wealth));
      } else {
        updateData.wealth = BigInt(wealth);
      }

      // Ensure wealth doesn't go negative
      if ((updateData.wealth as bigint) < BigInt(0)) {
        updateData.wealth = BigInt(0);
      }
    }

    if (xp !== undefined) {
      const xpChange = typeof xp === 'string' && (xp.startsWith('+') || xp.startsWith('-'))
        ? parseInt(xp)
        : parseInt(xp) - Number(player.xp || 0);

      requirePermission(context.admin, 'edit_player_xp', { amount: Math.abs(xpChange) });

      if (typeof xp === 'string' && (xp.startsWith('+') || xp.startsWith('-'))) {
        updateData.xp = BigInt(Number(player.xp || 0) + parseInt(xp));
      } else {
        updateData.xp = BigInt(xp);
      }

      // Recalculate level and tier
      const newXp = Number(updateData.xp);
      updateData.level = levelFromXp(newXp);
      updateData.status_tier = getTierFromLevel(updateData.level as number);
    }

    if (hp !== undefined) {
      requirePermission(context.admin, 'edit_player_hp');
      updateData.hp = Math.max(0, Math.min(100, parseInt(hp)));
    }

    if (checkin_streak !== undefined) {
      updateData.checkin_streak = Math.max(0, parseInt(checkin_streak));
    }

    if (kingpin_name !== undefined) {
      updateData.kingpin_name = kingpin_name.slice(0, 100) || null;
    }

    if (faction_id !== undefined) {
      requirePermission(context.admin, 'edit_player_faction');
      updateData.faction_id = faction_id || null;
      if (faction_id) {
        updateData.joined_faction_at = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CHANGES', message: 'No valid changes provided' } },
        { status: 400 }
      );
    }

    // Update player
    const updated = await prisma.users.update({
      where: { id: playerId },
      data: updateData,
    });

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.PLAYER_EDIT,
      category: 'player',
      targetType: 'user',
      targetId: playerId.toString(),
      targetName: player.username,
      oldValue: extractChangedFields(player, updateData),
      newValue: Object.fromEntries(
        Object.entries(updateData).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])
      ),
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        username: updated.username,
        wealth: updated.wealth?.toString() || '0',
        xp: updated.xp?.toString() || '0',
        level: updated.level,
        tier: updated.status_tier,
        hp: updated.hp,
        checkinStreak: updated.checkin_streak,
        kingpinName: updated.kingpin_name,
        factionId: updated.faction_id,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 }
      );
    }

    console.error('Player edit error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update player' } },
      { status: 500 }
    );
  }
});
