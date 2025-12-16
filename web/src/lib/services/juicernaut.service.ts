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
  user_id: number
  username: string
  display_name: string | null
  totalUsd: number
  contributionCount: number
  isJuicernaut: boolean
}

export interface ActiveSessionInfo {
  id: number
  title: string | null
  platform: string
  is_active: boolean
  started_at: Date
  total_contributions_usd: number
  current_juicernaut: {
    id: number
    username: string
    display_name: string | null
    totalUsd: number
  } | null
}

export interface SessionWinnerRewards {
  wealth: number
  xp: number
  crate_tier: string | null
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
    const existingSessions = await prisma.streaming_sessions.findMany({
      where: { is_active: true },
    })

    for (const session of existingSessions) {
      await this.endSession(session.id)
    }

    // Create new session
    const session = await prisma.streaming_sessions.create({
      data: {
        platform,
        session_title: title || `${platform} Stream`,
        is_active: true,
      },
    })

    // Schedule first heist alert (15+ minutes after session start)
    await HeistService.scheduleNextHeist(session.id, true)

    // Trigger Lumia and Discord notifications for session start
    await LumiaService.triggerSessionStart(session.id, platform, title)
    await DiscordService.postSessionStart(session.id, platform, title)

    return {
      id: session.id,
      title: session.session_title,
      platform: session.platform,
      is_active: session.is_active ?? false,
      started_at: session.started_at ?? new Date(),
      total_contributions_usd: 0,
      current_juicernaut: null,
    }
  },

  /**
   * End a streaming session and distribute rewards
   */
  async endSession(session_id: number): Promise<{
    winner_id: number | null
    winnerUsername: string | null
    totalContributedUsd: number
    rewards: SessionWinnerRewards | null
  }> {
    const session = await prisma.streaming_sessions.findUnique({
      where: { id: session_id },
      include: {
        users: true,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (!session.is_active) {
      throw new Error('Session is already ended')
    }

    // Get the winner (current Juicernaut at end of session)
    let winner_id: number | null = null
    let winnerUsername: string | null = null
    let rewards: SessionWinnerRewards | null = null
    let totalContributedUsd = 0

    if (session.current_juicernaut_user_id) {
      winner_id = session.current_juicernaut_user_id
      winnerUsername = session.users?.username || null

      // Calculate winner's total contribution
      const winnerTotal = await this.getUserSessionTotal(session_id, winner_id)
      totalContributedUsd = winnerTotal

      // Calculate rewards based on total contribution
      rewards = this.calculateWinnerRewards(totalContributedUsd)

      // Get contribution count
      const contributionCount = await prisma.session_contributions.count({
        where: {
          session_id,
          user_id: winner_id,
        },
      })

      // Record winner (juicernautWinner model not in current schema)
      // Winners are tracked via game_events instead
      await prisma.game_events.create({
        data: {
          user_id: winner_id,
          event_type: 'juicernaut_win',
          wealth_change: rewards.wealth,
          xp_change: rewards.xp,
          event_description: `Won Juicernaut for session ${session_id} with $${totalContributedUsd.toFixed(2)} in contributions`,
          success: true,
        },
      })

      // Distribute rewards to winner
      await UserService.addWealth(winner_id, rewards.wealth)
      await UserService.addXp(winner_id, rewards.xp)

      // Award crate if earned
      if (rewards.crate_tier) {
        await prisma.user_crates.create({
          data: {
            user_id: winner_id,
            tier: rewards.crate_tier,
            source: 'juicernaut',
          },
        })
      }

      // Remove Juicernaut buffs from winner
      await this.removeJuicernautBuffs(winner_id)

      // Update achievement progress
      await AchievementService.incrementProgress(
        winner_id,
        ACHIEVEMENT_REQUIREMENT_TYPES.JUICERNAUT_WINS,
        1
      )
    }

    // Calculate total session contributions
    const sessionTotal = await prisma.session_contributions.aggregate({
      where: { session_id },
      _sum: { usd_value: true },
    })

    // Clear heist schedule for this session
    await HeistService.clearSchedule(session_id)

    // Expire any active heists
    await HeistService.checkExpiredHeists()

    // Mark session as ended
    await prisma.streaming_sessions.update({
      where: { id: session_id },
      data: {
        is_active: false,
        ended_at: new Date(),
        total_contributions_usd: sessionTotal._sum.usd_value || new Decimal(0),
      },
    })

    // Get session duration for notifications
    const durationMinutes = Math.round((Date.now() - (session.started_at?.getTime() ?? Date.now())) / 60000)
    const totalSessionUsd = Number(sessionTotal._sum.usd_value || 0)

    // Count contributors
    const contributorCount = await prisma.session_contributions.groupBy({
      by: ['user_id'],
      where: { session_id },
    })

    // Count heists
    const heistCount = await prisma.heist_events.count({
      where: { session_id },
    })

    // Trigger session end notifications
    const sessionStats = {
      total_contributions_usd: totalSessionUsd,
      totalContributors: contributorCount.length,
      winnerName: winnerUsername ?? undefined,
      winnerContributionUsd: totalContributedUsd || undefined,
      durationMinutes,
      totalHeists: heistCount,
    }

    await LumiaService.triggerSessionEnd(session_id, sessionStats)
    await DiscordService.postSessionSummary(session_id, sessionStats)

    // Notify winner of session rewards
    if (winner_id && rewards) {
      await NotificationService.notifyJuicernautReward(
        winner_id,
        rewards.wealth,
        rewards.xp,
        rewards.crate_tier ?? undefined
      )
    }

    return {
      winner_id,
      winnerUsername,
      totalContributedUsd,
      rewards,
    }
  },

  /**
   * Get the currently active session
   */
  async getActiveSession(): Promise<ActiveSessionInfo | null> {
    const session = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
      include: {
        users: true,
      },
    })

    if (!session) return null

    let juicernautTotal = 0
    if (session.current_juicernaut_user_id) {
      juicernautTotal = await this.getUserSessionTotal(session.id, session.current_juicernaut_user_id)
    }

    return {
      id: session.id,
      title: session.session_title,
      platform: session.platform,
      is_active: session.is_active ?? false,
      started_at: session.started_at ?? new Date(),
      total_contributions_usd: Number(session.total_contributions_usd),
      current_juicernaut: session.users
        ? {
            id: session.users.id,
            username: session.users.username,
            display_name: session.users.display_name,
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
    user_id: number,
    platform: MonetizationPlatform,
    contribution_type: MonetizationEventType,
    quantity: number,
    usd_value: number,
    monetizationEventId?: number
  ): Promise<{ addedToSession: boolean; crownChanged: boolean; newJuicernautId?: number }> {
    const session = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
    })

    if (!session) {
      return { addedToSession: false, crownChanged: false }
    }

    // Add contribution record
    await prisma.session_contributions.create({
      data: {
        session_id: session.id,
        user_id,
        platform,
        contribution_type,
        quantity,
        usd_value: new Decimal(usd_value),
        monetization_event_id: monetizationEventId,
      },
    })

    // Update session total
    await prisma.streaming_sessions.update({
      where: { id: session.id },
      data: {
        total_contributions_usd: {
          increment: new Decimal(usd_value),
        },
      },
    })

    // Get user's new total for this session
    const userTotal = await this.getUserSessionTotal(session.id, user_id)

    // Check for crown change
    const crownResult = await this.checkCrownChange(session.id, user_id, userTotal)

    return {
      addedToSession: true,
      crownChanged: crownResult.changed,
      newJuicernautId: crownResult.changed ? user_id : undefined,
    }
  },

  /**
   * Get a user's total contribution for a session
   */
  async getUserSessionTotal(session_id: number, user_id: number): Promise<number> {
    const result = await prisma.session_contributions.aggregate({
      where: {
        session_id,
        user_id,
      },
      _sum: {
        usd_value: true,
      },
    })

    return Number(result._sum.usd_value || 0)
  },

  /**
   * Get session leaderboard
   */
  async getSessionLeaderboard(session_id: number, limit = 10): Promise<SessionLeaderboardEntry[]> {
    const session = await prisma.streaming_sessions.findUnique({
      where: { id: session_id },
    })

    if (!session) return []

    // Aggregate contributions by user
    const contributions = await prisma.session_contributions.groupBy({
      by: ['user_id'],
      where: { session_id },
      _sum: { usd_value: true },
      _count: true,
      orderBy: {
        _sum: {
          usd_value: 'desc',
        },
      },
      take: limit,
    })

    // Fetch user details
    const user_ids = contributions.map((c) => c.user_id).filter((id): id is number => id !== null)
    const users = await prisma.users.findMany({
      where: { id: { in: user_ids } },
      select: { id: true, username: true, display_name: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    return contributions
      .filter((c) => c.user_id !== null)
      .map((c, index) => {
        const user = userMap.get(c.user_id!)
        return {
          rank: index + 1,
          user_id: c.user_id!,
          username: user?.username || 'Unknown',
          display_name: user?.display_name || null,
          totalUsd: Number(c._sum.usd_value || 0),
          contributionCount: c._count,
          isJuicernaut: c.user_id === session.current_juicernaut_user_id,
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
    session_id: number,
    contributorId: number,
    contributorTotal: number
  ): Promise<{ changed: boolean; previousJuicernautId?: number }> {
    const session = await prisma.streaming_sessions.findUnique({
      where: { id: session_id },
    })

    if (!session) return { changed: false }

    // First contribution - crown them
    if (!session.current_juicernaut_user_id) {
      await this.transferCrown(session_id, null, contributorId, contributorTotal)
      return { changed: true }
    }

    // Same user is already Juicernaut
    if (session.current_juicernaut_user_id === contributorId) {
      return { changed: false }
    }

    // Check if contributor now has more than current Juicernaut
    const current_juicernautTotal = await this.getUserSessionTotal(
      session_id,
      session.current_juicernaut_user_id
    )

    if (contributorTotal > current_juicernautTotal) {
      await this.transferCrown(
        session_id,
        session.current_juicernaut_user_id,
        contributorId,
        contributorTotal
      )
      return { changed: true, previousJuicernautId: session.current_juicernaut_user_id }
    }

    return { changed: false }
  },

  /**
   * Transfer the Juicernaut crown from one user to another
   */
  async transferCrown(
    session_id: number,
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
    await prisma.streaming_sessions.update({
      where: { id: session_id },
      data: { current_juicernaut_user_id: newUserId },
    })

    // Log crown change via game_events (juicernautCrownChange model not in current schema)
    await prisma.game_events.create({
      data: {
        user_id: newUserId,
        event_type: 'juicernaut_crown',
        wealth_change: 0,
        xp_change: 0,
        event_description: `Claimed Juicernaut crown for session ${session_id} with $${newTotal.toFixed(2)}${oldUserId ? ' (dethroned previous holder)' : ''}`,
        success: true,
      },
    })

    // Get usernames for notifications
    const [newUser, oldUser] = await Promise.all([
      prisma.users.findUnique({
        where: { id: newUserId },
        select: { username: true, kingpin_name: true },
      }),
      oldUserId ? prisma.users.findUnique({
        where: { id: oldUserId },
        select: { username: true, kingpin_name: true },
      }) : null,
    ])

    const newHolderName = newUser?.kingpin_name || newUser?.username || 'Unknown'
    const oldHolderName = oldUser ? (oldUser.kingpin_name || oldUser.username) : null

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
  async applyJuicernautBuffs(user_id: number): Promise<void> {
    for (const buff of JUICERNAUT_BUFF_CONFIG) {
      await prisma.active_buffs.upsert({
        where: {
          user_id_buff_type: {
            user_id,
            buff_type: buff.type,
          },
        },
        update: {
          multiplier: new Decimal(buff.multiplier),
          description: buff.description,
          is_active: true,
          activated_at: new Date(),
          expires_at: null, // Juicernaut buffs don't expire until session ends
        },
        create: {
          user_id,
          buff_type: buff.type,
          multiplier: new Decimal(buff.multiplier),
          description: buff.description,
          is_active: true,
          expires_at: null,
        },
      })
    }
  },

  /**
   * Remove all Juicernaut buffs from a user
   */
  async removeJuicernautBuffs(user_id: number): Promise<void> {
    await prisma.active_buffs.updateMany({
      where: {
        user_id,
        buff_type: {
          startsWith: 'juicernaut_',
        },
      },
      data: {
        is_active: false,
      },
    })
  },

  /**
   * Check if a user has a specific Juicernaut buff active
   */
  async hasJuicernautBuff(
    user_id: number,
    buff_type: (typeof JUICERNAUT_BUFF_TYPES)[keyof typeof JUICERNAUT_BUFF_TYPES]
  ): Promise<boolean> {
    const buff = await prisma.active_buffs.findFirst({
      where: {
        user_id,
        buff_type,
        is_active: true,
      },
    })
    return !!buff
  },

  /**
   * Get a user's active Juicernaut buff multiplier
   */
  async getBuffMultiplier(
    user_id: number,
    buff_type: (typeof JUICERNAUT_BUFF_TYPES)[keyof typeof JUICERNAUT_BUFF_TYPES]
  ): Promise<number> {
    const buff = await prisma.active_buffs.findFirst({
      where: {
        user_id,
        buff_type,
        is_active: true,
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
          crate_tier: tier.crate,
        }
      }
    }

    // Default to lowest tier
    const lowestTier = JUICERNAUT_SESSION_REWARDS.TIERS[0]
    return {
      wealth: lowestTier.wealth,
      xp: lowestTier.xp,
      crate_tier: lowestTier.crate,
    }
  },

  // ===========================================================================
  // HALL OF FAME
  // ===========================================================================

  /**
   * Get Juicernaut hall of fame (all-time winners)
   * Note: juicernautWinner model not in current schema - using game_events instead
   */
  async getHallOfFame(limit = 10) {
    // Get top juicernaut winners from game_events
    const wins = await prisma.game_events.findMany({
      where: { event_type: 'juicernaut_win' },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        user_id: true,
        wealth_change: true,
        event_description: true,
        created_at: true,
      },
    })

    // Get user details
    const user_ids = wins.map((w) => w.user_id).filter((id): id is number => id !== null)
    const users = await prisma.users.findMany({
      where: { id: { in: user_ids } },
      select: { id: true, username: true, display_name: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return {
      topContributors: wins.map((w) => ({
        user_id: w.user_id ?? 0,
        username: userMap.get(w.user_id ?? 0)?.username || 'Unknown',
        display_name: userMap.get(w.user_id ?? 0)?.display_name || null,
        totalContributedUsd: 0, // Not available from game_events
        sessionTitle: null,
        platform: null,
        wonAt: w.created_at,
      })),
      mostWins: [] as { user_id: number; username: string; display_name: string | null; wins: number }[],
    }
  },

  /**
   * Get crown change history for a session
   * Note: juicernautCrownChange model not in current schema - using game_events instead
   */
  async getCrownHistory(session_id: number) {
    // Get crown changes from game_events
    const changes = await prisma.game_events.findMany({
      where: {
        event_type: 'juicernaut_crown',
        event_description: { contains: `session ${session_id}` },
      },
      orderBy: { created_at: 'asc' },
      select: {
        user_id: true,
        event_description: true,
        created_at: true,
      },
    })

    // Get user details
    const user_ids = changes.map((c) => c.user_id).filter((id): id is number => id !== null)
    const users = await prisma.users.findMany({
      where: { id: { in: user_ids } },
      select: { id: true, username: true, display_name: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return changes.map((c) => ({
      changedAt: c.created_at,
      newJuicernaut: userMap.get(c.user_id ?? 0) || null,
      previousJuicernaut: null, // Not tracked in this simplified version
    }))
  },
}

export default JuicernautService
