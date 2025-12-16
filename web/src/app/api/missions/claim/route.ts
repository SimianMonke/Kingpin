import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { MissionService } from '@/lib/services/mission.service'
import { MISSION_TYPES, type MissionType } from '@/lib/game'

/**
 * POST /api/missions/claim
 * Claim rewards for completed missions
 * Body: { type: 'daily' | 'weekly' }
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id
  const body = await request.json()

  const mission_type = body.type as MissionType

  if (mission_type !== MISSION_TYPES.DAILY && mission_type !== MISSION_TYPES.WEEKLY) {
    return errorResponse('Invalid mission type. Must be "daily" or "weekly"', 400)
  }

  const result = await MissionService.claimRewards(user_id, mission_type)

  if (!result.success) {
    return errorResponse(result.error ?? 'Unable to claim rewards', 400)
  }

  return successResponse(result)
})
