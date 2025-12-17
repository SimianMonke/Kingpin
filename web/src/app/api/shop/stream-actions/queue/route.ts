import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { StreamActionService } from '@/lib/services/stream-action.service'

/**
 * GET /api/shop/stream-actions/queue
 * Get current queue status
 */
export const GET = withErrorHandling(async () => {
  const queueStatus = await StreamActionService.getQueueStatus()

  return successResponse(queueStatus)
})

/**
 * POST /api/shop/stream-actions/queue
 * Process the audio queue (called by cron job)
 * Protected by CRON_SECRET environment variable
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In production, require the cron secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 401)
  }

  // Process the queue
  const result = await StreamActionService.processAudioQueue()

  if (!result.processed) {
    return successResponse({
      processed: false,
      message: result.error ?? 'Nothing to process',
    })
  }

  return successResponse({
    processed: true,
    usageId: result.usageId,
    success: result.success,
    error: result.error,
    message: result.success ? 'Audio action processed' : 'Audio action failed',
  })
})
