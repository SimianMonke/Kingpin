import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import {
  LeaderboardService,
  type LeaderboardMetric,
} from '@/lib/services/leaderboard.service'

const VALID_METRICS: LeaderboardMetric[] = [
  'wealthEarned',
  'xpEarned',
  'playCount',
  'robCount',
  'robSuccessCount',
  'checkins',
  'totalContributedUsd',
]

/**
 * GET /api/leaderboards/rank
 * Get authenticated user's rank across all periods
 *
 * Query params:
 * - metric: wealthEarned | xpEarned | playCount | etc. (default: wealthEarned)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const params = request.nextUrl.searchParams

  // Parse and validate metric
  const metricParam = params.get('metric') || 'wealthEarned'
  if (!VALID_METRICS.includes(metricParam as LeaderboardMetric)) {
    return errorResponse(`Invalid metric. Valid options: ${VALID_METRICS.join(', ')}`)
  }
  const metric = metricParam as LeaderboardMetric

  const ranks = await LeaderboardService.getUserRanks(session.user.id, metric)

  return successResponse({
    userId: session.user.id,
    metric,
    ranks: {
      daily: ranks.daily ? {
        rank: ranks.daily.rank,
        value: ranks.daily.value.toString(),
        totalEntries: ranks.daily.totalEntries,
      } : null,
      weekly: ranks.weekly ? {
        rank: ranks.weekly.rank,
        value: ranks.weekly.value.toString(),
        totalEntries: ranks.weekly.totalEntries,
      } : null,
      monthly: ranks.monthly ? {
        rank: ranks.monthly.rank,
        value: ranks.monthly.value.toString(),
        totalEntries: ranks.monthly.totalEntries,
      } : null,
      lifetime: ranks.lifetime ? {
        rank: ranks.lifetime.rank,
        value: ranks.lifetime.value.toString(),
        totalEntries: ranks.lifetime.totalEntries,
      } : null,
    },
  })
})
