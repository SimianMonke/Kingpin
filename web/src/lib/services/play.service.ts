import { prisma } from '../db'
import { safeVoid } from '../utils'
import {
  JAIL_CONFIG,
  PLAY_CRATE_DROP_CHANCE,
  PLAY_CONFIG,
  JUICERNAUT_BUFFS,
  JUICERNAUT_BUFF_TYPES,
  TIER_PLAY_EVENTS,
  PLAY_CRATE_TIER_WEIGHTS,
  CRATE_TIERS,
  CRATE_SOURCES,
  MISSION_OBJECTIVE_TYPES,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  type Tier,
  type CrateTier,
  type PlayEventDef,
} from '../game'
import { getTierFromLevel, levelFromXp, randomInt } from '../game/formulas'
import { JailService } from './jail.service'
import { LeaderboardService } from './leaderboard.service'
import { MissionService } from './mission.service'
import { AchievementService } from './achievement.service'
import { CrateService } from './crate.service'
import { FactionService } from './faction.service'
import { NotificationService } from './notification.service'
import { DiscordService } from './discord.service'

// Note: Weapon durability is NOT affected by play events.
// Durability only decays during robbery actions (attacker: -3, defender: -2).

// =============================================================================
// PLAY SERVICE TYPES
// =============================================================================

export interface PlayResult {
  success: boolean
  busted: boolean
  jailed: boolean
  jailExpiresAt?: Date

  // Event details
  eventName?: string
  event_description?: string

  // Rewards
  wealth_earned: number
  xp_earned: number

  // Level/tier changes
  levelUp: boolean
  newLevel?: number
  tierPromotion: boolean
  newTier?: string

  // Crate drop
  crateDropped: boolean
  crate_tier?: CrateTier
  crateToEscrow?: boolean
  crateLost?: boolean

  // Buffs applied
  juicernautBonuses?: {
    wealthBonus: number
    xpBonus: number
  }
  factionBonuses?: {
    wealthBonus: number
    xpBonus: number
    buffsApplied: string[]
  }
}

export interface PlayPreCheck {
  canPlay: boolean
  reason?: string
  isJailed: boolean
  jailTimeRemaining?: string
}

// =============================================================================
// PLAY SERVICE
// =============================================================================

