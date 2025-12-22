import {
  successResponse,
  errorResponse,
  withErrorHandling,
  requireAuthUserId,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * GET /api/users/me/stats
 * Get the current user's game stats
 */
export const GET = withErrorHandling(async () => {
  const user_id = await requireAuthUserId()

  const stats = await UserService.getStats(user_id)

  if (!stats) {
    return errorResponse('User not found', 404)
  }

  return successResponse(stats)
})
