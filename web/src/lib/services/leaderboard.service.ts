import { prisma } from '../db'

// =============================================================================
// LEADERBOARD SERVICE TYPES
// =============================================================================

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'annual' | 'lifetime'

export type LeaderboardMetric =
  | 'wealth_earned'
  | 'xp_earned'
  | 'play_count'
  | 'rob_count'
  | 'rob_success_count'
  | 'checkins'
  | 'totalContributedUsd'

export interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string
  kingpin_name: string | null
  level: number
  status_tier: string
  value: number | bigint
}

export interface UserRank {
  rank: number
  value: number | bigint
  totalEntries: number
}

export interface PeriodBounds {
  start: Date
  end: Date
}

export interface HallOfFameEntry {
  record_type: string
  user_id: number
  username: string
  kingpin_name: string | null
  record_value: bigint
  achieved_at: Date | null
  previousHolderUsername: string | null
  previous_value: bigint | null
}

export interface SnapshotUpdate {
  wealth_earned?: number
  xp_earned?: number
  play_count?: number
  rob_count?: number
  rob_success_count?: number
  checkins?: number
  crates_opened?: number
  messages_sent?: number
}

// =============================================================================
// PERIOD CALCULATION
// =============================================================================

function getPeriodBounds(period_type: LeaderboardPeriod): PeriodBounds {
  const now = new Date()

  switch (period_type) {
    case 'daily': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const end = new Date(start.getTime() + 86400000 - 1)
      return { start, end }
    }

    case 'weekly': {
      const weekStart = new Date(now)
      weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())
      weekStart.setUTCHours(0, 0, 0, 0)
      const end = new Date(weekStart.getTime() + 604800000 - 1)
      return { start: weekStart, end }
    }

    case 'monthly': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
      return { start, end }
    }

    case 'annual': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999))
      return { start, end }
    }

    case 'lifetime': {
      return {
        start: new Date('2025-01-01'),
        end: new Date('2099-12-31'),
      }
    }
  }
}

// Map metric names to Prisma field names for ordering
const METRIC_TO_FIELD: Record<LeaderboardMetric, string> = {
  wealth_earned: 'wealth_earned',
  xp_earned: 'xp_earned',
  play_count: 'play_count',
  rob_count: 'rob_count',
  rob_success_count: 'rob_success_count',
  checkins: 'checkins',
  totalContributedUsd: 'totalContributedUsd',
}

// =============================================================================
// LEADERBOARD SERVICE
// =============================================================================

