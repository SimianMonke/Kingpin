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

  // Transform response to match frontend expected field names
  // Frontend expects "template" but Prisma returns "mission_templates"
  const transformMission = (m: typeof missions.daily[0]) => ({
    id: m.id,
    templateId: m.template_id,
    mission_type: m.mission_type,
    objective_value: m.objective_value,
    reward_wealth: m.reward_wealth,
    reward_xp: m.reward_xp,
    current_progress: m.current_progress ?? 0,
    is_completed: m.is_completed ?? false,
    expires_at: m.expires_at,
    template: m.mission_templates ? {
      id: m.mission_templates.id,
      name: m.mission_templates.name,
      description: m.mission_templates.description,
      category: m.mission_templates.category,
      difficulty: m.mission_templates.difficulty,
      objectiveType: m.mission_templates.objective_type,
    } : null,
  })

  return successResponse({
    daily: missions.daily.map(transformMission),
    weekly: missions.weekly.map(transformMission),
    dailyExpiresAt: missions.dailyExpiresAt,
    weeklyExpiresAt: missions.weeklyExpiresAt,
    canClaimDaily: missions.canClaimDaily,
    canClaimWeekly: missions.canClaimWeekly,
    dailyAlreadyClaimed: missions.dailyAlreadyClaimed,
    weeklyAlreadyClaimed: missions.weeklyAlreadyClaimed,
  })
})
