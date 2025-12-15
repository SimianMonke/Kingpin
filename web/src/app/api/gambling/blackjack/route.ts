import { NextRequest } from 'next/server'
import { GamblingService } from '@/lib/services'
import { withErrorHandling, successResponse, errorResponse, unauthorizedResponse, getAuthSession } from '@/lib/api-utils'

// POST /api/gambling/blackjack - All blackjack actions
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Parse body ONCE at the start
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const apiKey = request.headers.get('x-api-key')
  let userId: number

  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    // Bot request - validate userId type
    if (!body.userId || typeof body.userId !== 'number') {
      return errorResponse('userId required and must be a number', 400)
    }
    userId = body.userId
  } else {
    // Session request
    const session = await getAuthSession()
    if (!session?.user?.id) return unauthorizedResponse()
    userId = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id
  }

  const { action, wager } = body

  // Validate action exists (HIGH-07)
  if (!action || typeof action !== 'string') {
    return errorResponse('action parameter required', 400)
  }

  switch (action) {
    case 'start': {
      const wagerAmount = BigInt((wager as number) || 0)
      if (!wagerAmount || wagerAmount <= 0) {
        return errorResponse('Invalid wager amount', 400)
      }
      const startResult = await GamblingService.startBlackjack(userId, wagerAmount)
      return successResponse(startResult)
    }

    case 'hit': {
      const hitResult = await GamblingService.blackjackHit(userId)
      return successResponse(hitResult)
    }

    case 'stand': {
      const standResult = await GamblingService.blackjackStand(userId)
      return successResponse(standResult)
    }

    case 'double': {
      const doubleResult = await GamblingService.blackjackDouble(userId)
      return successResponse(doubleResult)
    }

    default:
      return errorResponse('Invalid action. Use: start, hit, stand, double', 400)
  }
})
