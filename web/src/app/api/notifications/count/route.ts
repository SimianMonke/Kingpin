import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { NotificationService } from '@/lib/services/notification.service'

/**
 * GET /api/notifications/count
 * Get unread notification count (lightweight endpoint for polling)
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const count = await NotificationService.getUnreadCount(session.user.id)

  return successResponse({ count })
})
