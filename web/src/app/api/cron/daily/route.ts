import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services/faction.service'
import { CrateService } from '@/lib/services/crate.service'
import { HeistService } from '@/lib/services/heist.service'
import { NotificationService } from '@/lib/services/notification.service'
import { DiscordService } from '@/lib/services/discord.service'
import { OAuthLinkService } from '@/lib/services/oauth-link.service'
import { HousingService } from '@/lib/services/housing.service'

/**
 * GET /api/cron/daily
 * Daily scheduled jobs - runs at midnight UTC
 *
 * Jobs:
 * 1. Evaluate territory control
 * 2. Cleanup expired crate escrow
 * 3. Cleanup expired heists
 * 4. Cleanup expired notifications
 * 5. Cleanup expired OAuth link states (SEC-01)
 * 6. Process housing upkeep (Design Drift Remediation)
 *
 * Protected by CRON_SECRET (Vercel Cron) or ADMIN_API_KEY
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Verify authorization
  // Vercel Cron sends Authorization header with CRON_SECRET
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

  // 1. Evaluate territory control
  try {
    const territoryChanges = await FactionService.evaluateTerritoryControl()
    results.jobs = {
      ...results.jobs as object,
      territoryControl: {
        success: true,
        changes: territoryChanges.length,
        details: territoryChanges,
      },
    }

    // Post to Discord if territories changed hands
    for (const change of territoryChanges) {
      if (change.newFactionId !== change.previousFactionId) {
        await DiscordService.postTerritoryCapture(
          change.newFactionName || 'Unclaimed',
          change.name,
          change.previousFactionName || undefined
        )
      }
    }
  } catch (error) {
    console.error('Territory control evaluation failed:', error)
    results.jobs = {
      ...results.jobs as object,
      territoryControl: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 2. Cleanup expired crate escrow
  try {
    const expiredCrates = await CrateService.cleanupExpiredEscrow()
    results.jobs = {
      ...results.jobs as object,
      crateEscrowCleanup: {
        success: true,
        expiredCount: expiredCrates,
      },
    }
  } catch (error) {
    console.error('Crate escrow cleanup failed:', error)
    results.jobs = {
      ...results.jobs as object,
      crateEscrowCleanup: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 3. Cleanup expired heists
  try {
    const expiredHeists = await HeistService.checkExpiredHeists()
    results.jobs = {
      ...results.jobs as object,
      heistCleanup: {
        success: true,
        expiredCount: expiredHeists,
      },
    }
  } catch (error) {
    console.error('Heist cleanup failed:', error)
    results.jobs = {
      ...results.jobs as object,
      heistCleanup: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 4. Cleanup expired notifications
  try {
    const expiredNotifications = await NotificationService.cleanupExpired()
    results.jobs = {
      ...results.jobs as object,
      notificationCleanup: {
        success: true,
        expiredCount: expiredNotifications,
      },
    }
  } catch (error) {
    console.error('Notification cleanup failed:', error)
    results.jobs = {
      ...results.jobs as object,
      notificationCleanup: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 5. Cleanup expired OAuth link states (SEC-01)
  try {
    const expiredStates = await OAuthLinkService.cleanupExpiredStates()
    results.jobs = {
      ...results.jobs as object,
      oauthStateCleanup: {
        success: true,
        expiredCount: expiredStates,
      },
    }
  } catch (error) {
    console.error('OAuth state cleanup failed:', error)
    results.jobs = {
      ...results.jobs as object,
      oauthStateCleanup: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 6. Process housing upkeep (Design Drift Remediation)
  try {
    const upkeepSummary = await HousingService.processAllUpkeep()
    results.jobs = {
      ...results.jobs as object,
      housingUpkeep: {
        success: true,
        usersProcessed: upkeepSummary.usersProcessed,
        totalCollected: upkeepSummary.totalUpkeepCollected,
        usersInDebt: upkeepSummary.usersInDebt,
        usersEvicted: upkeepSummary.usersEvicted,
      },
    }
  } catch (error) {
    console.error('Housing upkeep processing failed:', error)
    results.jobs = {
      ...results.jobs as object,
      housingUpkeep: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // Check if any jobs failed
  const jobs = results.jobs as Record<string, { success: boolean }>
  const allSuccessful = Object.values(jobs).every(job => job.success)

  if (!allSuccessful) {
    // Still return 200 so Vercel doesn't retry, but include failure info
    return successResponse({
      ...results,
      status: 'partial_failure',
    })
  }

  return successResponse({
    ...results,
    status: 'success',
  })
})
