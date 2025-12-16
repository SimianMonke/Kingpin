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
    record_value: record.record_value.toString(),
    previous_value: record.previous_value?.toString() || null,
    display_name: getRecordDisplayName(record.record_type),
    icon: getRecordIcon(record.record_type),
  }))

  return successResponse({
    records: formattedRecords,
  })
})

function getRecordDisplayName(record_type: string): string {
  const names: Record<string, string> = {
    highest_daily_wealth: 'Highest Daily Earnings',
    highest_level: 'Highest Level Achieved',
    longest_streak: 'Longest Check-in Streak',
    most_robs_daily: 'Most Successful Robs (Daily)',
    biggest_single_rob: 'Biggest Single Heist',
    highest_single_donation: 'Largest Donation',
    most_juicernaut_wins: 'Most Juicernaut Wins',
  }
  return names[record_type] || record_type
}

function getRecordIcon(record_type: string): string {
  const icons: Record<string, string> = {
    highest_daily_wealth: '💰',
    highest_level: '⭐',
    longest_streak: '🔥',
    most_robs_daily: '🔫',
    biggest_single_rob: '💎',
    highest_single_donation: '❤️',
    most_juicernaut_wins: '👑',
  }
  return icons[record_type] || '🏆'
}
