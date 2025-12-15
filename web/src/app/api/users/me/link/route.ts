import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'
import type { Platform } from '@/types'

/**
 * POST /api/users/me/link
 *
 * SECURITY FIX (SEC-01): Direct platform linking is DISABLED.
 * Users MUST link accounts through OAuth authentication to prevent identity theft.
 * Use /api/auth/link/[platform] to initiate the secure OAuth flow.
 */
export const POST = withErrorHandling(async (_request: NextRequest) => {
  // SEC-01: Direct platform ID submission is a critical security vulnerability.
  // Attackers could claim any unlinked platform ID and steal another user's identity.
  // All account linking MUST go through OAuth verification.
  return errorResponse(
    'Direct account linking is disabled for security. ' +
    'Please use the "Link Account" button on the Profile page to securely link your accounts via OAuth.',
    400
  )
})

/**
 * DELETE /api/users/me/link
 * Unlink a platform from the current user's account
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await request.json()

  if (!body.platform) {
    return errorResponse('Missing platform')
  }

  const validPlatforms: Platform[] = ['kick', 'twitch', 'discord']
  if (!validPlatforms.includes(body.platform)) {
    return errorResponse('Invalid platform')
  }

  try {
    await UserService.unlinkPlatform(session.user.id, body.platform as Platform)

    const profile = await UserService.getProfile(session.user.id)
    return successResponse(profile)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to unlink account')
  }
})