export const LeaderboardService = {
  /**
   * Get period boundaries for a given period type
   */
  getPeriodBounds,

  /**
   * Get leaderboard for a specific metric and period
   */
  async getLeaderboard(
    metric: LeaderboardMetric,
    period: LeaderboardPeriod,
    limit: number = 10,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    const { start } = getPeriodBounds(period)
    const field = METRIC_TO_FIELD[metric]

    const snapshots = await prisma.leaderboard_snapshots.findMany({
      where: {
        period_type: period,
        period_start: start,
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            kingpin_name: true,
            level: true,
            status_tier: true,
          },
        },
      },
      orderBy: {
        [field]: 'desc',
      },
      skip: offset,
      take: limit,
    })

    return snapshots.map((snapshot, index) => ({
      rank: offset + index + 1,
      user_id: snapshot.users.id,
      username: snapshot.users.username,
      kingpin_name: snapshot.users.kingpin_name,
      level: snapshot.users.level ?? 1,
      status_tier: snapshot.users.status_tier ?? 'Punk',
      value: snapshot[field as keyof typeof snapshot] as number | bigint,
    }))
  },

  /**
   * Get a user's rank for a specific metric and period
   */
  async getUserRank(
    user_id: number,
    metric: LeaderboardMetric,
    period: LeaderboardPeriod
  ): Promise<UserRank | null> {
    const { start } = getPeriodBounds(period)
    const field = METRIC_TO_FIELD[metric]

    // Get user's snapshot
    const userSnapshot = await prisma.leaderboard_snapshots.findUnique({
      where: {
        user_id_period_type_period_start: {
          user_id,
          period_type: period,
          period_start: start,
        },
      },
    })

    if (!userSnapshot) {
      return null
    }

    const userValue = userSnapshot[field as keyof typeof userSnapshot] as number | bigint

    // Count how many users have a higher value
    const higherCount = await prisma.leaderboard_snapshots.count({
      where: {
        period_type: period,
        period_start: start,
        [field]: { gt: userValue },
      },
    })

    // Count total entries
    const totalEntries = await prisma.leaderboard_snapshots.count({
      where: {
        period_type: period,
        period_start: start,
      },
    })

    return {
      rank: higherCount + 1,
      value: userValue,
      totalEntries,
    }
  },

  /**
   * Get all of a user's ranks across periods
   */
  async getUserRanks(
    user_id: number,
    metric: LeaderboardMetric = 'wealth_earned'
  ): Promise<Record<LeaderboardPeriod, UserRank | null>> {
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'lifetime']
    const results: Record<LeaderboardPeriod, UserRank | null> = {
      daily: null,
      weekly: null,
      monthly: null,
      annual: null,
      lifetime: null,
    }

    await Promise.all(
      periods.map(async (period) => {
        results[period] = await this.getUserRank(user_id, metric, period)
      })
    )

    return results
  },

  /**
   * Update or create a leaderboard snapshot for a user
   * Called after game actions (play, rob, checkin, etc.)
   */
  async updateSnapshot(user_id: number, updates: SnapshotUpdate): Promise<void> {
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'annual', 'lifetime']

    await Promise.all(
      periods.map(async (period) => {
        const { start, end } = getPeriodBounds(period)

        await prisma.leaderboard_snapshots.upsert({
          where: {
            user_id_period_type_period_start: {
              user_id,
              period_type: period,
              period_start: start,
            },
          },
          update: {
            wealth_earned: updates.wealth_earned
              ? { increment: updates.wealth_earned }
              : undefined,
            xp_earned: updates.xp_earned
              ? { increment: updates.xp_earned }
              : undefined,
            play_count: updates.play_count
              ? { increment: updates.play_count }
              : undefined,
            rob_count: updates.rob_count
              ? { increment: updates.rob_count }
              : undefined,
            rob_success_count: updates.rob_success_count
              ? { increment: updates.rob_success_count }
              : undefined,
            checkins: updates.checkins
              ? { increment: updates.checkins }
              : undefined,
            crates_opened: updates.crates_opened
              ? { increment: updates.crates_opened }
              : undefined,
            messages_sent: updates.messages_sent
              ? { increment: updates.messages_sent }
              : undefined,
          },
          create: {
            user_id,
            period_type: period,
            period_start: start,
            period_end: end,
            wealth_earned: updates.wealth_earned || 0,
            xp_earned: updates.xp_earned || 0,
            play_count: updates.play_count || 0,
            rob_count: updates.rob_count || 0,
            rob_success_count: updates.rob_success_count || 0,
            checkins: updates.checkins || 0,
            crates_opened: updates.crates_opened || 0,
            messages_sent: updates.messages_sent || 0,
          },
        })
      })
    )
  },

  // ===========================================================================
  // HALL OF FAME
  // ===========================================================================

  /**
   * Get all Hall of Fame records
   */
  async getHallOfFameRecords(): Promise<HallOfFameEntry[]> {
    const records = await prisma.hall_of_fame_records.findMany({
      include: {
        users_hall_of_fame_records_user_idTousers: {
          select: {
            username: true,
            kingpin_name: true,
          },
        },
        users_hall_of_fame_records_previous_holder_idTousers: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { record_type: 'asc' },
    })

    return records.map((record) => ({
      record_type: record.record_type,
      user_id: record.user_id ?? 0,
      username: record.users_hall_of_fame_records_user_idTousers?.username || 'Unknown',
      kingpin_name: record.users_hall_of_fame_records_user_idTousers?.kingpin_name || null,
      record_value: record.record_value,
      achieved_at: record.achieved_at,
      previousHolderUsername: record.users_hall_of_fame_records_previous_holder_idTousers?.username || null,
      previous_value: record.previous_value,
    }))
  },

  /**
   * Get a specific Hall of Fame record
   */
  async getHallOfFameRecord(record_type: string): Promise<HallOfFameEntry | null> {
    const record = await prisma.hall_of_fame_records.findUnique({
      where: { record_type },
      include: {
        users_hall_of_fame_records_user_idTousers: {
          select: {
            username: true,
            kingpin_name: true,
          },
        },
        users_hall_of_fame_records_previous_holder_idTousers: {
          select: {
            username: true,
          },
        },
      },
    })

    if (!record) return null

    return {
      record_type: record.record_type,
      user_id: record.user_id ?? 0,
      username: record.users_hall_of_fame_records_user_idTousers?.username || 'Unknown',
      kingpin_name: record.users_hall_of_fame_records_user_idTousers?.kingpin_name || null,
      record_value: record.record_value,
      achieved_at: record.achieved_at,
      previousHolderUsername: record.users_hall_of_fame_records_previous_holder_idTousers?.username || null,
      previous_value: record.previous_value,
    }
  },

  /**
   * Check and update a Hall of Fame record if new value beats current
   * Returns true if a new record was set
   */
  async checkAndUpdateRecord(
    record_type: string,
    user_id: number,
    value: bigint | number
  ): Promise<{ isNewRecord: boolean; previousHolder?: string; previous_value?: bigint }> {
    const bigValue = typeof value === 'number' ? BigInt(value) : value

    const currentRecord = await prisma.hall_of_fame_records.findUnique({
      where: { record_type },
      include: {
        users_hall_of_fame_records_user_idTousers: {
          select: { username: true },
        },
      },
    })

    // No existing record, create new one
    if (!currentRecord) {
      await prisma.hall_of_fame_records.create({
        data: {
          record_type,
          user_id,
          record_value: bigValue,
        },
      })
      return { isNewRecord: true }
    }

    // Check if new value beats current record
    if (bigValue > currentRecord.record_value) {
      await prisma.hall_of_fame_records.update({
        where: { record_type },
        data: {
          previous_holder_id: currentRecord.user_id,
          previous_value: currentRecord.record_value,
          user_id,
          record_value: bigValue,
          achieved_at: new Date(),
        },
      })

      return {
        isNewRecord: true,
        previousHolder: currentRecord.users_hall_of_fame_records_user_idTousers?.username,
        previous_value: currentRecord.record_value,
      }
    }

    return { isNewRecord: false }
  },

  /**
   * Check multiple potential records at once
   * Useful after completing a period to check if any records were broken
   */
  async checkPeriodRecords(
    user_id: number,
    period: LeaderboardPeriod
  ): Promise<Array<{ record_type: string; isNewRecord: boolean }>> {
    const { start } = getPeriodBounds(period)

    const snapshot = await prisma.leaderboard_snapshots.findUnique({
      where: {
        user_id_period_type_period_start: {
          user_id,
          period_type: period,
          period_start: start,
        },
      },
    })

    if (!snapshot) return []

    const results: Array<{ record_type: string; isNewRecord: boolean }> = []

    // Check daily wealth record
    if (period === 'daily') {
      const wealthResult = await this.checkAndUpdateRecord(
        'highest_daily_wealth',
        user_id,
        snapshot.wealth_earned ?? BigInt(0)
      )
      results.push({ record_type: 'highest_daily_wealth', isNewRecord: wealthResult.isNewRecord })

      const robResult = await this.checkAndUpdateRecord(
        'most_robs_daily',
        user_id,
        BigInt(snapshot.rob_success_count ?? 0)
      )
      results.push({ record_type: 'most_robs_daily', isNewRecord: robResult.isNewRecord })
    }

    return results
  },
}

export default LeaderboardService
