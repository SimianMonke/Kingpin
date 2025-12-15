import { NextRequest } from 'next/server'
import {
  successResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services/faction.service'
import { NotificationService } from '@/lib/services/notification.service'
import { DiscordService } from '@/lib/services/discord.service'
import { prisma } from '@/lib/db'

/**
 * GET /api/cron/weekly
 * Weekly scheduled jobs - runs Sunday midnight UTC
 *
 * Jobs:
 * 1. Distribute faction weekly rewards
 * 2. Post weekly faction winner to Discord
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

  // 1. Distribute faction weekly rewards
  try {
    const rewardResults = await FactionService.distributeWeeklyRewards()

    // Notify all rewarded users
    for (const reward of rewardResults) {
      // Get user's faction name
      const user = await prisma.user.findUnique({
        where: { id: reward.userId },
        include: { faction: { select: { factionName: true } } },
      })

      if (user?.faction) {
        await NotificationService.notifyFactionReward(
          reward.userId,
          user.faction.factionName,
          reward.wealth,
          reward.xp
        )
      }
    }

    results.jobs = {
      ...results.jobs as object,
      factionRewards: {
        success: true,
        playersRewarded: rewardResults.length,
        totalWealth: rewardResults.reduce((sum, r) => sum + r.wealth, 0),
        totalXp: rewardResults.reduce((sum, r) => sum + r.xp, 0),
        cratesAwarded: rewardResults.filter(r => r.crateAwarded).length,
      },
    }
  } catch (error) {
    console.error('Faction reward distribution failed:', error)
    results.jobs = {
      ...results.jobs as object,
      factionRewards: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // 2. Post weekly faction winner to Discord
  try {
    const standings = await FactionService.getFactionStandings()

    if (standings.factions.length > 0) {
      const winner = standings.factions[0]

      await DiscordService.postWeeklyFactionWinner(
        winner.name,
        winner.territoriesControlled,
        winner.weeklyScore
      )

      results.jobs = {
        ...results.jobs as object,
        weeklyWinnerPost: {
          success: true,
          winner: winner.name,
          territories: winner.territoriesControlled,
          score: winner.weeklyScore,
        },
      }
    } else {
      results.jobs = {
        ...results.jobs as object,
        weeklyWinnerPost: {
          success: true,
          message: 'No faction standings to post',
        },
      }
    }
  } catch (error) {
    console.error('Weekly winner post failed:', error)
    results.jobs = {
      ...results.jobs as object,
      weeklyWinnerPost: {
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
