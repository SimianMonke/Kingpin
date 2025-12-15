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

  const userId = session.user.id

  const [achievements, stats, recentUnlocks] = await Promise.all([
    AchievementService.getAchievements(userId),
    AchievementService.getCompletionStats(userId),
    AchievementService.getRecentUnlocks(userId, 5),
  ])

  return successResponse({
    categories: achievements,
    stats,
    recentUnlocks: recentUnlocks.map(u => ({
      achievementName: u.achievement.achievementName,
      achievementKey: u.achievement.achievementKey,
      tier: u.achievement.tier,
      completedAt: u.completedAt,
    })),
  })
})
