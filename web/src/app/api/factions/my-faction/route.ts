import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services'
import { prisma } from '@/lib/db'

// =============================================================================
// GET /api/factions/my-faction - Get current user's faction details
// =============================================================================

export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id

  // Get user's faction membership info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      factionId: true,
      joinedFactionAt: true,
      factionCooldownUntil: true,
      factionRewardCooldownUntil: true,
      assignedTerritoryId: true,
    },
  })

  if (!user?.factionId) {
    return successResponse({
      inFaction: false,
      faction: null,
      membership: {
        joinedAt: null,
        cooldownUntil: user?.factionCooldownUntil ?? null,
        rewardCooldownUntil: null,
        canJoin: !user?.factionCooldownUntil || user.factionCooldownUntil <= new Date(),
      },
      assignedTerritory: null,
      rank: null,
    })
  }

  // Get faction details
  const faction = await FactionService.getFactionDetails(user.factionId)

  // Get assigned territory
  const assignedTerritory = user.assignedTerritoryId
    ? await FactionService.getUserTerritory(userId)
    : null

  // Get user's rank in faction
  const rank = await FactionService.getUserFactionRank(userId)

  // Check if user can earn rewards
  const canEarnRewards = !user.factionRewardCooldownUntil ||
    user.factionRewardCooldownUntil <= new Date()

  return successResponse({
    inFaction: true,
    faction,
    membership: {
      joinedAt: user.joinedFactionAt,
      cooldownUntil: null,
      rewardCooldownUntil: canEarnRewards ? null : user.factionRewardCooldownUntil,
      canJoin: false, // Already in faction
      canEarnRewards,
    },
    assignedTerritory,
    rank,
  })
})
