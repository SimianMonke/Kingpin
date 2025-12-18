import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  withErrorHandling,
} from '@/lib/api-utils'

/**
 * GET /api/feed/live
 * Get recent player activity for the live feed
 *
 * Query params:
 * - limit: number (default 5, max 20)
 *
 * Returns recent game_events with user info
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams

  // Parse limit
  const limit = Math.min(20, Math.max(1, parseInt(params.get('limit') || '5', 10)))

  // Query recent game events with user info
  const events = await prisma.game_events.findMany({
    where: {
      // Only show events from the last 24 hours
      created_at: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      // Only show events that have a user
      user_id: {
        not: null,
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
    include: {
      users_game_events_user_idTousers: {
        select: {
          id: true,
          username: true,
          display_name: true,
          kingpin_name: true,
        },
      },
      users_game_events_target_user_idTousers: {
        select: {
          id: true,
          username: true,
          display_name: true,
          kingpin_name: true,
        },
      },
    },
  })

  // Transform to feed format
  const feedEvents = events.map((event) => {
    const user = event.users_game_events_user_idTousers
    const target = event.users_game_events_target_user_idTousers

    // Generate description based on event type
    let description = event.event_description || formatEventDescription(
      event.event_type,
      target?.display_name || target?.username || null,
      event.success ?? true,
      event.wealth_change,
      event.tier
    )

    return {
      id: event.id,
      username: user?.kingpin_name || user?.display_name || user?.username || 'Unknown',
      eventType: event.event_type,
      description,
      wealthChange: event.wealth_change ? Number(event.wealth_change) : undefined,
      xpChange: event.xp_change ?? undefined,
      success: event.success ?? true,
      timestamp: event.created_at?.toISOString() || new Date().toISOString(),
    }
  })

  return successResponse({
    events: feedEvents,
    timestamp: new Date().toISOString(),
  })
})

/**
 * Generate a human-readable description for an event
 */
function formatEventDescription(
  eventType: string,
  targetName: string | null,
  success: boolean,
  wealthChange: bigint | null,
  tier: string | null
): string {
  const normalizedType = eventType.toLowerCase()

  // Play events
  if (normalizedType.includes('play')) {
    return 'played and earned rewards'
  }

  // Rob events
  if (normalizedType.includes('rob')) {
    if (success && targetName) {
      return `robbed ${targetName}`
    } else if (success) {
      return 'committed robbery'
    } else if (targetName) {
      return `failed to rob ${targetName}`
    } else {
      return 'robbery attempt failed'
    }
  }

  // Mission events
  if (normalizedType.includes('mission')) {
    if (tier) {
      return `completed ${tier} mission`
    }
    return 'completed a mission'
  }

  // Heist events
  if (normalizedType.includes('heist')) {
    return 'won a heist event'
  }

  // Gambling events
  if (normalizedType.includes('slots') || normalizedType.includes('slot')) {
    if (normalizedType.includes('jackpot')) {
      return 'HIT THE JACKPOT!'
    }
    return wealthChange && wealthChange > 0 ? 'won at slots' : 'played slots'
  }

  if (normalizedType.includes('blackjack')) {
    return wealthChange && wealthChange > 0 ? 'won at blackjack' : 'played blackjack'
  }

  if (normalizedType.includes('coinflip')) {
    return wealthChange && wealthChange > 0 ? 'won a coinflip' : 'lost a coinflip'
  }

  // Level up
  if (normalizedType.includes('level')) {
    return 'leveled up!'
  }

  // Crate events
  if (normalizedType.includes('crate')) {
    if (tier) {
      return `opened a ${tier} crate`
    }
    return 'opened a crate'
  }

  // Check-in
  if (normalizedType.includes('checkin') || normalizedType.includes('check-in')) {
    return 'checked in'
  }

  // Default
  return eventType.replace(/_/g, ' ')
}
