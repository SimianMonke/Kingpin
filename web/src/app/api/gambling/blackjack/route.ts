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
  let user_id: number

  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    // Bot request - validate user_id type
    if (!body.user_id || typeof body.user_id !== 'number') {
      return errorResponse('user_id required and must be a number', 400)
    }
    user_id = body.user_id
  } else {
    // Session request
    const session = await getAuthSession()
    if (!session?.user?.id) return unauthorizedResponse()
    user_id = typeof session.user.id === 'string'
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
      const wager_amount = BigInt((wager as number) || 0)
      if (!wager_amount || wager_amount <= 0) {
        return errorResponse('Invalid wager amount', 400)
      }
      const startResult = await GamblingService.startBlackjack(user_id, wager_amount)
      return successResponse(startResult)
    }

    case 'hit': {
      const hitResult = await GamblingService.blackjackHit(user_id)
      return successResponse(hitResult)
    }

    case 'stand': {
      const standResult = await GamblingService.blackjackStand(user_id)
      return successResponse(standResult)
    }

    case 'double': {
      const doubleResult = await GamblingService.blackjackDouble(user_id)
      return successResponse(doubleResult)
    }

    default:
      return errorResponse('Invalid action. Use: start, hit, stand, double', 400)
  }
})
