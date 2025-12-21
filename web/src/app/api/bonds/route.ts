import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { BondService } from '@/lib/services/bond.service'

/**
 * Check if request is from the bot (has valid API key)
 */
function isBotRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  return !!(apiKey && botKey && apiKey === botKey)
}

/**
 * GET /api/bonds
 * Get current user's bond status
 *
 * For web: Uses session auth
 * For bot: Pass userId as query param with x-api-key header
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  if (isBotRequest(request)) {
    // Bot request - get userId from query params
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
    // Web request - use session
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id
  }

  const status = await BondService.getBondStatus(user_id)
  return successResponse(status)
})

/**
 * POST /api/bonds
 * Convert credits to bonds (the "Golden Sink")
 *
 * Requirements:
 * - Captain tier or above (level 60+)
 * - $2,500,000 credits
 * - 7-day cooldown between conversions
 *
 * Returns 100 bonds per conversion
 *
 * For web: Uses session auth
 * For bot: Pass userId in body with x-api-key header
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  // Parse body first
  let body: { userId?: number; action?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine for web requests
  }

  if (isBotRequest(request)) {
    // Bot request - get userId from body
    if (!body.userId || typeof body.userId !== 'number') {
      return errorResponse('userId required for bot requests', 400)
    }
    user_id = body.userId
  } else {
    // Web request - use session
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id
  }

  const action = body.action || 'convert'

  if (action !== 'convert') {
    return errorResponse('Invalid action. Use POST /api/bonds/purchase for cosmetics.', 400)
  }

  const result = await BondService.convertCreditsToBonds(user_id)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to convert credits to bonds', 400)
  }

  return successResponse({
    success: true,
    bondsGained: result.bondsGained,
    cost: result.cost,
    newBalance: result.newBalance,
    message: `Converted $${result.cost?.toLocaleString()} to ${result.bondsGained} bonds!`,
  })
})
