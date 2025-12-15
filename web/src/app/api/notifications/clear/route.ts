import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { NotificationService } from '@/lib/services/notification.service'

/**
 * POST /api/notifications/clear
 * Clear all notifications for the current user
 */
export const POST = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const cleared = await NotificationService.clearAll(session.user.id)

  return successResponse({ cleared })
})
