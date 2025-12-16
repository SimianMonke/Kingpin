import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * GET /api/users/me
 * Get the current authenticated user's profile
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const profile = await UserService.getProfile(session.user.id)

  if (!profile) {
    return errorResponse('User not found', 404)
  }

  return successResponse(profile)
})

/**
 * PATCH /api/users/me
 * Update the current user's profile
 */
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await request.json()

  // Handle Kingpin name update
  if (body.kingpin_name !== undefined) {
    try {
      await UserService.setKingpinName(session.user.id, body.kingpin_name)
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to update name')
    }
  }

  // Return updated profile
  const profile = await UserService.getProfile(session.user.id)
  return successResponse(profile)
})
