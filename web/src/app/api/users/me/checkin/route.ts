import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * POST /api/users/me/checkin
 * Process daily check-in for the current user
 */
export const POST = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  try {
    const result = await UserService.processCheckin(session.user.id)

    if (!result.success && result.alreadyCheckedIn) {
      return errorResponse('Already checked in today', 400)
    }

    return successResponse(result)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Check-in failed')
  }
})
