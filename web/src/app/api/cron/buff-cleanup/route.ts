import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { BuffService } from '@/lib/services/buff.service'
import { StreamActionService } from '@/lib/services/stream-action.service'

// =============================================================================
// POST /api/cron/buff-cleanup
// Clean up expired buffs and stream action cooldowns
// Runs hourly via Vercel cron
// =============================================================================

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 401)
  }

  // Clean up expired buffs
  const expiredBuffs = await BuffService.cleanupExpired()

  // Clean up expired stream action cooldowns
  const expiredCooldowns = await StreamActionService.cleanupExpiredCooldowns()

  return successResponse({
    cleanedUp: {
      expiredBuffs,
      expiredCooldowns,
    },
    timestamp: new Date().toISOString(),
  })
})

// Allow Vercel cron to call with GET as well
export const GET = POST
