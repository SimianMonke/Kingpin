import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { ShopService } from '@/lib/services/shop.service'
import { EconomyModeService, ECONOMY_MODE_ERROR } from '@/lib/services/economy-mode.service'

/**
 * POST /api/users/me/shop/reroll
 * Reroll/refresh the player's personal shop (channel point redemption)
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

  const result = await ShopService.rerollShop(user_id)

  return successResponse({
    success: result.success,
    itemCount: result.itemCount,
    message: `Shop refreshed with ${result.itemCount} new items!`,
  })
})
