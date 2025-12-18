import { NextRequest } from 'next/server'
import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { AchievementService } from '@/lib/services/achievement.service'

// Helper to convert BigInt to string for JSON serialization
function serializeAchievements(categories: Awaited<ReturnType<typeof AchievementService.getAchievements>>) {
  return categories.map(cat => ({
    ...cat,
    achievements: cat.achievements.map(ach => ({
      ...ach,
      requirement_value: ach.requirement_value?.toString() ?? '0',
      current_progress: ach.current_progress?.toString() ?? '0',
    })),
  }))
}

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
    categories: serializeAchievements(achievements),
    stats,
    recentUnlocks: recentUnlocks.map((u: typeof recentUnlocks[number]) => ({
      name: u.achievements.name,
      key: u.achievements.key,
      tier: u.achievements.tier,
      completed_at: u.completed_at,
    })),
  })
})
