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

  const user_id = session.user.id

  // Get user's faction membership info
  const user = await prisma.users.findUnique({
    where: { id: user_id },
    select: {
      faction_id: true,
      joined_faction_at: true,
      faction_cooldown_until: true,
      faction_reward_cooldown_until: true,
      assigned_territory_id: true,
    },
  })

  if (!user?.faction_id) {
    return successResponse({
      inFaction: false,
      faction: null,
      membership: {
        joinedAt: null,
        cooldownUntil: user?.faction_cooldown_until ?? null,
        rewardCooldownUntil: null,
        canJoin: !user?.faction_cooldown_until || user.faction_cooldown_until <= new Date(),
      },
      assignedTerritory: null,
      rank: null,
    })
  }

  // Get faction details
  const faction = await FactionService.getFactionDetails(user.faction_id)

  // Get assigned territory
  const assignedTerritory = user.assigned_territory_id
    ? await FactionService.getUserTerritory(user_id)
    : null

  // Get user's rank in faction
  const rank = await FactionService.getUserFactionRank(user_id)

  // Check if user can earn rewards
  const canEarnRewards = !user.faction_reward_cooldown_until ||
    user.faction_reward_cooldown_until <= new Date()

  return successResponse({
    inFaction: true,
    faction,
    membership: {
      joinedAt: user.joined_faction_at,
      cooldownUntil: null,
      rewardCooldownUntil: canEarnRewards ? null : user.faction_reward_cooldown_until,
      canJoin: false, // Already in faction
      canEarnRewards,
    },
    assignedTerritory,
    rank,
  })
})
