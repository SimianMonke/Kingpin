import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, canPerform } from '@/lib/admin/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/admin/audit';

// =============================================================================
// POST /api/admin/economy/adjust - Manual wealth/XP adjustment
// =============================================================================

interface AdjustmentPayload {
  userId: number;
  type: 'wealth' | 'xp';
  amount: number;
  reason: string;
}

export const POST = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const body: AdjustmentPayload = await req.json();
    const { userId, type, amount, reason } = body;

    // Validate required fields
    if (!userId || !type || amount === undefined || !reason) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: userId, type, amount, reason' } },
        { status: 400 }
      );
    }

    // Validate type
    if (!['wealth', 'xp'].includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Type must be "wealth" or "xp"' } },
        { status: 400 }
      );
    }

    // Check permission based on amount
    if (!canPerform(context.admin, 'adjust_economy')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to adjust economy' } },
        { status: 403 }
      );
    }

    // Get current player data
    const player = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, username: true, wealth: true, xp: true },
    });

    if (!player) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Player not found' } },
        { status: 404 }
      );
    }

    // Calculate new value
    const currentValue = type === 'wealth' ? BigInt(player.wealth || 0) : BigInt(player.xp || 0);
    const adjustmentBigInt = BigInt(amount);
    let newValue = currentValue + adjustmentBigInt;

    // Prevent negative values
    if (newValue < BigInt(0)) {
      newValue = BigInt(0);
    }

    // Apply adjustment in transaction
    const [updatedPlayer] = await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: {
          [type]: newValue,
          updated_at: new Date(),
        },
        select: { id: true, username: true, wealth: true, xp: true },
      }),
      // Create game event for tracking
      prisma.game_events.create({
        data: {
          user_id: userId,
          event_type: `admin_${type}_adjustment`,
          wealth_change: type === 'wealth' ? BigInt(amount) : BigInt(0),
          xp_change: type === 'xp' ? amount : 0,
          event_description: `Admin adjustment: ${reason}`,
          success: true,
        },
      }),
    ]);

    // Create audit log
    await createAuditLog(context, {
      action: AUDIT_ACTIONS.ECONOMY_ADJUST,
      category: 'economy',
      targetType: 'user',
      targetId: userId.toString(),
      targetName: player.username,
      oldValue: { [type]: currentValue.toString() },
      newValue: { [type]: newValue.toString(), adjustment: amount },
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: updatedPlayer.id,
        username: updatedPlayer.username,
        type,
        previousValue: currentValue.toString(),
        adjustment: amount,
        newValue: newValue.toString(),
      },
    });
  } catch (error) {
    console.error('Economy adjustment error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply adjustment' } },
      { status: 500 }
    );
  }
}, { minRole: 'owner' });
