import { prisma } from '../db'
import { Prisma } from '@prisma/client'

// Use Prisma.Decimal for database-compatible decimal values
const Decimal = Prisma.Decimal
import {
  JUICERNAUT_BUFF_CONFIG,
  JUICERNAUT_BUFF_TYPES,
  JUICERNAUT_SESSION_REWARDS,
  CRATE_TIERS,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  type MonetizationPlatform,
  type MonetizationEventType,
} from '../game'
import { UserService } from './user.service'
import { AchievementService } from './achievement.service'
import { HeistService } from './heist.service'
import { NotificationService } from './notification.service'
import { DiscordService } from './discord.service'
import { LumiaService } from './lumia.service'

// =============================================================================
// JUICERNAUT TYPES
// =============================================================================

export interface SessionLeaderboardEntry {
  rank: number
  userId: number
  username: string
  displayName: string | null
  totalUsd: number
  contributionCount: number
  isJuicernaut: boolean
}

export interface ActiveSessionInfo {
  id: number
  title: string | null
  platform: string
  isActive: boolean
  startedAt: Date
  totalContributionsUsd: number
  currentJuicernaut: {
    id: number
    username: string
    displayName: string | null
    totalUsd: number
  } | null
}

export interface SessionWinnerRewards {
  wealth: number
  xp: number
  crateTier: string | null
}

// =============================================================================
// JUICERNAUT SERVICE
// =============================================================================

