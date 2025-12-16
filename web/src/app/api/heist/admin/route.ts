import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { HeistService } from '@/lib/services/heist.service'
import { HEIST_EVENT_TYPES } from '@/lib/game'
import type { HeistEventType } from '@/lib/game/constants'
import { prisma } from '@/lib/db'

/**
 * POST /api/heist/admin
 * Admin actions for heist management
 * Requires x-api-key header with ADMIN_API_KEY
 *
 * Actions:
 * - trigger: Force trigger a heist event
 * - expire: Force expire active heist
 * - schedule: Create/reset heist schedule
 * - status: Get admin status view
 * - cleanup: Run expired heist cleanup
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify admin API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return forbiddenResponse('Invalid API key')
  }

  const body = await request.json()
  const { action, session_id, heist_id, event_type } = body

  switch (action) {
    case 'trigger': {
      // Trigger a heist event
      if (!session_id) {
        // Find active session
        const activeSession = await prisma.streaming_sessions.findFirst({
          where: { is_active: true },
        })

        if (!activeSession) {
          return errorResponse('No active session. Provide session_id or start a session first.')
        }

        const result = await HeistService.triggerHeist(
          activeSession.id,
          event_type as HeistEventType | undefined
        )

        if (!result.success) {
          return errorResponse(result.error || 'Failed to trigger heist')
        }

        return successResponse({
          action: 'trigger',
          heist: result.heist,
        })
      }

      const result = await HeistService.triggerHeist(
        session_id,
        event_type as HeistEventType | undefined
      )

      if (!result.success) {
        return errorResponse(result.error || 'Failed to trigger heist')
      }

      return successResponse({
        action: 'trigger',
        heist: result.heist,
      })
    }

    case 'expire': {
      // Force expire active heist
      if (!heist_id) {
        // Find and expire any active heist
        const expiredCount = await HeistService.checkExpiredHeists()
        return successResponse({
          action: 'expire',
          expiredCount,
        })
      }

      await HeistService.expireHeist(heist_id)
      return successResponse({
        action: 'expire',
        heist_id,
      })
    }

    case 'schedule': {
      // Create/reset heist schedule
      if (!session_id) {
        return errorResponse('session_id is required for schedule action')
      }

      const isFirstHeist = body.isFirstHeist || false
      const schedule = await HeistService.scheduleNextHeist(session_id, isFirstHeist)

      return successResponse({
        action: 'schedule',
        schedule,
      })
    }

    case 'clear_schedule': {
      // Clear heist schedule
      if (!session_id) {
        return errorResponse('session_id is required for clear_schedule action')
      }

      await HeistService.clearSchedule(session_id)
      return successResponse({
        action: 'clear_schedule',
        session_id,
      })
    }

    case 'status': {
      // Get admin status view
      const activeSession = await prisma.streaming_sessions.findFirst({
        where: { is_active: true },
      })

      const activeHeist = activeSession
        ? await HeistService.getActiveHeist(activeSession.id)
        : null

      const schedule = activeSession
        ? await HeistService.getHeistSchedule(activeSession.id)
        : null

      const recentHistory = await HeistService.getHeistHistory(undefined, 5)
      const leaderboard = await HeistService.getHeistLeaderboard(10)

      // Get trivia pool stats
      const triviaStats = await prisma.heist_trivia_pool.aggregate({
        _count: { _all: true },
        _avg: { times_used: true },
      })

      return successResponse({
        action: 'status',
        session: activeSession
          ? {
              id: activeSession.id,
              title: activeSession.session_title,
              platform: activeSession.platform,
              started_at: activeSession.started_at,
            }
          : null,
        activeHeist: activeHeist
          ? {
              ...activeHeist,
              // Include correct answer for admin view
            }
          : null,
        schedule,
        recentHistory,
        leaderboard,
        triviaPool: {
          totalQuestions: triviaStats._count?._all ?? 0,
          avgTimesUsed: Math.round(triviaStats._avg?.times_used ?? 0),
        },
        event_types: Object.values(HEIST_EVENT_TYPES),
      })
    }

    case 'cleanup': {
      // Run expired heist cleanup
      const expiredCount = await HeistService.checkExpiredHeists()
      return successResponse({
        action: 'cleanup',
        expiredCount,
      })
    }

    default:
      return errorResponse(
        `Unknown action: ${action}. Valid actions: trigger, expire, schedule, clear_schedule, status, cleanup`
      )
  }
})
