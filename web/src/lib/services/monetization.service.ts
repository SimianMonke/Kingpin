import { prisma } from '../db'
import {
  MONETIZATION_REWARDS,
  CONTRIBUTION_USD_VALUES,
  MONETIZATION_EVENT_TYPES,
  MONETIZATION_PLATFORMS,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  type MonetizationPlatform,
  type MonetizationEventType,
} from '../game'
import { UserService } from './user.service'
import { LeaderboardService } from './leaderboard.service'
import { AchievementService } from './achievement.service'
import type { Platform } from '@/types'

// =============================================================================
// MONETIZATION TYPES
// =============================================================================

export interface RewardCalculation {
  wealth: number
  xp: number
  usd_value: number
}

export interface MonetizationResult {
  success: boolean
  eventId: number
  user_id: number
  wealth: number
  xp: number
  usd_value: number
  levelUp: boolean
  newLevel?: number
  tierPromotion: boolean
  newTier?: string
  addedToSession: boolean
  session_id?: number
}

export interface ProcessEventInput {
  platform: MonetizationPlatform
  event_type: MonetizationEventType
  platformUserId: string
  username: string
  quantity: number
  tier?: string
  amount_usd?: number
  external_event_id: string
  raw_event_data?: Record<string, unknown>
  recipientPlatformUserId?: string
  recipient_username?: string
}

// =============================================================================
// MONETIZATION SERVICE
// =============================================================================

