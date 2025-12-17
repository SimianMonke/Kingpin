import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { StreamActionService } from '@/lib/services/stream-action.service'

interface TriggerRequestBody {
  actionId: string
  payload?: {
    text?: string
    color?: string
  }
}

/**
 * POST /api/shop/stream-actions/trigger
 * Trigger a stream action
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id

  const body = (await request.json()) as TriggerRequestBody

  if (!body.actionId) {
    return errorResponse('Missing actionId', 400)
  }

  const result = await StreamActionService.trigger(userId, body.actionId, body.payload)

  if (!result.success) {
    return errorResponse(result.reason ?? 'Failed to trigger action', 400)
  }

  return successResponse({
    success: true,
    usageId: result.usageId,
    queuePosition: result.queuePosition,
    message: result.queuePosition
      ? `Action queued (position ${result.queuePosition})`
      : 'Action triggered',
  })
})
