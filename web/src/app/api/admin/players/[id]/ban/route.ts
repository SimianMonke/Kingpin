import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminContext, requirePermission } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

/**
 * POST /api/admin/players/[id]/ban
 * Ban a player
 */
export const POST = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 2]; // Get ID before /ban
  const playerId = parseInt(id);

  if (isNaN(playerId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid player ID' } },
      { status: 400 }
    );
  }

  try {
    requirePermission(context.admin, 'ban_player');

    const body = await req.json();
    const { reason, ban_type, duration_hours } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_REASON', message: 'Ban reason is required' } },
        { status: 400 }
      );
    }

    // Get player
    const player = await prisma.users.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Player not found' } },
        { status: 404 }
      );
    }

    // Check if already banned
    const existingBan = await prisma.player_bans.findFirst({
      where: {
        user_id: playerId,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
    });

    if (existingBan) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_BANNED', message: 'Player is already banned' } },
        { status: 400 }
      );
    }

    // Calculate expiration
    const expiresAt = ban_type === 'permanent' || !duration_hours
      ? null
      : new Date(Date.now() + duration_hours * 60 * 60 * 1000);

    // Create ban
    const ban = await prisma.player_bans.create({
      data: {
        user_id: playerId,
        banned_by: context.admin.userId,
        reason: reason.trim(),
        ban_type: ban_type || (duration_hours ? 'temporary' : 'permanent'),
        expires_at: expiresAt,
      },
    });

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.PLAYER_BAN,
      category: 'player',
      targetType: 'user',
      targetId: playerId.toString(),
      targetName: player.username,
      newValue: {
        banId: ban.id,
        banType: ban.ban_type,
        reason: ban.reason,
        expiresAt: ban.expires_at,
      },
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        banId: ban.id,
        playerId: player.id,
        username: player.username,
        banType: ban.ban_type,
        reason: ban.reason,
        expiresAt: ban.expires_at,
        createdAt: ban.created_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 }
      );
    }

    console.error('Ban player error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to ban player' } },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/players/[id]/ban
 * Unban a player
 */
export const DELETE = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 2];
  const playerId = parseInt(id);

  if (isNaN(playerId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid player ID' } },
      { status: 400 }
    );
  }

  try {
    requirePermission(context.admin, 'unban_player');

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    // Get player
    const player = await prisma.users.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Player not found' } },
        { status: 404 }
      );
    }

    // Find active ban
    const activeBan = await prisma.player_bans.findFirst({
      where: {
        user_id: playerId,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
    });

    if (!activeBan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_BANNED', message: 'Player is not banned' } },
        { status: 400 }
      );
    }

    // Deactivate ban
    await prisma.player_bans.update({
      where: { id: activeBan.id },
      data: {
        is_active: false,
        unbanned_by: context.admin.userId,
        unbanned_at: new Date(),
        unban_reason: reason || null,
      },
    });

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.PLAYER_UNBAN,
      category: 'player',
      targetType: 'user',
      targetId: playerId.toString(),
      targetName: player.username,
      oldValue: {
        banId: activeBan.id,
        banType: activeBan.ban_type,
        originalReason: activeBan.reason,
      },
      reason: reason || 'No reason provided',
    });

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        username: player.username,
        unbannedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 }
      );
    }

    console.error('Unban player error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to unban player' } },
      { status: 500 }
    );
  }
});
