import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { TokenService } from '@/lib/services/token.service'

/**
 * Check if request is from the bot (has valid API key)
 */
function isBotRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  return !!(apiKey && botKey && apiKey === botKey)
}

/**
 * GET /api/tokens
 * Get current user's token status
 *
 * For web: Uses session auth
 * For bot: Pass userId as query param with x-api-key header
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  if (isBotRequest(request)) {
    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    if (!userIdParam) {
      return errorResponse('userId required for bot requests', 400)
    }
    user_id = parseInt(userIdParam, 10)
    if (isNaN(user_id)) {
      return errorResponse('Invalid userId', 400)
    }
  } else {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id
  }

  const status = await TokenService.getTokenStatus(user_id)
  const nextCost = await TokenService.getNextConversionCost(user_id)

  return successResponse({
    ...status,
    nextConversionCost: nextCost,
  })
})

/**
 * POST /api/tokens
 * Convert credits to tokens (wealth sink)
 *
 * Cost scales: $1,000 base * 1.15^(purchases today)
 * Max 50 conversions per day
 *
 * For web: Uses session auth
 * For bot: Pass userId in body with x-api-key header
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  let body: { userId?: number } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine for web requests
  }

  if (isBotRequest(request)) {
    if (!body.userId || typeof body.userId !== 'number') {
      return errorResponse('userId required for bot requests', 400)
    }
    user_id = body.userId
  } else {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id
  }

  const result = await TokenService.convertCreditsToTokens(user_id)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to convert credits to tokens', 400)
  }

  return successResponse({
    success: true,
    tokensGained: result.tokensGained,
    cost: result.cost,
    newBalance: result.newBalance,
    message: `Purchased 1 token for $${result.cost?.toLocaleString()}`,
  })
})
