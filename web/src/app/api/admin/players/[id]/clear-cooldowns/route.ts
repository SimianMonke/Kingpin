import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminContext, requirePermission } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

/**
 * POST /api/admin/players/[id]/clear-cooldowns
 * Clear all cooldowns for a player (including jail)
 */
export const POST = withAdminAuth(async (req: NextRequest, context: AdminContext) => {
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
    requirePermission(context.admin, 'clear_player_cooldowns');

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

    // Get current cooldowns before clearing
    const cooldowns = await prisma.cooldowns.findMany({
      where: {
        user_id: playerId,
        expires_at: { gt: new Date() },
      },
    });

    // Delete all active cooldowns
    const deleted = await prisma.cooldowns.deleteMany({
      where: {
        user_id: playerId,
        expires_at: { gt: new Date() },
      },
    });

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.PLAYER_CLEAR_COOLDOWNS,
      category: 'player',
      targetType: 'user',
      targetId: playerId.toString(),
      targetName: player.username,
      oldValue: {
        cooldownCount: cooldowns.length,
        cooldowns: cooldowns.map(c => ({
          type: c.command_type,
          expiresAt: c.expires_at,
        })),
      },
      reason: reason || 'No reason provided',
    });

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        username: player.username,
        cooldownsCleared: deleted.count,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 }
      );
    }

    console.error('Clear cooldowns error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to clear cooldowns' } },
      { status: 500 }
    );
  }
});
