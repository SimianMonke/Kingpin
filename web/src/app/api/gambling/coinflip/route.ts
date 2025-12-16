import { NextRequest } from 'next/server'
import { GamblingService } from '@/lib/services'
import { withErrorHandling, successResponse, errorResponse, unauthorizedResponse, getAuthSession } from '@/lib/api-utils'

// GET /api/gambling/coinflip - List open challenges
export const GET = withErrorHandling(async () => {
  const challenges = await GamblingService.getOpenCoinFlips()
  return successResponse({ challenges })
})

// POST /api/gambling/coinflip - Create, accept, or cancel challenge
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

  const { action, wager, call, challengeId } = body

  // Validate action exists (HIGH-07)
  if (!action || typeof action !== 'string') {
    return errorResponse('action parameter required', 400)
  }

  switch (action) {
    case 'create': {
      if (!call || !['heads', 'tails'].includes(call as string)) {
        return errorResponse('Call must be heads or tails', 400)
      }
      const wager_amount = BigInt((wager as number) || 0)
      if (!wager_amount || wager_amount <= 0) {
        return errorResponse('Invalid wager amount', 400)
      }
      const createResult = await GamblingService.createCoinFlipChallenge(user_id, wager_amount, call as 'heads' | 'tails')
      return successResponse(createResult)
    }

    case 'accept': {
      if (!challengeId) return errorResponse('challengeId required', 400)
      const acceptResult = await GamblingService.acceptCoinFlipChallenge(user_id, parseInt(String(challengeId)))
      return successResponse(acceptResult)
    }

    case 'cancel': {
      const cancelResult = await GamblingService.cancelCoinFlipChallenge(user_id)
      return successResponse(cancelResult)
    }

    default:
      return errorResponse('Invalid action. Use: create, accept, cancel', 400)
  }
})
