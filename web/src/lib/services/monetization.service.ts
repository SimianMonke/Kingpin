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
  usdValue: number
}

export interface MonetizationResult {
  success: boolean
  eventId: number
  userId: number
  wealth: number
  xp: number
  usdValue: number
  levelUp: boolean
  newLevel?: number
  tierPromotion: boolean
  newTier?: string
  addedToSession: boolean
  sessionId?: number
}

export interface ProcessEventInput {
  platform: MonetizationPlatform
  eventType: MonetizationEventType
  platformUserId: string
  username: string
  quantity: number
  tier?: string
  amountUsd?: number
  externalEventId: string
  rawEventData?: Record<string, unknown>
  recipientPlatformUserId?: string
  recipientUsername?: string
}

// =============================================================================
// MONETIZATION SERVICE
// =============================================================================

export const MonetizationService = {
  /**
   * Check if an event has already been processed (deduplication)
   */
  async isEventProcessed(externalEventId: string): Promise<boolean> {
    const existing = await prisma.monetizationEvent.findUnique({
      where: { externalEventId },
    })
    return !!existing
  },

  /**
   * Calculate rewards based on platform, event type, quantity, and tier
   */
  calculateRewards(
    platform: MonetizationPlatform,
    eventType: MonetizationEventType,
    quantity: number,
    tier?: string
  ): RewardCalculation {
    let baseWealth = 0
    let baseXp = 0
    let baseUsd = 0

    if (platform === MONETIZATION_PLATFORMS.KICK) {
      switch (eventType) {
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
      switch (eventType) {
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
    if (platform === MONETIZATION_PLATFORMS.TWITCH && eventType === MONETIZATION_EVENT_TYPES.BITS) {
      const hundreds = quantity / 100
      return {
        wealth: Math.floor(baseWealth * hundreds),
        xp: Math.floor(baseXp * hundreds),
        usdValue: quantity * CONTRIBUTION_USD_VALUES.TWITCH_BITS,
      }
    }

    return {
      wealth: baseWealth * quantity,
      xp: baseXp * quantity,
      usdValue: baseUsd * quantity,
    }
  },

  /**
   * Process a monetization event from any platform
   */
  async processEvent(input: ProcessEventInput): Promise<MonetizationResult> {
    // Check for duplicate
    if (await this.isEventProcessed(input.externalEventId)) {
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
      input.eventType,
      input.quantity,
      input.tier
    )

    // For donations, use the actual USD amount
    if (input.platform === MONETIZATION_PLATFORMS.STRIPE && input.amountUsd) {
      rewards.wealth = Math.floor(MONETIZATION_REWARDS.DONATION_PER_DOLLAR.wealth * input.amountUsd)
      rewards.usdValue = input.amountUsd
    }

    // Handle recipient for gift subs
    let recipientUserId: number | null = null
    if (input.recipientPlatformUserId && input.recipientUsername) {
      const recipient = await UserService.getOrCreate(
        platformKey as Platform,
        input.recipientPlatformUserId,
        input.recipientUsername
      )
      recipientUserId = recipient.id
    }

    // Create monetization event record
    const event = await prisma.monetizationEvent.create({
      data: {
        userId: user.id,
        platform: input.platform,
        eventType: input.eventType,
        quantity: input.quantity,
        amountUsd: rewards.usdValue,
        tier: input.tier,
        recipientUserId,
        recipientUsername: input.recipientUsername,
        wealthRewarded: rewards.wealth,
        xpRewarded: rewards.xp,
        rawEventData: input.rawEventData as object,
        externalEventId: input.externalEventId,
        processed: true,
      },
    })

    // Distribute rewards
    await UserService.addWealth(user.id, rewards.wealth)
    const xpResult = await UserService.addXp(user.id, rewards.xp)

    // Update leaderboard snapshots
    const leaderboardUpdate: Record<string, number> = {
      wealthEarned: rewards.wealth,
      xpEarned: rewards.xp,
      totalContributedUsd: rewards.usdValue,
    }

    // Track specific monetization metrics
    if (input.eventType === MONETIZATION_EVENT_TYPES.SUBSCRIPTION) {
      leaderboardUpdate.subsCount = input.quantity
    }
    if (input.eventType === MONETIZATION_EVENT_TYPES.GIFT_SUB) {
      leaderboardUpdate.giftSubsGiven = input.quantity
    }
    if (input.eventType === MONETIZATION_EVENT_TYPES.BITS) {
      leaderboardUpdate.bitsDonated = input.quantity
    }
    if (input.eventType === MONETIZATION_EVENT_TYPES.KICK) {
      leaderboardUpdate.kicksSent = input.quantity
    }
    if (input.eventType === MONETIZATION_EVENT_TYPES.DONATION) {
      leaderboardUpdate.donationsUsd = rewards.usdValue
    }

    await LeaderboardService.updateSnapshot(user.id, leaderboardUpdate)

    // Update achievement progress
    await AchievementService.incrementProgress(
      user.id,
      ACHIEVEMENT_REQUIREMENT_TYPES.JUICERNAUT_CONTRIBUTION,
      Math.floor(rewards.usdValue * 100) // Track in cents for precision
    )
    await AchievementService.incrementProgress(
      user.id,
      ACHIEVEMENT_REQUIREMENT_TYPES.TOTAL_WEALTH_EARNED,
      rewards.wealth
    )

    // Add to active Juicernaut session if one exists
    let addedToSession = false
    let sessionId: number | undefined

    const activeSession = await prisma.streamingSession.findFirst({
      where: { isActive: true },
    })

    if (activeSession) {
      // Import JuicernautService dynamically to avoid circular dependency
      const { JuicernautService } = await import('./juicernaut.service')
      await JuicernautService.processContribution(
        user.id,
        input.platform,
        input.eventType,
        input.quantity,
        rewards.usdValue,
        event.id
      )
      addedToSession = true
      sessionId = activeSession.id
    }

    return {
      success: true,
      eventId: event.id,
      userId: user.id,
      wealth: rewards.wealth,
      xp: rewards.xp,
      usdValue: rewards.usdValue,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
      tierPromotion: xpResult.tierPromotion,
      newTier: xpResult.newTier,
      addedToSession,
      sessionId,
    }
  },

  /**
   * Get monetization history for a user
   */
  async getUserHistory(userId: number, limit = 20) {
    return prisma.monetizationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  /**
   * Get total monetization stats for a user
   */
  async getUserStats(userId: number) {
    const aggregations = await prisma.monetizationEvent.aggregate({
      where: { userId },
      _sum: {
        wealthRewarded: true,
        xpRewarded: true,
        amountUsd: true,
        quantity: true,
      },
      _count: true,
    })

    const byPlatform = await prisma.monetizationEvent.groupBy({
      by: ['platform'],
      where: { userId },
      _sum: {
        amountUsd: true,
      },
      _count: true,
    })

    return {
      totalEvents: aggregations._count,
      totalWealthEarned: aggregations._sum.wealthRewarded || BigInt(0),
      totalXpEarned: aggregations._sum.xpRewarded || 0,
      totalContributedUsd: aggregations._sum.amountUsd || 0,
      byPlatform: byPlatform.map(p => ({
        platform: p.platform,
        events: p._count,
        totalUsd: p._sum.amountUsd || 0,
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
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.KICK,
      eventType: MONETIZATION_EVENT_TYPES.SUBSCRIPTION,
      platformUserId: subscriberUserId,
      username: subscriberUsername,
      quantity: 1,
      tier,
      externalEventId,
      rawEventData,
    })
  },

  /**
   * Process Kick gift sub event
   */
  async processKickGiftSubs(
    gifterUserId: string,
    gifterUsername: string,
    giftCount: number,
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.KICK,
      eventType: MONETIZATION_EVENT_TYPES.GIFT_SUB,
      platformUserId: gifterUserId,
      username: gifterUsername,
      quantity: giftCount,
      externalEventId,
      rawEventData,
    })
  },

  /**
   * Process Kick kicks event
   */
  async processKickKicks(
    senderUserId: string,
    senderUsername: string,
    kickCount: number,
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.KICK,
      eventType: MONETIZATION_EVENT_TYPES.KICK,
      platformUserId: senderUserId,
      username: senderUsername,
      quantity: kickCount,
      externalEventId,
      rawEventData,
    })
  },

  /**
   * Process Twitch subscription event
   */
  async processTwitchSubscription(
    subscriberUserId: string,
    subscriberUsername: string,
    tier: string,
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      eventType: MONETIZATION_EVENT_TYPES.SUBSCRIPTION,
      platformUserId: subscriberUserId,
      username: subscriberUsername,
      quantity: 1,
      tier,
      externalEventId,
      rawEventData,
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
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      eventType: MONETIZATION_EVENT_TYPES.GIFT_SUB,
      platformUserId: gifterUserId,
      username: gifterUsername,
      quantity: giftCount,
      tier,
      externalEventId,
      rawEventData,
    })
  },

  /**
   * Process Twitch bits event
   */
  async processTwitchBits(
    cheererUserId: string,
    cheererUsername: string,
    bits: number,
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      eventType: MONETIZATION_EVENT_TYPES.BITS,
      platformUserId: cheererUserId,
      username: cheererUsername,
      quantity: bits,
      externalEventId,
      rawEventData,
    })
  },

  /**
   * Process Twitch raid event
   */
  async processTwitchRaid(
    raiderUserId: string,
    raiderUsername: string,
    viewerCount: number,
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.TWITCH,
      eventType: MONETIZATION_EVENT_TYPES.RAID,
      platformUserId: raiderUserId,
      username: raiderUsername,
      quantity: Math.max(1, viewerCount), // Minimum 1 viewer
      externalEventId,
      rawEventData,
    })
  },

  /**
   * Process Stripe donation event
   */
  async processStripeDonation(
    platformUserId: string,
    username: string,
    amountUsd: number,
    externalEventId: string,
    rawEventData?: Record<string, unknown>
  ) {
    return this.processEvent({
      platform: MONETIZATION_PLATFORMS.STRIPE,
      eventType: MONETIZATION_EVENT_TYPES.DONATION,
      platformUserId,
      username,
      quantity: 1,
      amountUsd,
      externalEventId,
      rawEventData,
    })
  },
}

export default MonetizationService
