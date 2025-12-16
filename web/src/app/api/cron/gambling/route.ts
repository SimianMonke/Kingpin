import { NextRequest } from 'next/server'
import {
  successResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { GamblingService } from '@/lib/services/gambling.service'

/**
 * GET /api/cron/gambling
 * Gambling scheduled jobs - runs every 5 minutes
 *
 * Jobs:
 * 1. Expire old coinflip challenges (10 min expiry)
 * 2. Execute pending lottery draws
 *
 * Protected by CRON_SECRET (Vercel Cron) or ADMIN_API_KEY
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const adminKey = request.headers.get('x-api-key')

  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isAdminAuth = adminKey === process.env.ADMIN_API_KEY

  if (!isVercelCron && !isAdminAuth) {
    return forbiddenResponse('Unauthorized cron request')
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    jobs: {},
  }

  // 1. Expire old coinflip challenges
  try {
    const expiredCount = await GamblingService.expireCoinFlipChallenges()
    results.jobs = {
      ...results.jobs as object,
      coinflipExpiry: {
        success: true,
        expiredCount,
      },
    }
  } catch (error) {
    console.error('Coinflip expiry failed:', error)
    results.jobs = {
      ...results.jobs as object,
      coinflipExpiry: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 2. Check for and execute pending lottery draws
  try {
    const lotteryResult = await GamblingService.checkAndExecuteLotteryDraws()
    results.jobs = {
      ...results.jobs as object,
      lottery_draws: {
        success: true,
        ...lotteryResult,
      },
    }
  } catch (error) {
    console.error('Lottery draw check failed:', error)
    results.jobs = {
      ...results.jobs as object,
      lottery_draws: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // Check if any jobs failed
  const jobs = results.jobs as Record<string, { success: boolean }>
  const allSuccessful = Object.values(jobs).every(job => job.success)

  return successResponse({
    ...results,
    status: allSuccessful ? 'success' : 'partial_failure',
  })
})