export const MonetizationService = {
  /**
   * Check if an event has already been processed (deduplication)
   */
  async isEventProcessed(external_event_id: string): Promise<boolean> {
    const existing = await prisma.monetization_events.findUnique({
      where: { external_event_id },
    })
    return !!existing
  },

  /**
   * Calculate rewards based on platform, event type, quantity, and tier
   */
  calculateRewards(
    platform: MonetizationPlatform,
    event_type: MonetizationEventType,
    quantity: number,
    tier?: string
  ): RewardCalculation {
    let baseWealth = 0
    let baseXp = 0
    let baseUsd = 0

    if (platform === MONETIZATION_PLATFORMS.KICK) {
      switch (event_type) {
        case MONETIZATION_EVENT_TYPES.SUBSCRIPTION:
          if (tier === '3') {
            baseWealth = MONETIZATION_REWARDS.KICK_SUB_T3.wealth
            baseXp = MONETIZATION_REWARDS.KICK_SUB_T3.xp
            baseUsd = CONTRIBUTION_USD_VALUES.KICK_SUB_T3
          } else if (tier === '2') {
            baseWealth = MONETIZATION_REWARDS.KICK_SUB_T2.wealth
            baseXp = MONETIZATION_REWARDS.KICK_SUB_T2.xp
            baseUsd = CONTRIBUTION_USD_VALUES.KICK_SUB_T2
          } else {
            baseWealth = MONETIZATION_REWARDS.KICK_SUB_T1.wealth
            baseXp = MONETIZATION_REWARDS.KICK_SUB_T1.xp
            baseUsd = CONTRIBUTION_USD_VALUES.KICK_SUB_T1
          }
          break
        case MONETIZATION_EVENT_TYPES.GIFT_SUB:
          baseWealth = MONETIZATION_REWARDS.KICK_GIFT_SUB.wealth
          baseXp = MONETIZATION_REWARDS.KICK_GIFT_SUB.xp
          baseUsd = CONTRIBUTION_USD_VALUES.KICK_GIFT_SUB
          break
        case MONETIZATION_EVENT_TYPES.KICK:
          baseWealth = MONETIZATION_REWARDS.KICK_KICK.wealth
          baseXp = MONETIZATION_REWARDS.KICK_KICK.xp
          baseUsd = CONTRIBUTION_USD_VALUES.KICK_KICK
          break
      }
    } else if (platform === MONETIZATION_PLATFORMS.TWITCH) {
      switch (event_type) {
        case MONETIZATION_EVENT_TYPES.SUBSCRIPTION:
          if (tier === '3' || tier === '3000') {
            baseWealth = MONETIZATION_REWARDS.TWITCH_SUB_T3.wealth
            baseXp = MONETIZATION_REWARDS.TWITCH_SUB_T3.xp
            baseUsd = CONTRIBUTION_USD_VALUES.TWITCH_SUB_T3
          } else if (tier === '2' || tier === '2000') {
            baseWealth = MONETIZATION_REWARDS.TWITCH_SUB_T2.wealth
            baseXp = MONETIZATION_REWARDS.TWITCH_SUB_T2.xp
            baseUsd = CONTRIBUTION_USD_VALUES.TWITCH_SUB_T2
          } else {
            baseWealth = MONETIZATION_REWARDS.TWITCH_SUB_T1.wealth
            baseXp = MONETIZATION_REWARDS.TWITCH_SUB_T1.xp
            baseUsd = CONTRIBUTION_USD_VALUES.TWITCH_SUB_T1
          }
          break
        case MONETIZATION_EVENT_TYPES.GIFT_SUB:
          baseWealth = MONETIZATION_REWARDS.TWITCH_GIFT_SUB.wealth
          baseXp = MONETIZATION_REWARDS.TWITCH_GIFT_SUB.xp
          baseUsd = CONTRIBUTION_USD_VALUES.TWITCH_GIFT_SUB
          break
        case MONETIZATION_EVENT_TYPES.BITS:
          // Per 100 bits
          baseWealth = MONETIZATION_REWARDS.TWITCH_BITS_PER_100.wealth
          baseXp = MONETIZATION_REWARDS.TWITCH_BITS_PER_100.xp
          baseUsd = CONTRIBUTION_USD_VALUES.TWITCH_BITS * 100 // $1 per 100 bits
          break
        case MONETIZATION_EVENT_TYPES.RAID:
          baseWealth = MONETIZATION_REWARDS.TWITCH_RAID_PER_VIEWER.wealth
          baseXp = MONETIZATION_REWARDS.TWITCH_RAID_PER_VIEWER.xp
          baseUsd = CONTRIBUTION_USD_VALUES.TWITCH_RAID
          break
      }
    } else if (platform === MONETIZATION_PLATFORMS.STRIPE) {
      // Donations: per dollar
      baseWealth = MONETIZATION_REWARDS.DONATION_PER_DOLLAR.wealth
      baseXp = MONETIZATION_REWARDS.DONATION_PER_DOLLAR.xp
      baseUsd = CONTRIBUTION_USD_VALUES.STRIPE_DONATION
    }

    // Calculate totals based on quantity
    // For bits, quantity is actual bits, so we need to scale
    if (platform === MONETIZATION_PLATFORMS.TWITCH && event_type === MONETIZATION_EVENT_TYPES.BITS) {
      const hundreds = quantity / 100
      return {
        wealth: Math.floor(baseWealth * hundreds),
        xp: Math.floor(baseXp * hundreds),
        usd_value: quantity * CONTRIBUTION_USD_VALUES.TWITCH_BITS,
      }
    }

    return {
      wealth: baseWealth * quantity,
      xp: baseXp * quantity,
      usd_value: baseUsd * quantity,
    }
  },

  /**
   * Process a monetization event from any platform
   */
  async processEvent(input: ProcessEventInput): Promise<MonetizationResult> {
    // Check for duplicate
    if (await this.isEventProcessed(input.external_event_id)) {
      throw new Error('Event already processed')
    }

    // Get or create user
    const platformKey = input.platform === 'kick' ? 'kick' : input.platform === 'twitch' ? 'twitch' : 'kick'
    const user = await UserService.getOrCreate(
      platformKey as Platform,
      input.platformUserId,
      input.username
    )

    // Calculate rewards
    const rewards = this.calculateRewards(
      input.platform,
      input.event_type,
      input.quantity,
      input.tier
    )

    // For donations, use the actual USD amount
    if (input.platform === MONETIZATION_PLATFORMS.STRIPE && input.amount_usd) {
      rewards.wealth = Math.floor(MONETIZATION_REWARDS.DONATION_PER_DOLLAR.wealth * input.amount_usd)
      rewards.usd_value = input.amount_usd
    }

    // Handle recipient for gift subs
    let recipient_user_id: number | null = null
    if (input.recipientPlatformUserId && input.recipient_username) {
      const recipient = await UserService.getOrCreate(
        platformKey as Platform,
        input.recipientPlatformUserId,
        input.recipient_username
      )
      recipient_user_id = recipient.id
    }

    // Create monetization event record
    const event = await prisma.monetization_events.create({
      data: {
        user_id: user.id,
        platform: input.platform,
        event_type: input.event_type,
        quantity: input.quantity,
        amount_usd: rewards.usd_value,
        tier: input.tier,
        recipient_user_id,
        recipient_username: input.recipient_username,
        wealth_rewarded: rewards.wealth,
        xp_rewarded: rewards.xp,
        raw_event_data: input.raw_event_data as object,
        external_event_id: input.external_event_id,
        processed: true,
      },
    })

    // Distribute rewards
    await UserService.addWealth(user.id, rewards.wealth)
    const xpResult = await UserService.addXp(user.id, rewards.xp)

    // Update leaderboard snapshots
    const leaderboardUpdate: Record<string, number> = {
      wealth_earned: rewards.wealth,
      xp_earned: rewards.xp,
      totalContributedUsd: rewards.usd_value,
    }

    // Track specific monetization metrics
    if (input.event_type === MONETIZATION_EVENT_TYPES.SUBSCRIPTION) {
      leaderboardUpdate.subsCount = input.quantity
    }
    if (input.event_type === MONETIZATION_EVENT_TYPES.GIFT_SUB) {
      leaderboardUpdate.giftSubsGiven = input.quantity
    }
    if (input.event_type === MONETIZATION_EVENT_TYPES.BITS) {
      leaderboardUpdate.bitsDonated = input.quantity
    }
    if (input.event_type === MONETIZATION_EVENT_TYPES.KICK) {
      leaderboardUpdate.kicksSent = input.quantity
    }
    if (input.event_type === MONETIZATION_EVENT_TYPES.DONATION) {
      leaderboardUpdate.donationsUsd = rewards.usd_value
    }

    await LeaderboardService.updateSnapshot(user.id, leaderboardUpdate)

    // Update achievement progress
    await AchievementService.incrementProgress(
      user.id,
      ACHIEVEMENT_REQUIREMENT_TYPES.JUICERNAUT_CONTRIBUTION,
      Math.floor(rewards.usd_value * 100) // Track in cents for precision
    )
    await AchievementService.incrementProgress(
      user.id,
      ACHIEVEMENT_REQUIREMENT_TYPES.TOTAL_WEALTH_EARNED,
      rewards.wealth
    )

    // Add to active Juicernaut session if one exists
    let addedToSession = false
    let session_id: number | undefined

    const activeSession = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
    })

    if (activeSession) {
      // Import JuicernautService dynamically to avoid circular dependency
      const { JuicernautService } = await import('./juicernaut.service')
      await JuicernautService.processContribution(
        user.id,
        input.platform,
        input.event_type,
        input.quantity,
        rewards.usd_value,
        event.id
      )
      addedToSession = true
      session_id = activeSession.id
    }

    return {
      success: true,
      eventId: event.id,
      user_id: user.id,
      wealth: rewards.wealth,
      xp: rewards.xp,
      usd_value: rewards.usd_value,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
      tierPromotion: xpResult.tierPromotion,
      newTier: xpResult.newTier,
      addedToSession,
      session_id,
    }
  },

  /**
   * Get monetization history for a user
   */
  async getUserHistory(user_id: number, limit = 20) {
    return prisma.monetization_events.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
      take: limit,
    })
  },

  /**
   * Get total monetization stats for a user
   */
  async getUserStats(user_id: number) {
    const aggregations = await prisma.monetization_events.aggregate({
      where: { user_id },
      _sum: {
        wealth_rewarded: true,
        xp_rewarded: true,
        amount_usd: true,
        quantity: true,
      },
      _count: true,
    })

    const byPlatform = await prisma.monetization_events.groupBy({
      by: ['platform'],
      where: { user_id },
      _sum: {
        amount_usd: true,
      },
      _count: true,
    })

    return {
      totalEvents: aggregations._count,
      totalWealthEarned: aggregations._sum.wealth_rewarded || BigInt(0),
      totalXpEarned: aggregations._sum.xp_rewarded || 0,
      totalContributedUsd: aggregations._sum.amount_usd || 0,
      byPlatform: byPlatform.map(p => ({
        platform: p.platform,
        events: p._count,
        totalUsd: p._sum.amount_usd || 0,
      })),
    }
  },

  /**
   * Process Kick subscription event
   */
  async processKickSubscription(
    subscriberUserId: string,
    subscriberUsername: string,
    tier: string,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.KICK,
      event_type: MONETIZATION_EVENT_TYPES.SUBSCRIPTION,
      platformUserId: subscriberUserId,
      username: subscriberUsername,
      quantity: 1,
      tier,
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Kick gift sub event
   */
  async processKickGiftSubs(
    gifterUserId: string,
    gifterUsername: string,
    giftCount: number,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.KICK,
      event_type: MONETIZATION_EVENT_TYPES.GIFT_SUB,
      platformUserId: gifterUserId,
      username: gifterUsername,
      quantity: giftCount,
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Kick kicks event
   */
  async processKickKicks(
    senderUserId: string,
    senderUsername: string,
    kickCount: number,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.KICK,
      event_type: MONETIZATION_EVENT_TYPES.KICK,
      platformUserId: senderUserId,
      username: senderUsername,
      quantity: kickCount,
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Twitch subscription event
   */
  async processTwitchSubscription(
    subscriberUserId: string,
    subscriberUsername: string,
    tier: string,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      event_type: MONETIZATION_EVENT_TYPES.SUBSCRIPTION,
      platformUserId: subscriberUserId,
      username: subscriberUsername,
      quantity: 1,
      tier,
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Twitch gift sub event
   */
  async processTwitchGiftSubs(
    gifterUserId: string,
    gifterUsername: string,
    giftCount: number,
    tier: string,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      event_type: MONETIZATION_EVENT_TYPES.GIFT_SUB,
      platformUserId: gifterUserId,
      username: gifterUsername,
      quantity: giftCount,
      tier,
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Twitch bits event
   */
  async processTwitchBits(
    cheererUserId: string,
    cheererUsername: string,
    bits: number,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      event_type: MONETIZATION_EVENT_TYPES.BITS,
      platformUserId: cheererUserId,
      username: cheererUsername,
      quantity: bits,
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Twitch raid event
   */
  async processTwitchRaid(
    raiderUserId: string,
    raiderUsername: string,
    viewerCount: number,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      event_type: MONETIZATION_EVENT_TYPES.RAID,
      platformUserId: raiderUserId,
      username: raiderUsername,
      quantity: Math.max(1, viewerCount), // Minimum 1 viewer
      external_event_id,
      raw_event_data,
    })
  },

  /**
   * Process Stripe donation event
   */
  async processStripeDonation(
    platformUserId: string,
    username: string,
    amount_usd: number,
    external_event_id: string,
    raw_event_data?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.STRIPE,
      event_type: MONETIZATION_EVENT_TYPES.DONATION,
      platformUserId,
      username,
      quantity: 1,
      amount_usd,
      external_event_id,
      raw_event_data,
    })
  },
}

export default MonetizationService
