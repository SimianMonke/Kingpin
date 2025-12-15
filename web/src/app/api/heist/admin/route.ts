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
  const { action, sessionId, heistId, eventType } = body

  switch (action) {
    case 'trigger': {
      // Trigger a heist event
      if (!sessionId) {
        // Find active session
        const activeSession = await prisma.streamingSession.findFirst({
          where: { isActive: true },
        })

        if (!activeSession) {
          return errorResponse('No active session. Provide sessionId or start a session first.')
        }

        const result = await HeistService.triggerHeist(
          activeSession.id,
          eventType as HeistEventType | undefined
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
        sessionId,
        eventType as HeistEventType | undefined
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
      if (!heistId) {
        // Find and expire any active heist
        const expiredCount = await HeistService.checkExpiredHeists()
        return successResponse({
          action: 'expire',
          expiredCount,
        })
      }

      await HeistService.expireHeist(heistId)
      return successResponse({
        action: 'expire',
        heistId,
      })
    }

    case 'schedule': {
      // Create/reset heist schedule
      if (!sessionId) {
        return errorResponse('sessionId is required for schedule action')
      }

      const isFirstHeist = body.isFirstHeist || false
      const schedule = await HeistService.scheduleNextHeist(sessionId, isFirstHeist)

      return successResponse({
        action: 'schedule',
        schedule,
      })
    }

    case 'clear_schedule': {
      // Clear heist schedule
      if (!sessionId) {
        return errorResponse('sessionId is required for clear_schedule action')
      }

      await HeistService.clearSchedule(sessionId)
      return successResponse({
        action: 'clear_schedule',
        sessionId,
      })
    }

    case 'status': {
      // Get admin status view
      const activeSession = await prisma.streamingSession.findFirst({
        where: { isActive: true },
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
      const triviaStats = await prisma.heistTriviaPool.aggregate({
        _count: { id: true },
        _avg: { timesUsed: true },
      })

      return successResponse({
        action: 'status',
        session: activeSession
          ? {
              id: activeSession.id,
              title: activeSession.sessionTitle,
              platform: activeSession.platform,
              startedAt: activeSession.startedAt,
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
          totalQuestions: triviaStats._count.id,
          avgTimesUsed: Math.round(triviaStats._avg.timesUsed || 0),
        },
        eventTypes: Object.values(HEIST_EVENT_TYPES),
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
