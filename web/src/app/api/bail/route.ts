import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { JailService } from '@/lib/services/jail.service'
import { EconomyModeService, ECONOMY_MODE_ERROR } from '@/lib/services/economy-mode.service'

/**
 * POST /api/bail
 * Pay bail to escape jail (channel point redemption handler)
 *
 * This endpoint can be called:
 * 1. From the website directly (authenticated user) - only when OFFLINE
 * 2. From the bot via webhook (with bot API key + user_id) - always allowed
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check for bot API key first (for webhook integration)
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  const isBotRequest = EconomyModeService.isBotRequest(apiKey, botKey)

  let user_id: number

  if (isBotRequest) {
    // Bot request - get user_id from body (bypasses economy mode check)
    const body = await request.json()
    if (!body.user_id || typeof body.user_id !== 'number') {
      return errorResponse('user_id required for bot requests')
    }
    user_id = body.user_id
  } else {
    // Website request - use session
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id

    // Check economy mode - webapp only allowed when offline
    const canExecuteFree = await EconomyModeService.canExecuteFree()
    if (!canExecuteFree) {
      return errorResponse(ECONOMY_MODE_ERROR.message, 403, ECONOMY_MODE_ERROR.code)
    }
  }

  // Process bail
  const result = await JailService.payBail(user_id)

  if (!result.success) {
    if (!result.wasJailed) {
      return errorResponse('You are not in jail!', 400)
    }
    return errorResponse('Failed to process bail', 500)
  }

  return successResponse({
    success: true,
    bailCost: result.bailCost,
    newWealth: result.newWealth.toString(),
    message: `Paid $${result.bailCost.toLocaleString()} bail and escaped jail!`,
  })
})

/**
 * GET /api/bail
 * Get current jail status
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const jailStatus = await JailService.getJailStatus(session.user.id)
  return successResponse(jailStatus)
})
