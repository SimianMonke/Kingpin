import { NextRequest } from 'next/server'
import { GamblingService } from '@/lib/services'
import { withErrorHandling, successResponse, unauthorizedResponse, getAuthSession } from '@/lib/api-utils'

// GET /api/gambling/stats - Get user's gambling stats
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()
  if (!session?.user?.id) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const includeHistory = searchParams.get('history') === 'true'
  const includeLeaderboard = searchParams.get('leaderboard') === 'true'

  const userId = typeof session.user.id === 'string'
    ? parseInt(session.user.id, 10)
    : session.user.id
  const stats = await GamblingService.getGamblingStats(userId)

  const response: Record<string, unknown> = { stats }

  if (includeHistory) {
    response.history = await GamblingService.getGamblingHistory(userId, 20)
  }

  if (includeLeaderboard) {
    response.leaderboard = await GamblingService.getGamblingLeaderboard()
  }

  return successResponse(response)
})
