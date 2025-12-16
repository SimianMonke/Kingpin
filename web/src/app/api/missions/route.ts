import { NextRequest } from 'next/server'
import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { MissionService } from '@/lib/services/mission.service'

/**
 * GET /api/missions
 * Get user's active daily and weekly missions
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id

  // Ensure missions are assigned
  await MissionService.ensureMissionsAssigned(user_id)

  // Get active missions
  const missions = await MissionService.getActiveMissions(user_id)

  return successResponse(missions)
})
