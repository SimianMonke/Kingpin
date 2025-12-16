import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import {
  LeaderboardService,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from '@/lib/services/leaderboard.service'

const VALID_METRICS: LeaderboardMetric[] = [
  'wealth_earned',
  'xp_earned',
  'play_count',
  'rob_count',
  'rob_success_count',
  'checkins',
  'totalContributedUsd',
]

const VALID_PERIODS: LeaderboardPeriod[] = [
  'daily',
  'weekly',
  'monthly',
  'annual',
  'lifetime',
]

/**
 * GET /api/leaderboards
 * Get leaderboard data
 *
 * Query params:
 * - metric: wealth_earned | xp_earned | play_count | rob_count | rob_success_count | checkins | totalContributedUsd
 * - period: daily | weekly | monthly | annual | lifetime
 * - limit: number (default 10, max 100)
 * - offset: number (default 0)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams

  // Parse and validate metric
  const metricParam = params.get('metric') || 'wealth_earned'
  if (!VALID_METRICS.includes(metricParam as LeaderboardMetric)) {
    return errorResponse(`Invalid metric. Valid options: ${VALID_METRICS.join(', ')}`)
  }
  const metric = metricParam as LeaderboardMetric

  // Parse and validate period
  const periodParam = params.get('period') || 'daily'
  if (!VALID_PERIODS.includes(periodParam as LeaderboardPeriod)) {
    return errorResponse(`Invalid period. Valid options: ${VALID_PERIODS.join(', ')}`)
  }
  const period = periodParam as LeaderboardPeriod

  // Parse limit and offset
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '10', 10)))
  const offset = Math.max(0, parseInt(params.get('offset') || '0', 10))

  const leaderboard = await LeaderboardService.getLeaderboard(metric, period, limit, offset)

  // Get period bounds for display
  const bounds = LeaderboardService.getPeriodBounds(period)

  return successResponse({
    metric,
    period,
    period_start: bounds.start,
    period_end: bounds.end,
    entries: leaderboard,
    pagination: {
      limit,
      offset,
      hasMore: leaderboard.length === limit,
    },
  })
})
