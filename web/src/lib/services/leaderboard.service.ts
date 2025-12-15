import { prisma } from '../db'

// =============================================================================
// LEADERBOARD SERVICE TYPES
// =============================================================================

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'annual' | 'lifetime'

export type LeaderboardMetric =
  | 'wealthEarned'
  | 'xpEarned'
  | 'playCount'
  | 'robCount'
  | 'robSuccessCount'
  | 'checkins'
  | 'totalContributedUsd'

export interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  kingpinName: string | null
  level: number
  statusTier: string
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
  recordType: string
  userId: number
  username: string
  kingpinName: string | null
  recordValue: bigint
  achievedAt: Date
  previousHolderUsername: string | null
  previousValue: bigint | null
}

export interface SnapshotUpdate {
  wealthEarned?: number
  xpEarned?: number
  playCount?: number
  robCount?: number
  robSuccessCount?: number
  checkins?: number
  cratesOpened?: number
  messagesSent?: number
}

// =============================================================================
// PERIOD CALCULATION
// =============================================================================

function getPeriodBounds(periodType: LeaderboardPeriod): PeriodBounds {
  const now = new Date()

  switch (periodType) {
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
  wealthEarned: 'wealthEarned',
  xpEarned: 'xpEarned',
  playCount: 'playCount',
  robCount: 'robCount',
  robSuccessCount: 'robSuccessCount',
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

    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: {
        periodType: period,
        periodStart: start,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            kingpinName: true,
            level: true,
            statusTier: true,
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
      userId: snapshot.user.id,
      username: snapshot.user.username,
      kingpinName: snapshot.user.kingpinName,
      level: snapshot.user.level,
      statusTier: snapshot.user.statusTier,
      value: snapshot[field as keyof typeof snapshot] as number | bigint,
    }))
  },

  /**
   * Get a user's rank for a specific metric and period
   */
  async getUserRank(
    userId: number,
    metric: LeaderboardMetric,
    period: LeaderboardPeriod
  ): Promise<UserRank | null> {
    const { start } = getPeriodBounds(period)
    const field = METRIC_TO_FIELD[metric]

    // Get user's snapshot
    const userSnapshot = await prisma.leaderboardSnapshot.findUnique({
      where: {
        userId_periodType_periodStart: {
          userId,
          periodType: period,
          periodStart: start,
        },
      },
    })

    if (!userSnapshot) {
      return null
    }

    const userValue = userSnapshot[field as keyof typeof userSnapshot] as number | bigint

    // Count how many users have a higher value
    const higherCount = await prisma.leaderboardSnapshot.count({
      where: {
        periodType: period,
        periodStart: start,
        [field]: { gt: userValue },
      },
    })

    // Count total entries
    const totalEntries = await prisma.leaderboardSnapshot.count({
      where: {
        periodType: period,
        periodStart: start,
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
    userId: number,
    metric: LeaderboardMetric = 'wealthEarned'
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
        results[period] = await this.getUserRank(userId, metric, period)
      })
    )

    return results
  },

  /**
   * Update or create a leaderboard snapshot for a user
   * Called after game actions (play, rob, checkin, etc.)
   */
  async updateSnapshot(userId: number, updates: SnapshotUpdate): Promise<void> {
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'annual', 'lifetime']

    await Promise.all(
      periods.map(async (period) => {
        const { start, end } = getPeriodBounds(period)

        await prisma.leaderboardSnapshot.upsert({
          where: {
            userId_periodType_periodStart: {
              userId,
              periodType: period,
              periodStart: start,
            },
          },
          update: {
            wealthEarned: updates.wealthEarned
              ? { increment: updates.wealthEarned }
              : undefined,
            xpEarned: updates.xpEarned
              ? { increment: updates.xpEarned }
              : undefined,
            playCount: updates.playCount
              ? { increment: updates.playCount }
              : undefined,
            robCount: updates.robCount
              ? { increment: updates.robCount }
              : undefined,
            robSuccessCount: updates.robSuccessCount
              ? { increment: updates.robSuccessCount }
              : undefined,
            checkins: updates.checkins
              ? { increment: updates.checkins }
              : undefined,
            cratesOpened: updates.cratesOpened
              ? { increment: updates.cratesOpened }
              : undefined,
            messagesSent: updates.messagesSent
              ? { increment: updates.messagesSent }
              : undefined,
          },
          create: {
            userId,
            periodType: period,
            periodStart: start,
            periodEnd: end,
            wealthEarned: updates.wealthEarned || 0,
            xpEarned: updates.xpEarned || 0,
            playCount: updates.playCount || 0,
            robCount: updates.robCount || 0,
            robSuccessCount: updates.robSuccessCount || 0,
            checkins: updates.checkins || 0,
            cratesOpened: updates.cratesOpened || 0,
            messagesSent: updates.messagesSent || 0,
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
    const records = await prisma.hallOfFameRecord.findMany({
      include: {
        user: {
          select: {
            username: true,
            kingpinName: true,
          },
        },
        previousHolder: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { recordType: 'asc' },
    })

    return records.map((record) => ({
      recordType: record.recordType,
      userId: record.userId,
      username: record.user.username,
      kingpinName: record.user.kingpinName,
      recordValue: record.recordValue,
      achievedAt: record.achievedAt,
      previousHolderUsername: record.previousHolder?.username || null,
      previousValue: record.previousValue,
    }))
  },

  /**
   * Get a specific Hall of Fame record
   */
  async getHallOfFameRecord(recordType: string): Promise<HallOfFameEntry | null> {
    const record = await prisma.hallOfFameRecord.findUnique({
      where: { recordType },
      include: {
        user: {
          select: {
            username: true,
            kingpinName: true,
          },
        },
        previousHolder: {
          select: {
            username: true,
          },
        },
      },
    })

    if (!record) return null

    return {
      recordType: record.recordType,
      userId: record.userId,
      username: record.user.username,
      kingpinName: record.user.kingpinName,
      recordValue: record.recordValue,
      achievedAt: record.achievedAt,
      previousHolderUsername: record.previousHolder?.username || null,
      previousValue: record.previousValue,
    }
  },

  /**
   * Check and update a Hall of Fame record if new value beats current
   * Returns true if a new record was set
   */
  async checkAndUpdateRecord(
    recordType: string,
    userId: number,
    value: bigint | number
  ): Promise<{ isNewRecord: boolean; previousHolder?: string; previousValue?: bigint }> {
    const bigValue = typeof value === 'number' ? BigInt(value) : value

    const currentRecord = await prisma.hallOfFameRecord.findUnique({
      where: { recordType },
      include: {
        user: {
          select: { username: true },
        },
      },
    })

    // No existing record, create new one
    if (!currentRecord) {
      await prisma.hallOfFameRecord.create({
        data: {
          recordType,
          userId,
          recordValue: bigValue,
        },
      })
      return { isNewRecord: true }
    }

    // Check if new value beats current record
    if (bigValue > currentRecord.recordValue) {
      await prisma.hallOfFameRecord.update({
        where: { recordType },
        data: {
          previousHolderId: currentRecord.userId,
          previousValue: currentRecord.recordValue,
          userId,
          recordValue: bigValue,
          achievedAt: new Date(),
        },
      })

      return {
        isNewRecord: true,
        previousHolder: currentRecord.user.username,
        previousValue: currentRecord.recordValue,
      }
    }

    return { isNewRecord: false }
  },

  /**
   * Check multiple potential records at once
   * Useful after completing a period to check if any records were broken
   */
  async checkPeriodRecords(
    userId: number,
    period: LeaderboardPeriod
  ): Promise<Array<{ recordType: string; isNewRecord: boolean }>> {
    const { start } = getPeriodBounds(period)

    const snapshot = await prisma.leaderboardSnapshot.findUnique({
      where: {
        userId_periodType_periodStart: {
          userId,
          periodType: period,
          periodStart: start,
        },
      },
    })

    if (!snapshot) return []

    const results: Array<{ recordType: string; isNewRecord: boolean }> = []

    // Check daily wealth record
    if (period === 'daily') {
      const wealthResult = await this.checkAndUpdateRecord(
        'highest_daily_wealth',
        userId,
        snapshot.wealthEarned
      )
      results.push({ recordType: 'highest_daily_wealth', isNewRecord: wealthResult.isNewRecord })

      const robResult = await this.checkAndUpdateRecord(
        'most_robs_daily',
        userId,
        BigInt(snapshot.robSuccessCount)
      )
      results.push({ recordType: 'most_robs_daily', isNewRecord: robResult.isNewRecord })
    }

    return results
  },
}

export default LeaderboardService
