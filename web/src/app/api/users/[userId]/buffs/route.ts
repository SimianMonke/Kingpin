import { NextRequest } from 'next/server'
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { BuffService } from '@/lib/services/buff.service'
import { UserService } from '@/lib/services/user.service'

// =============================================================================
// GET /api/users/[userId]/buffs
// Get user's active buffs with remaining time
// Used by bot for !buffs command
// =============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) => {
  // Require bot API key authentication
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY

  if (!apiKey || !botKey || apiKey !== botKey) {
    return forbiddenResponse('Invalid API key')
  }

  const { userId: userIdStr } = await params
  const userId = parseInt(userIdStr, 10)

  if (isNaN(userId)) {
    return notFoundResponse('Invalid user ID')
  }

  // Verify user exists
  const user = await UserService.findById(userId)
  if (!user) {
    return notFoundResponse('User not found')
  }

  // Get active buffs
  const buffs = await BuffService.getActiveBuffs(userId)

  // Get expiring buffs (within 60 minutes)
  const expiringBuffs = await BuffService.getExpiringBuffs(userId, 60)

  // Group buffs by category for display
  const buffsByCategory: Record<string, typeof buffs> = {}
  for (const buff of buffs) {
    const category = buff.category || 'other'
    if (!buffsByCategory[category]) {
      buffsByCategory[category] = []
    }
    buffsByCategory[category].push(buff)
  }

  return successResponse({
    buffs: buffs.map((b) => ({
      buffType: b.buffType,
      category: b.category,
      multiplier: b.multiplier,
      source: b.source,
      description: b.description,
      remainingMinutes: b.remainingMinutes,
      expiresAt: b.expiresAt,
    })),
    buffsByCategory,
    expiringBuffs: expiringBuffs.map((b) => ({
      buffType: b.buffType,
      description: b.description,
      remainingMinutes: b.remainingMinutes,
    })),
    totalActive: buffs.length,
  })
})
