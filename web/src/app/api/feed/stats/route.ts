import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  withErrorHandling,
} from '@/lib/api-utils'

/**
 * GET /api/feed/stats
 * Get global game statistics for the home page
 *
 * Returns aggregate stats across all players
 */
export const GET = withErrorHandling(async (_request: NextRequest) => {
  // Get all stats in parallel for performance
  const [
    playerCount,
    wealthAggregate,
    cratesOpened,
    robberies,
  ] = await Promise.all([
    // Total players
    prisma.users.count(),

    // Total wealth across all players
    prisma.users.aggregate({
      _sum: {
        wealth: true,
      },
    }),

    // Total crates opened
    prisma.crate_opens.count(),

    // Total robberies (from game_events with 'rob' type)
    prisma.game_events.count({
      where: {
        event_type: {
          contains: 'rob',
          mode: 'insensitive',
        },
      },
    }),
  ])

  return successResponse({
    players: playerCount,
    totalWealth: Number(wealthAggregate._sum.wealth || 0),
    cratesOpened,
    robberies,
    timestamp: new Date().toISOString(),
  })
})
