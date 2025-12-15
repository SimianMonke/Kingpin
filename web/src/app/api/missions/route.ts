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

  const userId = session.user.id

  // Ensure missions are assigned
  await MissionService.ensureMissionsAssigned(userId)

  // Get active missions
  const missions = await MissionService.getActiveMissions(userId)

  return successResponse(missions)
})
