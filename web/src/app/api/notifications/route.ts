import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { NotificationService } from '@/lib/services/notification.service'

/**
 * GET /api/notifications
 * Get notifications for the current user
 * Query params:
 *   - limit: number (default 25, max 50)
 *   - includeRead: boolean (default false)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id
  const { searchParams } = new URL(request.url)

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 50)
  const includeRead = searchParams.get('includeRead') === 'true'

  const result = await NotificationService.getNotifications(userId, limit, includeRead)

  return successResponse(result)
})

/**
 * POST /api/notifications
 * Mark notifications as seen or dismiss
 * Body: { action: 'seen' | 'dismiss', notificationIds?: number[] }
 *   - 'seen' with no IDs marks all as seen
 *   - 'dismiss' requires a single notification ID
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id
  const body = await request.json()
  const { action, notificationIds } = body

  if (!action || !['seen', 'dismiss'].includes(action)) {
    return errorResponse('Invalid action. Must be "seen" or "dismiss"', 400)
  }

  if (action === 'seen') {
    // Validate notificationIds if provided
    if (notificationIds !== undefined) {
      if (!Array.isArray(notificationIds) || !notificationIds.every(id => typeof id === 'number')) {
        return errorResponse('notificationIds must be an array of numbers', 400)
      }
    }

    const count = await NotificationService.markAsSeen(userId, notificationIds)
    return successResponse({ marked: count })
  }

  if (action === 'dismiss') {
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length !== 1) {
      return errorResponse('dismiss requires exactly one notification ID', 400)
    }

    const notificationId = notificationIds[0]
    if (typeof notificationId !== 'number') {
      return errorResponse('Invalid notification ID', 400)
    }

    const success = await NotificationService.dismiss(userId, notificationId)
    if (!success) {
      return errorResponse('Notification not found', 404)
    }

    return successResponse({ dismissed: true })
  }

  return errorResponse('Unknown action', 400)
})
