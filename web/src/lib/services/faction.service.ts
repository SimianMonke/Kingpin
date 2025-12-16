import { prisma } from '../db'
import {
  FACTION_CONFIG,
  TERRITORY_SCORE_POINTS,
  TERRITORY_REWARDS,
  TIERS,
  CRATE_TIERS,
  CRATE_SOURCES,
  type Tier,
} from '../game'
import { getTierFromLevel } from '../game/formulas'
import { CrateService } from './crate.service'

// =============================================================================
// FACTION SERVICE TYPES
// =============================================================================

export type FactionActivityType = 'message' | 'play' | 'rob' | 'mission' | 'checkin'

// MED-03 fix: Valid activity types for runtime validation
const VALID_ACTIVITY_TYPES: readonly FactionActivityType[] = ['message', 'play', 'rob', 'mission', 'checkin'] as const

/**
 * MED-03 fix: Type guard to validate activity type at runtime
 */
function isValidActivityType(activity: string): activity is FactionActivityType {
  return VALID_ACTIVITY_TYPES.includes(activity as FactionActivityType)
}

export interface FactionBuff {
  type: string
  value: number
  name: string
}

export interface FactionSummary {
  id: number
  name: string
  description: string | null
  motto: string | null
  color_hex: string | null
  memberCount: number
  territories_controlled: number
}

export interface FactionDetails extends FactionSummary {
  territories: {
    id: number
    name: string
    buff_type: string | null
    buff_value: number | null
    isStarting: boolean
  }[]
  buffs: FactionBuff[]
}

export interface TerritoryStatus {
  id: number
  name: string
  description: string | null
  buff_type: string | null
  buff_value: number | null
  is_contested: boolean | null
  controllingFaction: {
    id: number
    name: string
    color_hex: string | null
  } | null
  scores: {
    faction_id: number
    name: string
    color_hex: string | null
    score: number
  }[]
}

export interface JoinFactionResult {
  success: boolean
  error?: string
  faction?: FactionDetails
  assignedTerritory?: string
}

export interface LeaveFactionResult {
  success: boolean
  error?: string
  cooldownUntil?: Date
}

export interface TerritoryChangeResult {
  territory_id: number
  name: string
  previousFactionId: number | null
  previousFactionName: string | null
  newFactionId: number | null
  newFactionName: string | null
}

export interface WeeklyRewardResult {
  user_id: number
  wealth: number
  xp: number
  crateAwarded: string | null
  territoriesContributed: number
}

// =============================================================================
// FACTION SERVICE
// =============================================================================

