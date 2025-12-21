import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { PlayService } from '@/lib/services/play.service'
import { EconomyModeService, ECONOMY_MODE_ERROR } from '@/lib/services/economy-mode.service'

/**
 * POST /api/play
 * Execute the play action (channel point redemption handler)
 *
 * This endpoint can be called:
 * 1. From the website directly (authenticated user) - only when OFFLINE
 * 2. From the bot via webhook (with bot API key + user_id) - always allowed
 *
 * Body parameters:
 * - user_id: (required for bot requests) The user's database ID
 * - useToken: (optional) If true, spend a token for 25% bonus rewards (Phase 3A)
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check for bot API key first (for webhook integration)
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  const isBotRequest = EconomyModeService.isBotRequest(apiKey, botKey)

  let user_id: number
  let useToken = false

  if (isBotRequest) {
    // Bot request - get user_id from body (bypasses economy mode check)
    const body = await request.json()
    if (!body.user_id || typeof body.user_id !== 'number') {
      return errorResponse('user_id required for bot requests')
    }
    user_id = body.user_id
    useToken = body.useToken === true
  } else {
    // Website request - use session
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id

    // Parse body for useToken parameter
    try {
      const body = await request.json()
      useToken = body.useToken === true
    } catch {
      // No body or invalid JSON is fine, defaults to false
    }

    // Check economy mode - webapp only allowed when offline
    const canExecuteFree = await EconomyModeService.canExecuteFree()
    if (!canExecuteFree) {
      return errorResponse(ECONOMY_MODE_ERROR.message, 403, ECONOMY_MODE_ERROR.code)
    }
  }

  // Execute play with optional token bonus (Phase 3A)
  const result = await PlayService.executePlay(user_id, useToken)

  if (!result.success && !result.busted) {
    // Player couldn't play (jailed or no tokens when required)
    return errorResponse(
      result.jailed ? 'You are in jail! Use bail to escape.' : 'Unable to play',
      400
    )
  }

  return successResponse(result)
})

/**
 * GET /api/play
 * Check if user can play (pre-check)
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const preCheck = await PlayService.canPlay(session.user.id)
  return successResponse(preCheck)
})