export const JuicernautService = {
  // ===========================================================================
  // SESSION LIFECYCLE
  // ===========================================================================

  /**
   * Start a new streaming session
   */
  async startSession(platform: string, title?: string): Promise<ActiveSessionInfo> {
    // End any existing active sessions first
    const existingSessions = await prisma.streamingSession.findMany({
      where: { isActive: true },
    })

    for (const session of existingSessions) {
      await this.endSession(session.id)
    }

    // Create new session
    const session = await prisma.streamingSession.create({
      data: {
        platform,
        sessionTitle: title || `${platform} Stream`,
        isActive: true,
      },
    })

    // Schedule first heist alert (15+ minutes after session start)
    await HeistService.scheduleNextHeist(session.id, true)

    // Trigger Lumia and Discord notifications for session start
    await LumiaService.triggerSessionStart(session.id, platform, title)
    await DiscordService.postSessionStart(session.id, platform, title)

    return {
      id: session.id,
      title: session.sessionTitle,
      platform: session.platform,
      isActive: session.isActive,
      startedAt: session.startedAt,
      totalContributionsUsd: 0,
      currentJuicernaut: null,
    }
  },

  /**
   * End a streaming session and distribute rewards
   */
  async endSession(sessionId: number): Promise<{
    winnerId: number | null
    winnerUsername: string | null
    totalContributedUsd: number
    rewards: SessionWinnerRewards | null
  }> {
    const session = await prisma.streamingSession.findUnique({
      where: { id: sessionId },
      include: {
        currentJuicernaut: true,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (!session.isActive) {
      throw new Error('Session is already ended')
    }

    // Get the winner (current Juicernaut at end of session)
    let winnerId: number | null = null
    let winnerUsername: string | null = null
    let rewards: SessionWinnerRewards | null = null
    let totalContributedUsd = 0

    if (session.currentJuicernautUserId) {
      winnerId = session.currentJuicernautUserId
      winnerUsername = session.currentJuicernaut?.username || null

      // Calculate winner's total contribution
      const winnerTotal = await this.getUserSessionTotal(sessionId, winnerId)
      totalContributedUsd = winnerTotal

      // Calculate rewards based on total contribution
      rewards = this.calculateWinnerRewards(totalContributedUsd)

      // Get contribution count
      const contributionCount = await prisma.sessionContribution.count({
        where: {
          sessionId,
          userId: winnerId,
        },
      })

      // Record winner
      await prisma.juicernautWinner.create({
        data: {
          sessionId,
          userId: winnerId,
          totalContributedUsd: new Decimal(totalContributedUsd),
          contributionsCount: contributionCount,
          rewardWealth: rewards.wealth,
          rewardXp: rewards.xp,
          bonusCrateTier: rewards.crateTier,
        },
      })

      // Distribute rewards to winner
      await UserService.addWealth(winnerId, rewards.wealth)
      await UserService.addXp(winnerId, rewards.xp)

      // Award crate if earned
      if (rewards.crateTier) {
        await prisma.userCrate.create({
          data: {
            userId: winnerId,
            crateTier: rewards.crateTier,
            source: 'juicernaut',
          },
        })
      }

      // Remove Juicernaut buffs from winner
      await this.removeJuicernautBuffs(winnerId)

      // Update achievement progress
      await AchievementService.incrementProgress(
        winnerId,
        ACHIEVEMENT_REQUIREMENT_TYPES.JUICERNAUT_WINS,
        1
      )
    }

    // Calculate total session contributions
    const sessionTotal = await prisma.sessionContribution.aggregate({
      where: { sessionId },
      _sum: { usdValue: true },
    })

    // Clear heist schedule for this session
    await HeistService.clearSchedule(sessionId)

    // Expire any active heists
    await HeistService.checkExpiredHeists()

    // Mark session as ended
    await prisma.streamingSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
        totalContributionsUsd: sessionTotal._sum.usdValue || new Decimal(0),
      },
    })

    // Get session duration for notifications
    const durationMinutes = Math.round((Date.now() - session.startedAt.getTime()) / 60000)
    const totalSessionUsd = Number(sessionTotal._sum.usdValue || 0)

    // Count contributors
    const contributorCount = await prisma.sessionContribution.groupBy({
      by: ['userId'],
      where: { sessionId },
    })

    // Count heists
    const heistCount = await prisma.heistEvent.count({
      where: { sessionId },
    })

    // Trigger session end notifications
    const sessionStats = {
      totalContributionsUsd: totalSessionUsd,
      totalContributors: contributorCount.length,
      winnerName: winnerUsername ?? undefined,
      winnerContributionUsd: totalContributedUsd || undefined,
      durationMinutes,
      totalHeists: heistCount,
    }

    await LumiaService.triggerSessionEnd(sessionId, sessionStats)
    await DiscordService.postSessionSummary(sessionId, sessionStats)

    // Notify winner of session rewards
    if (winnerId && rewards) {
      await NotificationService.notifyJuicernautReward(
        winnerId,
        rewards.wealth,
        rewards.xp,
        rewards.crateTier ?? undefined
      )
    }

    return {
      winnerId,
      winnerUsername,
      totalContributedUsd,
      rewards,
    }
  },

  /**
   * Get the currently active session
   */
  async getActiveSession(): Promise<ActiveSessionInfo | null> {
    const session = await prisma.streamingSession.findFirst({
      where: { isActive: true },
      include: {
        currentJuicernaut: true,
      },
    })

    if (!session) return null

    let juicernautTotal = 0
    if (session.currentJuicernautUserId) {
      juicernautTotal = await this.getUserSessionTotal(session.id, session.currentJuicernautUserId)
    }

    return {
      id: session.id,
      title: session.sessionTitle,
      platform: session.platform,
      isActive: session.isActive,
      startedAt: session.startedAt,
      totalContributionsUsd: Number(session.totalContributionsUsd),
      currentJuicernaut: session.currentJuicernaut
        ? {
            id: session.currentJuicernaut.id,
            username: session.currentJuicernaut.username,
            displayName: session.currentJuicernaut.displayName,
            totalUsd: juicernautTotal,
          }
        : null,
    }
  },

  // ===========================================================================
  // CONTRIBUTIONS
  // ===========================================================================

  /**
   * Process a contribution to the active session
   */
  async processContribution(
    userId: number,
    platform: MonetizationPlatform,
    contributionType: MonetizationEventType,
    quantity: number,
    usdValue: number,
    monetizationEventId?: number
  ): Promise<{ addedToSession: boolean; crownChanged: boolean; newJuicernautId?: number }> {
    const session = await prisma.streamingSession.findFirst({
      where: { isActive: true },
    })

    if (!session) {
      return { addedToSession: false, crownChanged: false }
    }

    // Add contribution record
    await prisma.sessionContribution.create({
      data: {
        sessionId: session.id,
        userId,
        platform,
        contributionType,
        quantity,
        usdValue: new Decimal(usdValue),
        monetizationEventId,
      },
    })

    // Update session total
    await prisma.streamingSession.update({
      where: { id: session.id },
      data: {
        totalContributionsUsd: {
          increment: new Decimal(usdValue),
        },
      },
    })

    // Get user's new total for this session
    const userTotal = await this.getUserSessionTotal(session.id, userId)

    // Check for crown change
    const crownResult = await this.checkCrownChange(session.id, userId, userTotal)

    return {
      addedToSession: true,
      crownChanged: crownResult.changed,
      newJuicernautId: crownResult.changed ? userId : undefined,
    }
  },

  /**
   * Get a user's total contribution for a session
   */
  async getUserSessionTotal(sessionId: number, userId: number): Promise<number> {
    const result = await prisma.sessionContribution.aggregate({
      where: {
        sessionId,
        userId,
      },
      _sum: {
        usdValue: true,
      },
    })

    return Number(result._sum.usdValue || 0)
  },

  /**
   * Get session leaderboard
   */
  async getSessionLeaderboard(sessionId: number, limit = 10): Promise<SessionLeaderboardEntry[]> {
    const session = await prisma.streamingSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) return []

    // Aggregate contributions by user
    const contributions = await prisma.sessionContribution.groupBy({
      by: ['userId'],
      where: { sessionId },
      _sum: { usdValue: true },
      _count: true,
      orderBy: {
        _sum: {
          usdValue: 'desc',
        },
      },
      take: limit,
    })

    // Fetch user details
    const userIds = contributions.map((c) => c.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    return contributions.map((c, index) => {
      const user = userMap.get(c.userId)
      return {
        rank: index + 1,
        userId: c.userId,
        username: user?.username || 'Unknown',
        displayName: user?.displayName || null,
        totalUsd: Number(c._sum.usdValue || 0),
        contributionCount: c._count,
        isJuicernaut: c.userId === session.currentJuicernautUserId,
      }
    })
  },

  // ===========================================================================
  // CROWN MECHANICS
  // ===========================================================================

  /**
   * Check if crown should change and handle transfer if needed
   */
  async checkCrownChange(
    sessionId: number,
    contributorId: number,
    contributorTotal: number
  ): Promise<{ changed: boolean; previousJuicernautId?: number }> {
    const session = await prisma.streamingSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) return { changed: false }

    // First contribution - crown them
    if (!session.currentJuicernautUserId) {
      await this.transferCrown(sessionId, null, contributorId, contributorTotal)
      return { changed: true }
    }

    // Same user is already Juicernaut
    if (session.currentJuicernautUserId === contributorId) {
      return { changed: false }
    }

    // Check if contributor now has more than current Juicernaut
    const currentJuicernautTotal = await this.getUserSessionTotal(
      sessionId,
      session.currentJuicernautUserId
    )

    if (contributorTotal > currentJuicernautTotal) {
      await this.transferCrown(
        sessionId,
        session.currentJuicernautUserId,
        contributorId,
        contributorTotal
      )
      return { changed: true, previousJuicernautId: session.currentJuicernautUserId }
    }

    return { changed: false }
  },

  /**
   * Transfer the Juicernaut crown from one user to another
   */
  async transferCrown(
    sessionId: number,
    oldUserId: number | null,
    newUserId: number,
    newTotal: number
  ): Promise<void> {
    // Remove buffs from old Juicernaut
    if (oldUserId) {
      await this.removeJuicernautBuffs(oldUserId)
    }

    // Apply buffs to new Juicernaut
    await this.applyJuicernautBuffs(newUserId)

    // Update session
    await prisma.streamingSession.update({
      where: { id: sessionId },
      data: { currentJuicernautUserId: newUserId },
    })

    // Log crown change
    await prisma.juicernautCrownChange.create({
      data: {
        sessionId,
        previousJuicernautUserId: oldUserId,
        newJuicernautUserId: newUserId,
        newTotalUsd: new Decimal(newTotal),
      },
    })

    // Get usernames for notifications
    const [newUser, oldUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: newUserId },
        select: { username: true, kingpinName: true },
      }),
      oldUserId ? prisma.user.findUnique({
        where: { id: oldUserId },
        select: { username: true, kingpinName: true },
      }) : null,
    ])

    const newHolderName = newUser?.kingpinName || newUser?.username || 'Unknown'
    const oldHolderName = oldUser ? (oldUser.kingpinName || oldUser.username) : null

    // Notify new Juicernaut
    await NotificationService.notifyJuicernautCrown(newUserId, newTotal)

    // Notify old Juicernaut they lost the crown
    if (oldUserId) {
      await NotificationService.notifyJuicernautDethroned(oldUserId, newHolderName)
    }

    // Post to Discord admin channel
    await DiscordService.postCrownChange(newHolderName, oldHolderName, newTotal)

    // Trigger Lumia Stream alert
    await LumiaService.triggerCrownChange(newHolderName, oldHolderName, newTotal)
  },

  // ===========================================================================
  // BUFF MANAGEMENT
  // ===========================================================================

  /**
   * Apply all Juicernaut buffs to a user
   */
  async applyJuicernautBuffs(userId: number): Promise<void> {
    for (const buff of JUICERNAUT_BUFF_CONFIG) {
      await prisma.activeBuff.upsert({
        where: {
          userId_buffType: {
            userId,
            buffType: buff.type,
          },
        },
        update: {
          multiplier: new Decimal(buff.multiplier),
          description: buff.description,
          isActive: true,
          activatedAt: new Date(),
          expiresAt: null, // Juicernaut buffs don't expire until session ends
        },
        create: {
          userId,
          buffType: buff.type,
          multiplier: new Decimal(buff.multiplier),
          description: buff.description,
          isActive: true,
          expiresAt: null,
        },
      })
    }
  },

  /**
   * Remove all Juicernaut buffs from a user
   */
  async removeJuicernautBuffs(userId: number): Promise<void> {
    await prisma.activeBuff.updateMany({
      where: {
        userId,
        buffType: {
          startsWith: 'juicernaut_',
        },
      },
      data: {
        isActive: false,
      },
    })
  },

  /**
   * Check if a user has a specific Juicernaut buff active
   */
  async hasJuicernautBuff(
    userId: number,
    buffType: (typeof JUICERNAUT_BUFF_TYPES)[keyof typeof JUICERNAUT_BUFF_TYPES]
  ): Promise<boolean> {
    const buff = await prisma.activeBuff.findFirst({
      where: {
        userId,
        buffType,
        isActive: true,
      },
    })
    return !!buff
  },

  /**
   * Get a user's active Juicernaut buff multiplier
   */
  async getBuffMultiplier(
    userId: number,
    buffType: (typeof JUICERNAUT_BUFF_TYPES)[keyof typeof JUICERNAUT_BUFF_TYPES]
  ): Promise<number> {
    const buff = await prisma.activeBuff.findFirst({
      where: {
        userId,
        buffType,
        isActive: true,
      },
    })
    return buff?.multiplier ? Number(buff.multiplier) : 1.0
  },

  // ===========================================================================
  // REWARDS
  // ===========================================================================

  /**
   * Calculate end-of-session rewards based on total contribution
   */
  calculateWinnerRewards(totalContributedUsd: number): SessionWinnerRewards {
    // Find the matching tier from highest to lowest
    const sortedTiers = [...JUICERNAUT_SESSION_REWARDS.TIERS].sort(
      (a, b) => b.minUsd - a.minUsd
    )

    for (const tier of sortedTiers) {
      if (totalContributedUsd >= tier.minUsd) {
        return {
          wealth: tier.wealth,
          xp: tier.xp,
          crateTier: tier.crate,
        }
      }
    }

    // Default to lowest tier
    const lowestTier = JUICERNAUT_SESSION_REWARDS.TIERS[0]
    return {
      wealth: lowestTier.wealth,
      xp: lowestTier.xp,
      crateTier: lowestTier.crate,
    }
  },

  // ===========================================================================
  // HALL OF FAME
  // ===========================================================================

  /**
   * Get Juicernaut hall of fame (all-time winners)
   */
  async getHallOfFame(limit = 10) {
    // Get top winners by total contributed
    const topWinners = await prisma.juicernautWinner.findMany({
      orderBy: { totalContributedUsd: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, displayName: true },
        },
        session: {
          select: { sessionTitle: true, platform: true, startedAt: true },
        },
      },
    })

    // Get win counts per user
    const winCounts = await prisma.juicernautWinner.groupBy({
      by: ['userId'],
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    })

    const winCountUserIds = winCounts.map((w) => w.userId)
    const winCountUsers = await prisma.user.findMany({
      where: { id: { in: winCountUserIds } },
      select: { id: true, username: true, displayName: true },
    })
    const winCountUserMap = new Map(winCountUsers.map((u) => [u.id, u]))

    return {
      topContributors: topWinners.map((w) => ({
        userId: w.userId,
        username: w.user.username,
        displayName: w.user.displayName,
        totalContributedUsd: Number(w.totalContributedUsd),
        sessionTitle: w.session.sessionTitle,
        platform: w.session.platform,
        wonAt: w.wonAt,
      })),
      mostWins: winCounts.map((w) => ({
        userId: w.userId,
        username: winCountUserMap.get(w.userId)?.username || 'Unknown',
        displayName: winCountUserMap.get(w.userId)?.displayName || null,
        wins: w._count,
      })),
    }
  },

  /**
   * Get crown change history for a session
   */
  async getCrownHistory(sessionId: number) {
    return prisma.juicernautCrownChange.findMany({
      where: { sessionId },
      orderBy: { changedAt: 'asc' },
      include: {
        previousJuicernaut: {
          select: { id: true, username: true, displayName: true },
        },
        newJuicernaut: {
          select: { id: true, username: true, displayName: true },
        },
      },
    })
  },
}

export default JuicernautService
