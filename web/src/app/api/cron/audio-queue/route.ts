import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { StreamActionService } from '@/lib/services/stream-action.service'

// =============================================================================
// POST /api/cron/audio-queue
// Process pending audio queue items (TTS, sounds)
// Runs every minute via Vercel cron
// =============================================================================

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 401)
  }

  // Check if stream is live - no point processing if offline
  const isLive = await StreamActionService.isStreamLive()
  if (!isLive) {
    return successResponse({
      processed: false,
      message: 'Stream is offline, skipping queue',
    })
  }

  // Process up to 5 audio items per cron run (since cron is once per minute)
  const results = []
  for (let i = 0; i < 5; i++) {
    const result = await StreamActionService.processAudioQueue()
    if (!result.processed) {
      // No more items to process
      break
    }
    results.push(result)
    // Small delay between processing
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return successResponse({
    processed: results.length,
    results,
  })
})

// Allow Vercel cron to call with GET as well
export const GET = POST
