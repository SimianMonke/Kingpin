import {
  successResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { LeaderboardService } from '@/lib/services/leaderboard.service'

/**
 * GET /api/leaderboards/records
 * Get Hall of Fame records
 *
 * Returns all-time records for various achievements
 */
export const GET = withErrorHandling(async () => {
  const records = await LeaderboardService.getHallOfFameRecords()

  // Format records with readable names
  const formattedRecords = records.map((record) => ({
    ...record,
    recordValue: record.recordValue.toString(),
    previousValue: record.previousValue?.toString() || null,
    displayName: getRecordDisplayName(record.recordType),
    icon: getRecordIcon(record.recordType),
  }))

  return successResponse({
    records: formattedRecords,
  })
})

function getRecordDisplayName(recordType: string): string {
  const names: Record<string, string> = {
    highest_daily_wealth: 'Highest Daily Earnings',
    highest_level: 'Highest Level Achieved',
    longest_streak: 'Longest Check-in Streak',
    most_robs_daily: 'Most Successful Robs (Daily)',
    biggest_single_rob: 'Biggest Single Heist',
    highest_single_donation: 'Largest Donation',
    most_juicernaut_wins: 'Most Juicernaut Wins',
  }
  return names[recordType] || recordType
}

function getRecordIcon(recordType: string): string {
  const icons: Record<string, string> = {
    highest_daily_wealth: '💰',
    highest_level: '⭐',
    longest_streak: '🔥',
    most_robs_daily: '🔫',
    biggest_single_rob: '💎',
    highest_single_donation: '❤️',
    most_juicernaut_wins: '👑',
  }
  return icons[recordType] || '🏆'
}
