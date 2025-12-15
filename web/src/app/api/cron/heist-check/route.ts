import { NextRequest } from 'next/server'
import {
  successResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { HeistService } from '@/lib/services/heist.service'
import { prisma } from '@/lib/db'

/**
 * GET /api/cron/heist-check
 * Heist trigger check - runs every 2 minutes during active sessions
 *
 * Jobs:
 * 1. Check if there's an active streaming session
 * 2. If scheduled heist time has passed, trigger a heist event
 * 3. Clean up any expired heists that weren't properly closed
 *
 * Protected by CRON_SECRET (Vercel Cron) or ADMIN_API_KEY
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const adminKey = request.headers.get('x-api-key')

  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isAdminAuth = adminKey === process.env.ADMIN_API_KEY

  if (!isVercelCron && !isAdminAuth) {
    return forbiddenResponse('Unauthorized cron request')
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  // Check for active streaming session
  const activeSession = await prisma.streamingSession.findFirst({
    where: { isActive: true },
  })

  if (!activeSession) {
    return successResponse({
      ...results,
      status: 'no_active_session',
      message: 'No active streaming session - skipping heist check',
    })
  }

  results.sessionId = activeSession.id
  results.sessionTitle = activeSession.sessionTitle

  // Check and trigger scheduled heist if due
  try {
    const triggerResult = await HeistService.checkAndTriggerScheduledHeist(activeSession.id)

    if (triggerResult === null) {
      // Not time yet or schedule was just created
      const schedule = await HeistService.getHeistSchedule(activeSession.id)

      results.heistTrigger = {
        triggered: false,
        reason: 'Not scheduled yet',
        nextHeistAt: schedule?.nextHeistAt,
        timeUntilMs: schedule?.timeUntilMs,
      }
    } else if (triggerResult.success) {
      results.heistTrigger = {
        triggered: true,
        heist: {
          id: triggerResult.heist?.id,
          eventType: triggerResult.heist?.eventType,
          difficulty: triggerResult.heist?.difficulty,
          timeLimitSeconds: triggerResult.heist?.timeLimitSeconds,
        },
      }
    } else {
      results.heistTrigger = {
        triggered: false,
        reason: triggerResult.error,
      }
    }
  } catch (error) {
    console.error('Heist trigger check failed:', error)
    results.heistTrigger = {
      triggered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Clean up any expired heists
  try {
    const expiredCount = await HeistService.checkExpiredHeists()
    results.expiredHeistsCleanup = {
      success: true,
      expiredCount,
    }
  } catch (error) {
    console.error('Expired heist cleanup failed:', error)
    results.expiredHeistsCleanup = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Get current heist status for logging
  const activeHeist = await HeistService.getActiveHeist(activeSession.id)
  if (activeHeist) {
    results.activeHeist = {
      id: activeHeist.id,
      eventType: activeHeist.eventType,
      isActive: activeHeist.isActive,
      timeRemainingMs: activeHeist.timeRemainingMs,
      hasWinner: !!activeHeist.winner,
    }
  }

  return successResponse({
    ...results,
    status: 'success',
  })
})
