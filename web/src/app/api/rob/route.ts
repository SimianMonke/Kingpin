import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { RobService } from '@/lib/services/rob.service'
import { EconomyModeService, ECONOMY_MODE_ERROR } from '@/lib/services/economy-mode.service'

/**
 * POST /api/rob
 * Execute a robbery attempt (channel point redemption handler)
 *
 * This endpoint can be called:
 * 1. From the website directly (authenticated user) - only when OFFLINE
 * 2. From the bot via webhook (with bot API key + user_id + target) - always allowed
 *
 * Body: { target: string } - target username to rob
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check for bot API key first (for webhook integration)
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  const isBotRequest = EconomyModeService.isBotRequest(apiKey, botKey)

  let user_id: number
  let body: { user_id?: number; target?: string }

  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  if (isBotRequest) {
    // Bot request - get user_id from body (bypasses economy mode check)
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

  // Validate target
  if (!body.target || typeof body.target !== 'string') {
    return errorResponse('target username required')
  }

  // Pre-check if robbery is possible
  const preCheck = await RobService.canRob(user_id, body.target)

  if (!preCheck.canRob) {
    return errorResponse(preCheck.reason || 'Cannot rob this target', 400)
  }

  // Execute robbery
  const result = await RobService.executeRob(user_id, preCheck.targetId!)

  return successResponse(result)
})

/**
 * GET /api/rob?target=username
 * Check if user can rob a specific target (pre-check with success rate)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const target = request.nextUrl.searchParams.get('target')

  if (!target) {
    return errorResponse('target query parameter required')
  }

  const preCheck = await RobService.canRob(session.user.id, target)
  return successResponse(preCheck)
})
