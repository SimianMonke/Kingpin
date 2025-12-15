import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * GET /api/users/me/stats
 * Get the current user's game stats
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const stats = await UserService.getStats(session.user.id)

  if (!stats) {
    return errorResponse('User not found', 404)
  }

  return successResponse(stats)
})
