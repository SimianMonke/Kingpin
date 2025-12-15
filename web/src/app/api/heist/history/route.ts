import { NextRequest } from 'next/server'
import {
  successResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { HeistService } from '@/lib/services/heist.service'

/**
 * GET /api/heist/history
 * Get heist event history
 * Query params:
 * - sessionId: Filter by session
 * - limit: Max results (default 20)
 * - leaderboard: Include heist win leaderboard
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const url = new URL(request.url)
  const sessionIdParam = url.searchParams.get('sessionId')
  const limitParam = url.searchParams.get('limit')
  const includeLeaderboard = url.searchParams.get('leaderboard') === 'true'

  const sessionId = sessionIdParam ? parseInt(sessionIdParam, 10) : undefined
  const limit = limitParam ? parseInt(limitParam, 10) : 20

  // Get history
  const history = await HeistService.getHeistHistory(sessionId, limit)

  // Get leaderboard if requested
  let leaderboard = undefined
  if (includeLeaderboard) {
    leaderboard = await HeistService.getHeistLeaderboard(10)
  }

  // Get user stats if authenticated
  let userStats = undefined
  const session = await getAuthSession()
  if (session?.user?.id) {
    userStats = await HeistService.getUserHeistStats(session.user.id)
  }

  return successResponse({
    history,
    leaderboard,
    userStats,
  })
})
