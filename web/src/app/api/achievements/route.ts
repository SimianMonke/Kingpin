import { NextRequest } from 'next/server'
import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { AchievementService } from '@/lib/services/achievement.service'

/**
 * GET /api/achievements
 * Get all achievements with user progress
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id

  const [achievements, stats, recentUnlocks] = await Promise.all([
    AchievementService.getAchievements(user_id),
    AchievementService.getCompletionStats(user_id),
    AchievementService.getRecentUnlocks(user_id, 5),
  ])

  return successResponse({
    categories: achievements,
    stats,
    recentUnlocks: recentUnlocks.map((u: typeof recentUnlocks[number]) => ({
      name: u.achievements.name,
      key: u.achievements.key,
      tier: u.achievements.tier,
      completed_at: u.completed_at,
    })),
  })
})
