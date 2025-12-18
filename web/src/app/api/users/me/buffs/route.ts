import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { BuffService } from '@/lib/services/buff.service'

// =============================================================================
// GET /api/users/me/buffs
// Get current user's active buffs
// =============================================================================

export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  // Get active buffs
  const buffs = await BuffService.getActiveBuffs(session.user.id)

  // Get expiring buffs (within 30 minutes)
  const expiringBuffs = await BuffService.getExpiringBuffs(session.user.id, 30)

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
      id: b.id,
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
