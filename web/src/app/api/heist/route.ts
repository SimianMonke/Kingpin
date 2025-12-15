import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
  applyRateLimit,
  RATE_LIMITS,
} from '@/lib/api-utils'
import { HeistService } from '@/lib/services/heist.service'
import { prisma } from '@/lib/db'

/**
 * GET /api/heist
 * Get active heist event (public - no auth required for viewing)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Get active heist from any active session
  const heist = await HeistService.getAnyActiveHeist()

  if (!heist) {
    return successResponse({
      active: false,
      heist: null,
      schedule: null,
    })
  }

  // Get schedule info
  const schedule = await HeistService.getHeistSchedule(heist.sessionId)

  // Don't expose correct answer in active heists
  const sanitizedHeist = {
    ...heist,
    correctAnswer: heist.isActive ? undefined : heist.correctAnswer,
  }

  return successResponse({
    active: heist.isActive,
    heist: sanitizedHeist,
    schedule: schedule
      ? {
          nextHeistAt: schedule.nextHeistAt,
          timeUntilMs: schedule.timeUntilMs,
        }
      : null,
  })
})

/**
 * POST /api/heist
 * Submit an answer to the active heist
 * Supports both web auth and bot API key
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await parseJsonBody<{
    answer: string
    platform?: string
    userId?: number // For bot API key auth
  }>(request)

  if (!body.answer) {
    return errorResponse('Answer is required')
  }

  let userId: number
  let platform: string

  // Check for bot API key auth
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    // Bot auth - userId must be provided
    if (!body.userId) {
      return errorResponse('userId is required for bot auth')
    }
    userId = body.userId
    platform = body.platform || 'chat'
  } else {
    // Web auth
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    userId = session.user.id

    // Determine platform from user's linked accounts
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kickUserId: true, twitchUserId: true },
    })
    platform = user?.kickUserId ? 'kick' : user?.twitchUserId ? 'twitch' : 'web'
  }

  // SEC-03: Rate limit heist answers to prevent brute-force
  // Get active heist to create per-heist rate limit key
  const activeHeist = await HeistService.getAnyActiveHeist()
  if (activeHeist) {
    const rateLimitError = applyRateLimit(
      `heist:${activeHeist.id}:${userId}`,
      RATE_LIMITS.HEIST // 5 attempts per minute
    )
    if (rateLimitError) return rateLimitError
  }

  // Submit answer
  const result = await HeistService.submitAnswer(userId, body.answer, platform)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to submit answer')
  }

  return successResponse({
    correct: result.correct,
    winner: result.winner || false,
    alreadyWon: result.alreadyWon || false,
    expired: result.expired || false,
    crateTier: result.crateTier,
    responseTimeMs: result.responseTimeMs,
  })
})