export const PlayService = {
  /**
   * Check if user can perform play action
   */
  async canPlay(user_id: number): Promise<PlayPreCheck> {
    // Check jail status
    const jailStatus = await JailService.getJailStatus(user_id)

    if (jailStatus.isJailed) {
      return {
        canPlay: false,
        reason: `You're in jail! ${jailStatus.remainingFormatted} remaining. Use bail to escape early.`,
        isJailed: true,
        jailTimeRemaining: jailStatus.remainingFormatted ?? undefined,
      }
    }

    return {
      canPlay: true,
      isJailed: false,
    }
  },

  /**
   * Execute play action
   */
  async executePlay(user_id: number): Promise<PlayResult> {
    // Pre-check
    const preCheck = await this.canPlay(user_id)
    if (!preCheck.canPlay) {
      return {
        success: false,
        busted: false,
        jailed: preCheck.isJailed,
        wealth_earned: 0,
        xp_earned: 0,
        levelUp: false,
        tierPromotion: false,
        crateDropped: false,
      }
    }

    // Get user data
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        username: true,
        wealth: true,
        xp: true,
        level: true,
        status_tier: true,
        total_play_count: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const playerTier = user.status_tier as Tier

    // Check for Juicernaut buffs
    const juicernautBuffs = await this.getJuicernautBuffs(user_id)

    // Roll for bust (5% chance)
    const busted = Math.random() < JAIL_CONFIG.BUST_CHANCE

    if (busted) {
      return await this.handleBust(user_id, playerTier)
    }

    // Select random event for player's tier
    const event = this.selectEvent(playerTier)

    // Calculate rewards
    let wealth_earned = randomInt(event.wealth.min, event.wealth.max)
    let xp_earned = randomInt(event.xp.min, event.xp.max)

    // Apply Juicernaut buffs
    let juicernautBonuses: { wealthBonus: number; xpBonus: number } | undefined
    if (juicernautBuffs.isJuicernaut) {
      let wealthBonus = 0
      let xpBonus = 0

      // Apply wealth buff (1.25x)
      if (juicernautBuffs.hasWealthBuff) {
        wealthBonus = Math.floor(wealth_earned * (JUICERNAUT_BUFFS.WEALTH_MULTIPLIER - 1))
        wealth_earned += wealthBonus
      }

      // Apply XP buff (2x)
      if (juicernautBuffs.hasXpBuff) {
        xpBonus = Math.floor(xp_earned * (JUICERNAUT_BUFFS.XP_MULTIPLIER - 1))
        xp_earned += xpBonus
      }

      if (wealthBonus > 0 || xpBonus > 0) {
        juicernautBonuses = { wealthBonus, xpBonus }
      }
    }

    // Apply faction territory buffs
    let factionBonuses: { wealthBonus: number; xpBonus: number; buffsApplied: string[] } | undefined
    const factionBuffs = await FactionService.getAggregatedBuffs(user_id)
    if (Object.keys(factionBuffs).length > 0) {
      let factionWealthBonus = 0
      let factionXpBonus = 0
      const buffsApplied: string[] = []

      // Apply XP buff (from xp territories like Chrome Heights, Midtown, Ashfall)
      if (factionBuffs['xp']) {
        factionXpBonus = Math.floor(xp_earned * (factionBuffs['xp'] / 100))
        xp_earned += factionXpBonus
        buffsApplied.push(`+${factionBuffs['xp']}% XP`)
      }

      // Apply wealth buff (from Memorial District)
      if (factionBuffs['wealth']) {
        factionWealthBonus = Math.floor(wealth_earned * (factionBuffs['wealth'] / 100))
        wealth_earned += factionWealthBonus
        buffsApplied.push(`+${factionBuffs['wealth']}% Wealth`)
      }

      // Apply all_rewards buff (from Freeport - applies to both)
      if (factionBuffs['all_rewards']) {
        const allWealthBonus = Math.floor(wealth_earned * (factionBuffs['all_rewards'] / 100))
        const allXpBonus = Math.floor(xp_earned * (factionBuffs['all_rewards'] / 100))
        wealth_earned += allWealthBonus
        xp_earned += allXpBonus
        factionWealthBonus += allWealthBonus
        factionXpBonus += allXpBonus
        buffsApplied.push(`+${factionBuffs['all_rewards']}% All`)
      }

      if (factionWealthBonus > 0 || factionXpBonus > 0) {
        factionBonuses = {
          wealthBonus: factionWealthBonus,
          xpBonus: factionXpBonus,
          buffsApplied,
        }
      }
    }

    // Roll for crate drop
    // Apply Juicernaut loot buff (3x) and faction crate_drop buff (e.g., +10% from Silicon Sprawl)
    let crateDropChance = PLAY_CRATE_DROP_CHANCE
    if (juicernautBuffs.hasLootBuff) {
      crateDropChance *= JUICERNAUT_BUFFS.LOOT_MULTIPLIER
    }
    if (factionBuffs['crate_drop']) {
      crateDropChance *= (1 + factionBuffs['crate_drop'] / 100)
    }
    const crateDropped = Math.random() < crateDropChance
    let crate_tier: CrateTier | undefined
    let crateToEscrow = false
    let crateLost = false

    if (crateDropped) {
      crate_tier = this.rollCrateTier(playerTier)
    }

    // CRIT-07 fix: Ensure negative events don't take wealth below 0
    // Cap loss to current wealth (can't lose more than you have)
    const currentWealth = Number(user.wealth)
    if (wealth_earned < 0 && Math.abs(wealth_earned) > currentWealth) {
      wealth_earned = -currentWealth // At most, lose everything
    }

    // Process rewards in transaction (including crate award for atomicity)
    const result = await prisma.$transaction(async (tx) => {
      // Update user stats
      const newXp = (user.xp ?? BigInt(0)) + BigInt(xp_earned)
      const newLevel = levelFromXp(Number(newXp))
      const newTier = getTierFromLevel(newLevel)
      const levelUp = newLevel > (user.level ?? 1)
      const tierPromotion = newTier !== user.status_tier

      await tx.users.update({
        where: { id: user_id },
        data: {
          wealth: { increment: wealth_earned },
          xp: newXp,
          level: newLevel,
          status_tier: newTier,
          total_play_count: { increment: 1 },
          last_seen: new Date(),
        },
      })

      // Record game event
      await tx.game_events.create({
        data: {
          user_id,
          event_type: 'play',
          wealth_change: wealth_earned,
          xp_change: xp_earned,
          tier: playerTier,
          event_description: `${event.name}: ${event.description}`,
          success: true,
          was_busted: false,
        },
      })

      // Award crate if dropped (INSIDE transaction for atomicity - CRIT-01 fix)
      let crateResult = null
      if (crateDropped && crate_tier) {
        crateResult = await CrateService.awardCrate(user_id, crate_tier, CRATE_SOURCES.PLAY, tx)
      }

      return { newLevel, newTier, levelUp, tierPromotion, crateResult }
    })

    // Extract crate result from transaction
    if (result.crateResult) {
      crateToEscrow = result.crateResult.toEscrow
      crateLost = result.crateResult.lost
    }

    // MED-01 fix: Wrap non-critical external calls to prevent failures from crashing play
    // Update leaderboard snapshots
    await safeVoid(
      () => LeaderboardService.updateSnapshot(user_id, {
        play_count: 1,
        wealth_earned,
        xp_earned,
        crates_opened: crateDropped ? 1 : 0,
      }),
      'play.service:leaderboard'
    )

    // Update mission progress
    await safeVoid(
      () => MissionService.updateProgress(user_id, MISSION_OBJECTIVE_TYPES.PLAY_COUNT, 1),
      'play.service:mission:play_count'
    )
    await safeVoid(
      () => MissionService.updateProgress(user_id, MISSION_OBJECTIVE_TYPES.WEALTH_EARNED, wealth_earned),
      'play.service:mission:wealth_earned'
    )

    // Update achievement progress
    await safeVoid(
      () => AchievementService.incrementProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.PLAY_COUNT, 1),
      'play.service:achievement:play_count'
    )
    await safeVoid(
      () => AchievementService.incrementProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.TOTAL_WEALTH_EARNED, wealth_earned),
      'play.service:achievement:wealth_earned'
    )

    // Check level achievements
    if (result.levelUp) {
      await safeVoid(
        () => AchievementService.setProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.LEVEL, result.newLevel),
        'play.service:achievement:level'
      )
      // Notify level up
      await safeVoid(
        () => NotificationService.notifyLevelUp(user_id, result.newLevel),
        'play.service:notification:levelUp'
      )
    }

    // Notify tier promotion (also post to Discord for Captain+)
    if (result.tierPromotion && result.newTier) {
      await safeVoid(
        () => NotificationService.notifyTierPromotion(user_id, result.newTier),
        'play.service:notification:tierPromotion'
      )
      await safeVoid(
        () => DiscordService.postTierPromotion(user.username, result.newTier as Tier),
        'play.service:discord:tierPromotion'
      )
    }

    // Add territory score for faction (10 points per play)
    await safeVoid(
      () => FactionService.addTerritoryScore(user_id, 'play'),
      'play.service:faction:territoryScore'
    )

    return {
      success: true,
      busted: false,
      jailed: false,
      eventName: event.name,
      event_description: event.description,
      wealth_earned,
      xp_earned,
      levelUp: result.levelUp,
      newLevel: result.levelUp ? result.newLevel : undefined,
      tierPromotion: result.tierPromotion,
      newTier: result.tierPromotion ? result.newTier : undefined,
      crateDropped,
      crate_tier,
      crateToEscrow,
      crateLost,
      juicernautBonuses,
      factionBonuses,
    }
  },

  /**
   * Handle bust scenario
   */
  async handleBust(user_id: number, playerTier: Tier): Promise<PlayResult> {
    // Select the event that would have happened (for flavor text)
    const event = this.selectEvent(playerTier)

    // Jail the user
    const jailExpiresAt = await JailService.jailUser(user_id)

    // Record the bust event
    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user_id },
        data: {
          total_play_count: { increment: 1 },
          last_seen: new Date(),
        },
      })

      await tx.game_events.create({
        data: {
          user_id,
          event_type: 'play',
          wealth_change: 0,
          xp_change: 0,
          tier: playerTier,
          event_description: `BUSTED during ${event.name}! Jailed for 1 hour.`,
          success: false,
          was_busted: true,
        },
      })
    })

    // MED-06 fix: Wrap non-critical tracking calls with safeVoid
    // Still counts as a play attempt for leaderboards
    await safeVoid(
      () => LeaderboardService.updateSnapshot(user_id, { play_count: 1 }),
      'play.service:leaderboard:bust'
    )

    // Update mission progress (play still counts)
    await safeVoid(
      () => MissionService.updateProgress(user_id, MISSION_OBJECTIVE_TYPES.PLAY_COUNT, 1),
      'play.service:mission:bust'
    )

    // Update achievement progress
    await safeVoid(
      () => AchievementService.incrementProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.PLAY_COUNT, 1),
      'play.service:achievement:play_count:bust'
    )
    await safeVoid(
      () => AchievementService.incrementProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.BUST_COUNT, 1),
      'play.service:achievement:bustCount'
    )

    return {
      success: false,
      busted: true,
      jailed: true,
      jailExpiresAt,
      eventName: event.name,
      event_description: `BUSTED! The heat came down during your ${event.name}.`,
      wealth_earned: 0,
      xp_earned: 0,
      levelUp: false,
      tierPromotion: false,
      crateDropped: false,
    }
  },

  /**
   * Select random event based on player tier
   * CRIT-07 fix: 15% chance of negative event, 85% positive
   */
  selectEvent(tier: Tier): PlayEventDef {
    const events = TIER_PLAY_EVENTS[tier]

    // Split events into positive and negative
    const positiveEvents = events.filter(e => !e.isNegative)
    const negativeEvents = events.filter(e => e.isNegative)

    // Roll for negative event (15% chance)
    if (Math.random() < PLAY_CONFIG.NEGATIVE_EVENT_CHANCE && negativeEvents.length > 0) {
      const index = Math.floor(Math.random() * negativeEvents.length)
      return negativeEvents[index]
    }

    // Select from positive events
    const index = Math.floor(Math.random() * positiveEvents.length)
    return positiveEvents[index]
  },

  /**
   * Roll crate tier based on player tier weights
   */
  rollCrateTier(playerTier: Tier): CrateTier {
    const weights = PLAY_CRATE_TIER_WEIGHTS[playerTier]
    const roll = Math.random()

    let cumulative = 0
    if (roll < (cumulative += weights.common)) return CRATE_TIERS.COMMON
    if (roll < (cumulative += weights.uncommon)) return CRATE_TIERS.UNCOMMON
    if (roll < (cumulative += weights.rare)) return CRATE_TIERS.RARE
    return CRATE_TIERS.LEGENDARY
  },

  /**
   * Check for active Juicernaut buffs
   */
  async getJuicernautBuffs(user_id: number): Promise<{
    isJuicernaut: boolean
    hasLootBuff: boolean
    hasWealthBuff: boolean
    hasXpBuff: boolean
  }> {
    const buffs = await prisma.active_buffs.findMany({
      where: {
        user_id,
        is_active: true,
        buff_type: { startsWith: 'juicernaut_' },
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
    })

    const hasWealthBuff = buffs.some(b => b.buff_type === JUICERNAUT_BUFF_TYPES.WEALTH)
    const hasXpBuff = buffs.some(b => b.buff_type === JUICERNAUT_BUFF_TYPES.XP)
    const hasLootBuff = buffs.some(b => b.buff_type === JUICERNAUT_BUFF_TYPES.LOOT)

    // User is Juicernaut if they have any active Juicernaut buff
    const isJuicernaut = hasWealthBuff || hasXpBuff || hasLootBuff

    return {
      isJuicernaut,
      hasLootBuff,
      hasWealthBuff,
      hasXpBuff,
    }
  },

  /**
   * Get play statistics for a user
   */
  async getPlayStats(user_id: number) {
    const [totalPlays, busts, recentEvents] = await Promise.all([
      prisma.game_events.count({
        where: { user_id, event_type: 'play' },
      }),
      prisma.game_events.count({
        where: { user_id, event_type: 'play', was_busted: true },
      }),
      prisma.game_events.findMany({
        where: { user_id, event_type: 'play' },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: {
          wealth_change: true,
          xp_change: true,
          was_busted: true,
          event_description: true,
          created_at: true,
        },
      }),
    ])

    const totalWealth = await prisma.game_events.aggregate({
      where: { user_id, event_type: 'play', was_busted: false },
      _sum: { wealth_change: true },
    })

    const totalXp = await prisma.game_events.aggregate({
      where: { user_id, event_type: 'play', was_busted: false },
      _sum: { xp_change: true },
    })

    return {
      totalPlays,
      successfulPlays: totalPlays - busts,
      busts,
      bustRate: totalPlays > 0 ? (busts / totalPlays) * 100 : 0,
      totalWealthEarned: totalWealth._sum.wealth_change ?? BigInt(0),
      totalXpEarned: totalXp._sum.xp_change ?? 0,
      recentEvents: recentEvents.map(e => ({
        wealth_change: Number(e.wealth_change),
        xp_change: e.xp_change,
        was_busted: e.was_busted,
        event_description: e.event_description,
        created_at: e.created_at,
      })),
    }
  },
}

export default PlayService