export const FactionService = {
  // ===========================================================================
  // FACTION MEMBERSHIP
  // ===========================================================================

  /**
   * Get all factions with summary stats
   */
  async getAllFactions(): Promise<FactionSummary[]> {
    const factions = await prisma.factions.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        territories: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return factions.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      motto: f.motto,
      color_hex: f.color_hex,
      memberCount: f._count.users,
      territories_controlled: f.territories.length,
    }))
  },

  /**
   * Get detailed faction info including controlled territories and buffs
   */
  async getFactionDetails(faction_id: number): Promise<FactionDetails | null> {
    const faction = await prisma.factions.findUnique({
      where: { id: faction_id },
      include: {
        _count: {
          select: { users: true },
        },
        territories: {
          select: {
            id: true,
            name: true,
            buff_type: true,
            buff_value: true,
          },
        },
      },
    })

    if (!faction) return null

    const territories = faction.territories.map((t) => ({
      id: t.id,
      name: t.name,
      buff_type: t.buff_type,
      buff_value: t.buff_value,
      isStarting: false, // Simplified - startingFactionId doesn't exist in schema
    }))

    // Calculate total buffs from controlled territories
    const buffs: FactionBuff[] = faction.territories
      .filter((t) => t.buff_type && t.buff_value)
      .map((t) => ({
        type: t.buff_type!,
        value: t.buff_value!,
        name: t.name,
      }))

    return {
      id: faction.id,
      name: faction.name,
      description: faction.description,
      motto: faction.motto,
      color_hex: faction.color_hex,
      memberCount: faction._count.users,
      territories_controlled: faction.territories.length,
      territories,
      buffs,
    }
  },

  /**
   * Get user's current faction details
   */
  async getUserFaction(user_id: number): Promise<FactionDetails | null> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { faction_id: true },
    })

    if (!user?.faction_id) return null

    return this.getFactionDetails(user.faction_id)
  },

  /**
   * Join a faction
   */
  async joinFaction(user_id: number, name: string): Promise<JoinFactionResult> {
    // Get user data
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        level: true,
        faction_id: true,
        faction_cooldown_until: true,
        assigned_territory_id: true,
      },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Check level requirement (must be Associate tier - level 20+)
    if ((user.level ?? 0) < FACTION_CONFIG.MIN_LEVEL_TO_JOIN) {
      return {
        success: false,
        error: `You must be level ${FACTION_CONFIG.MIN_LEVEL_TO_JOIN}+ (Associate tier) to join a faction.`,
      }
    }

    // Check if already in a faction
    if (user.faction_id) {
      return { success: false, error: 'You are already in a faction. Leave your current faction first.' }
    }

    // Check cooldown from previous faction
    if (user.faction_cooldown_until && user.faction_cooldown_until > new Date()) {
      const remaining = Math.ceil((user.faction_cooldown_until.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return {
        success: false,
        error: `You must wait ${remaining} more day(s) before joining a new faction.`,
      }
    }

    // Find the faction
    const faction = await prisma.factions.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    })

    if (!faction) {
      return { success: false, error: `Faction "${name}" not found.` }
    }

    // Check if user is switching (had previous faction)
    const currentUser = await prisma.users.findUnique({
      where: { id: user_id },
      select: { joined_faction_at: true },
    })
    const isSwitching = currentUser?.joined_faction_at !== null

    // Assign to territory with fewest members in this faction
    const assignedTerritory = await this.assignToTerritoryWithFewestMembers(user_id, faction.id)

    // Update user and record membership
    await prisma.$transaction(async (tx) => {
      // Update user
      await tx.users.update({
        where: { id: user_id },
        data: {
          faction_id: faction.id,
          joined_faction_at: new Date(),
          assigned_territory_id: assignedTerritory?.id ?? null,
          // Set reward cooldown if switching
          faction_reward_cooldown_until: isSwitching
            ? new Date(Date.now() + FACTION_CONFIG.REWARD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
            : null,
        },
      })

      // Update faction member count
      await tx.factions.update({
        where: { id: faction.id },
        data: { total_members: { increment: 1 } },
      })

    })

    const factionDetails = await this.getFactionDetails(faction.id)

    return {
      success: true,
      faction: factionDetails ?? undefined,
      assignedTerritory: assignedTerritory?.name,
    }
  },

  /**
   * Leave current faction
   */
  async leaveFaction(user_id: number): Promise<LeaveFactionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        faction_id: true,
        assigned_territory_id: true,
      },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    if (!user.faction_id) {
      return { success: false, error: 'You are not in a faction.' }
    }

    const cooldownUntil = new Date(Date.now() + FACTION_CONFIG.SWITCH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // Update faction member count
      await tx.factions.update({
        where: { id: user.faction_id! },
        data: { total_members: { decrement: 1 } },
      })

      // Update user
      await tx.users.update({
        where: { id: user_id },
        data: {
          faction_id: null,
          joined_faction_at: null,
          assigned_territory_id: null,
          faction_cooldown_until: cooldownUntil,
        },
      })
    })

    return {
      success: true,
      cooldownUntil,
    }
  },

  /**
   * Assign user to territory with fewest members
   */
  async assignToTerritoryWithFewestMembers(
    user_id: number,
    faction_id: number
  ): Promise<{ id: number; name: string } | null> {
    // Get all territories controlled by this faction
    const territories = await prisma.territories.findMany({
      where: {
        controlling_faction_id: faction_id,
      },
    })

    if (territories.length === 0) {
      // Assign to any territory if faction controls none
      const anyTerritory = await prisma.territories.findFirst({
        orderBy: { id: 'asc' },
      })
      return anyTerritory ? { id: anyTerritory.id, name: anyTerritory.name } : null
    }

    // Return first controlled territory
    return { id: territories[0].id, name: territories[0].name }
  },

  // ===========================================================================
  // TERRITORY OPERATIONS
  // ===========================================================================

  /**
   * Get all territories with current status
   */
  async getTerritoryStatus(): Promise<TerritoryStatus[]> {
    const territories = await prisma.territories.findMany({
      include: {
        factions: {
          select: { id: true, name: true, color_hex: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    return territories.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      buff_type: t.buff_type,
      buff_value: t.buff_value,
      is_contested: t.is_contested,
      controllingFaction: t.factions
        ? {
            id: t.factions.id,
            name: t.factions.name,
            color_hex: t.factions.color_hex,
          }
        : null,
      scores: [], // Scores feature not implemented in current schema
    }))
  },

  /**
   * Get user's assigned territory
   */
  async getUserTerritory(user_id: number): Promise<TerritoryStatus | null> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { assigned_territory_id: true },
    })

    if (!user?.assigned_territory_id) return null

    const territories = await this.getTerritoryStatus()
    return territories.find(t => t.id === user.assigned_territory_id) ?? null
  },

  // ===========================================================================
  // TERRITORY SCORING
  // ===========================================================================

  /**
   * Add territory score for user activity
   * Called by play, rob, checkin, mission services
   * Note: Territory scoring is not implemented in current schema
   */
  async addTerritoryScore(user_id: number, activity: FactionActivityType): Promise<void> {
    // Territory scoring feature not implemented in current schema
    // This is a no-op placeholder for future implementation
    return
  },

  // ===========================================================================
  // BUFF SYSTEM
  // ===========================================================================

  /**
   * Get all active faction buffs for a user
   */
  async getFactionBuffs(user_id: number): Promise<FactionBuff[]> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { faction_id: true },
    })

    if (!user?.faction_id) return []

    // Get all territories controlled by user's faction
    const territories = await prisma.territories.findMany({
      where: {
        controlling_faction_id: user.faction_id,
        buff_type: { not: null },
        buff_value: { not: null },
      },
      select: {
        name: true,
        buff_type: true,
        buff_value: true,
      },
    })

    return territories.map(t => ({
      type: t.buff_type!,
      value: t.buff_value!,
      name: t.name,
    }))
  },

  /**
   * Calculate aggregated buff values by type
   * Buffs stack additively
   */
  async getAggregatedBuffs(user_id: number): Promise<Record<string, number>> {
    const buffs = await this.getFactionBuffs(user_id)

    const aggregated: Record<string, number> = {}
    for (const buff of buffs) {
      aggregated[buff.type] = (aggregated[buff.type] ?? 0) + buff.value
    }

    return aggregated
  },

  /**
   * Apply buff to a reward value
   */
  applyBuff(buff_type: string, buff_value: number, amount: number): number {
    // Buff value is a percentage (e.g., 5 means +5%)
    return Math.floor(amount * (1 + buff_value / 100))
  },

  // ===========================================================================
  // SCHEDULED JOBS
  // ===========================================================================

  /**
   * Evaluate territory control based on daily scores
   * Called at midnight UTC daily
   * Note: Territory scoring is not implemented in current schema
   */
  async evaluateTerritoryControl(): Promise<TerritoryChangeResult[]> {
    // Territory scoring feature not implemented in current schema
    // This is a no-op placeholder for future implementation
    return []
  },

  /**
   * Distribute weekly rewards to faction members
   * Called Sunday midnight UTC
   */
  async distributeWeeklyRewards(): Promise<WeeklyRewardResult[]> {
    // Get the start of the current week (Monday 00:00 UTC)
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    weekStart.setUTCHours(0, 0, 0, 0)

    const results: WeeklyRewardResult[] = []

    // Get all factions with their controlled territories
    const factions = await prisma.factions.findMany({
      include: {
        territories: {
          select: { id: true, is_contested: true },
        },
        users: {
          where: {
            // Must be eligible for rewards (not on cooldown)
            OR: [
              { faction_reward_cooldown_until: null },
              { faction_reward_cooldown_until: { lte: now } },
            ],
          },
          select: {
            id: true,
            assigned_territory_id: true,
            status_tier: true,
          },
        },
      },
    })

    // Find faction with most territories (winner bonus)
    let maxTerritories = 0
    let winningFactionId: number | null = null
    for (const faction of factions) {
      if (faction.territories.length > maxTerritories) {
        maxTerritories = faction.territories.length
        winningFactionId = faction.id
      }
    }

    // Calculate active members and distribute rewards
    for (const faction of factions) {
      if (faction.territories.length === 0) continue

      // Get members who contributed minimum points this week
      const activeMembers = await this.getActiveMembersForWeek(
        faction.id,
        weekStart,
        now
      )

      if (activeMembers.length === 0) continue

      const isWinningFaction = faction.id === winningFactionId

      // Calculate base rewards per territory
      let baseWealth = 0
      let baseXp = 0
      let contestedCount = 0

      for (const territory of faction.territories) {
        let territoryWealth = TERRITORY_REWARDS.BASE_WEALTH_PER_TERRITORY
        let territoryXp = TERRITORY_REWARDS.BASE_XP_PER_TERRITORY

        if (territory.is_contested) {
          territoryWealth *= TERRITORY_REWARDS.CONTESTED_MULTIPLIER
          territoryXp *= TERRITORY_REWARDS.CONTESTED_MULTIPLIER
          contestedCount++
        }

        baseWealth += territoryWealth
        baseXp += territoryXp
      }

      // Apply winner bonus
      if (isWinningFaction) {
        baseWealth *= 1 + TERRITORY_REWARDS.WINNER_BONUS
        baseXp *= 1 + TERRITORY_REWARDS.WINNER_BONUS
      }

      // Split among active members
      const perMemberWealth = Math.floor(baseWealth / activeMembers.length)
      const perMemberXp = Math.floor(baseXp / activeMembers.length)

      // Award crate to top 3 contributors if winning faction
      const topContributors = isWinningFaction
        ? await this.getTopContributors(faction.id, weekStart, now, 3)
        : []

      // Distribute to each active member
      for (const member of activeMembers) {
        const isTopContributor = topContributors.some(tc => tc.user_id === member.user_id)
        const crateToAward = isTopContributor ? CRATE_TIERS.RARE : null

        await prisma.users.update({
          where: { id: member.user_id },
          data: {
            wealth: { increment: perMemberWealth },
            xp: { increment: perMemberXp },
          },
        })

        // Award crate to top contributors
        if (crateToAward) {
          await CrateService.awardCrate(member.user_id, crateToAward, CRATE_SOURCES.FACTION)
        }

        results.push({
          user_id: member.user_id,
          wealth: perMemberWealth,
          xp: perMemberXp,
          crateAwarded: crateToAward,
          territoriesContributed: faction.territories.length,
        })
      }
    }

    // Reset weekly scores after distribution
    await this.resetWeeklyScores()

    return results
  },

  /**
   * Get members who met minimum contribution threshold for the week
   */
  async getActiveMembersForWeek(
    faction_id: number,
    weekStart: Date,
    weekEnd: Date
  ): Promise<{ user_id: number; totalScore: number }[]> {
    // Sum up each user's contribution across all territories
    const contributions = await prisma.$queryRaw<{ user_id: number; total_score: bigint }[]>`
      SELECT u.user_id, COALESCE(SUM(ts.total_score), 0) as total_score
      FROM users u
      LEFT JOIN territory_scores ts ON ts.faction_id = ${faction_id}
        AND ts.score_date >= ${weekStart}
        AND ts.score_date < ${weekEnd}
        AND ts.territory_id = u.assigned_territory_id
      WHERE u.faction_id = ${faction_id}
      GROUP BY u.user_id
      HAVING COALESCE(SUM(ts.total_score), 0) >= ${TERRITORY_REWARDS.MIN_CONTRIBUTION_FOR_REWARD}
    `

    return contributions.map(c => ({
      user_id: c.user_id,
      totalScore: Number(c.total_score),
    }))
  },

  /**
   * Get top N contributors for a faction in the week
   */
  async getTopContributors(
    faction_id: number,
    weekStart: Date,
    weekEnd: Date,
    limit: number
  ): Promise<{ user_id: number; totalScore: number }[]> {
    const contributions = await prisma.$queryRaw<{ user_id: number; total_score: bigint }[]>`
      SELECT u.user_id, COALESCE(SUM(ts.total_score), 0) as total_score
      FROM users u
      LEFT JOIN territory_scores ts ON ts.faction_id = ${faction_id}
        AND ts.score_date >= ${weekStart}
        AND ts.score_date < ${weekEnd}
        AND ts.territory_id = u.assigned_territory_id
      WHERE u.faction_id = ${faction_id}
      GROUP BY u.user_id
      ORDER BY total_score DESC
      LIMIT ${limit}
    `

    return contributions.map(c => ({
      user_id: c.user_id,
      totalScore: Number(c.total_score),
    }))
  },

  /**
   * Reset weekly territory scores
   * Called after weekly reward distribution
   */
  async resetWeeklyScores(): Promise<void> {
    // We don't delete old scores (keep for history)
    // Daily evaluation already uses scoreDate filter
    // This function is here if we want to archive/cleanup old data
  },

  // ===========================================================================
  // FACTION LEADERBOARD
  // ===========================================================================

  /**
   * Get faction standings for the current period
   */
  async getFactionStandings(): Promise<{
    factions: (FactionSummary & { weeklyScore: number; rank: number })[]
    period: { start: Date; end: Date }
  }> {
    // Get current week bounds
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    weekStart.setUTCHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

    // Get all factions with their territories
    const factions = await prisma.factions.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        territories: {
          select: { id: true },
        },
      },
    })

    // Calculate faction standings (weekly scoring not implemented in current schema)
    const factionsWithScores = factions.map(f => {
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        motto: f.motto,
        color_hex: f.color_hex,
        memberCount: f._count.users,
        territories_controlled: f.territories.length,
        weeklyScore: 0, // Territory scoring not implemented in current schema
        rank: 0,
      }
    })

    // Sort by territories controlled, then weekly score
    factionsWithScores.sort((a, b) => {
      if (b.territories_controlled !== a.territories_controlled) {
        return b.territories_controlled - a.territories_controlled
      }
      return b.weeklyScore - a.weeklyScore
    })

    // Assign ranks
    factionsWithScores.forEach((f, i) => {
      f.rank = i + 1
    })

    return {
      factions: factionsWithScores,
      period: { start: weekStart, end: weekEnd },
    }
  },

  /**
   * Get user's contribution rank within their faction
   */
  async getUserFactionRank(user_id: number): Promise<{
    rank: number
    total_members: number
    weeklyScore: number
  } | null> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { faction_id: true, assigned_territory_id: true },
    })

    if (!user?.faction_id) return null

    // Get current week bounds
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    weekStart.setUTCHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

    // Get all faction members with their scores
    const members = await this.getActiveMembersForWeek(user.faction_id, weekStart, weekEnd)

    // Also include members with 0 score
    const allMembers = await prisma.users.count({
      where: { faction_id: user.faction_id },
    })

    // Find user's score
    const userScore = members.find(m => m.user_id === user_id)?.totalScore ?? 0

    // Calculate rank (higher score = better rank)
    const rank = members.filter(m => m.totalScore > userScore).length + 1

    return {
      rank,
      total_members: allMembers,
      weeklyScore: userScore,
    }
  },
}

export default FactionService
