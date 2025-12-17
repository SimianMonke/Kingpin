import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { StreamActionService } from '@/lib/services/stream-action.service'
import { LumiaService } from '@/lib/services/lumia.service'

/**
 * GET /api/shop/stream-actions
 * Get the stream actions catalog with availability status
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id

  // Fetch data in parallel
  const [actions, streamLive, actionStatus, lumiaHealth, queueStatus] = await Promise.all([
    StreamActionService.getAvailableActions(),
    StreamActionService.isStreamLive(),
    StreamActionService.getAllActionStatus(userId),
    LumiaService.checkStreamActionHealth(),
    StreamActionService.getQueueStatus(),
  ])

  // Group actions by category
  const categories: Record<string, typeof actions> = {}
  for (const action of actions) {
    if (!categories[action.category]) {
      categories[action.category] = []
    }
    categories[action.category].push(action)
  }

  return successResponse({
    actions,
    categories,
    streamLive,
    lumiaOnline: lumiaHealth.online,
    lumiaLatency: lumiaHealth.latency,
    actionStatus,
    audioQueue: {
      length: queueStatus.queueLength,
      isProcessing: queueStatus.isProcessing,
    },
    categoryOrder: ['lights', 'fog', 'sound', 'tts'],
  })
})
