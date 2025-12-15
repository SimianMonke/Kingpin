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
  territoryName: string
}

export interface FactionSummary {
  id: number
  name: string
  description: string | null
  motto: string | null
  colorHex: string | null
  memberCount: number
  territoriesControlled: number
}

export interface FactionDetails extends FactionSummary {
  territories: {
    id: number
    name: string
    buffType: string | null
    buffValue: number | null
    isStarting: boolean
  }[]
  buffs: FactionBuff[]
}

export interface TerritoryStatus {
  id: number
  name: string
  description: string | null
  buffType: string | null
  buffValue: number | null
  isContested: boolean
  controllingFaction: {
    id: number
    name: string
    colorHex: string | null
  } | null
  startingFaction: {
    id: number
    name: string
  } | null
  scores: {
    factionId: number
    factionName: string
    colorHex: string | null
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
  territoryId: number
  territoryName: string
  previousFactionId: number | null
  previousFactionName: string | null
  newFactionId: number | null
  newFactionName: string | null
}

export interface WeeklyRewardResult {
  userId: number
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
    const factions = await prisma.faction.findMany({
      include: {
        _count: {
          select: { members: true },
        },
        controlledTerritories: {
          select: { id: true },
        },
      },
      orderBy: { factionName: 'asc' },
    })

    return factions.map(f => ({
      id: f.id,
      name: f.factionName,
      description: f.description,
      motto: f.motto,
      colorHex: f.colorHex,
      memberCount: f._count.members,
      territoriesControlled: f.controlledTerritories.length,
    }))
  },

  /**
   * Get detailed faction info including controlled territories and buffs
   */
  async getFactionDetails(factionId: number): Promise<FactionDetails | null> {
    const faction = await prisma.faction.findUnique({
      where: { id: factionId },
      include: {
        _count: {
          select: { members: true },
        },
        controlledTerritories: {
          select: {
            id: true,
            territoryName: true,
            buffType: true,
            buffValue: true,
            startingFactionId: true,
          },
        },
        startingTerritories: {
          select: { id: true },
        },
      },
    })

    if (!faction) return null

    const startingTerritoryIds = new Set(faction.startingTerritories.map(t => t.id))

    const territories = faction.controlledTerritories.map(t => ({
      id: t.id,
      name: t.territoryName,
      buffType: t.buffType,
      buffValue: t.buffValue,
      isStarting: startingTerritoryIds.has(t.id),
    }))

    // Calculate total buffs from controlled territories
    const buffs: FactionBuff[] = faction.controlledTerritories
      .filter(t => t.buffType && t.buffValue)
      .map(t => ({
        type: t.buffType!,
        value: t.buffValue!,
        territoryName: t.territoryName,
      }))

    return {
      id: faction.id,
      name: faction.factionName,
      description: faction.description,
      motto: faction.motto,
      colorHex: faction.colorHex,
      memberCount: faction._count.members,
      territoriesControlled: faction.controlledTerritories.length,
      territories,
      buffs,
    }
  },

  /**
   * Get user's current faction details
   */
  async getUserFaction(userId: number): Promise<FactionDetails | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { factionId: true },
    })

    if (!user?.factionId) return null

    return this.getFactionDetails(user.factionId)
  },

  /**
   * Join a faction
   */
  async joinFaction(userId: number, factionName: string): Promise<JoinFactionResult> {
    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        level: true,
        factionId: true,
        factionCooldownUntil: true,
        assignedTerritoryId: true,
      },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Check level requirement (must be Associate tier - level 20+)
    if (user.level < FACTION_CONFIG.MIN_LEVEL_TO_JOIN) {
      return {
        success: false,
        error: `You must be level ${FACTION_CONFIG.MIN_LEVEL_TO_JOIN}+ (Associate tier) to join a faction.`,
      }
    }

    // Check if already in a faction
    if (user.factionId) {
      return { success: false, error: 'You are already in a faction. Leave your current faction first.' }
    }

    // Check cooldown from previous faction
    if (user.factionCooldownUntil && user.factionCooldownUntil > new Date()) {
      const remaining = Math.ceil((user.factionCooldownUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return {
        success: false,
        error: `You must wait ${remaining} more day(s) before joining a new faction.`,
      }
    }

    // Find the faction
    const faction = await prisma.faction.findFirst({
      where: {
        factionName: {
          equals: factionName,
          mode: 'insensitive',
        },
      },
    })

    if (!faction) {
      return { success: false, error: `Faction "${factionName}" not found.` }
    }

    // Check if user is switching (had previous faction history)
    const previousMembership = await prisma.factionMembershipHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const isSwitching = previousMembership !== null

    // Assign to territory with fewest members in this faction
    const assignedTerritory = await this.assignToTerritoryWithFewestMembers(userId, faction.id)

    // Update user and record membership
    await prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id: userId },
        data: {
          factionId: faction.id,
          joinedFactionAt: new Date(),
          assignedTerritoryId: assignedTerritory?.id ?? null,
          // Set reward cooldown if switching
          factionRewardCooldownUntil: isSwitching
            ? new Date(Date.now() + FACTION_CONFIG.REWARD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
            : null,
        },
      })

      // Record membership history
      await tx.factionMembershipHistory.create({
        data: {
          userId,
          factionId: faction.id,
          action: isSwitching ? 'switched' : 'joined',
        },
      })

      // Update faction member count
      await tx.faction.update({
        where: { id: faction.id },
        data: { totalMembers: { increment: 1 } },
      })

      // Create territory assignment record if assigned
      if (assignedTerritory) {
        await tx.userTerritoryAssignment.create({
          data: {
            userId,
            territoryId: assignedTerritory.id,
          },
        })
      }
    })

    const factionDetails = await this.getFactionDetails(faction.id)

    return {
      success: true,
      faction: factionDetails ?? undefined,
      assignedTerritory: assignedTerritory?.territoryName,
    }
  },

  /**
   * Leave current faction
   */
  async leaveFaction(userId: number): Promise<LeaveFactionResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        factionId: true,
        assignedTerritoryId: true,
      },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    if (!user.factionId) {
      return { success: false, error: 'You are not in a faction.' }
    }

    const cooldownUntil = new Date(Date.now() + FACTION_CONFIG.SWITCH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // Record membership history
      await tx.factionMembershipHistory.create({
        data: {
          userId,
          factionId: user.factionId!,
          action: 'left',
        },
      })

      // Remove territory assignment
      if (user.assignedTerritoryId) {
        await tx.userTerritoryAssignment.deleteMany({
          where: { userId },
        })
      }

      // Update faction member count
      await tx.faction.update({
        where: { id: user.factionId! },
        data: { totalMembers: { decrement: 1 } },
      })

      // Update user
      await tx.user.update({
        where: { id: userId },
        data: {
          factionId: null,
          joinedFactionAt: null,
          assignedTerritoryId: null,
          factionCooldownUntil: cooldownUntil,
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
    userId: number,
    factionId: number
  ): Promise<{ id: number; territoryName: string } | null> {
    // Get all territories controlled by or aligned with this faction
    const territories = await prisma.territory.findMany({
      where: {
        OR: [
          { controllingFactionId: factionId },
          { startingFactionId: factionId },
        ],
      },
      include: {
        userAssignments: {
          select: { id: true },
        },
      },
    })

    if (territories.length === 0) {
      // Assign to any territory if faction controls none
      const anyTerritory = await prisma.territory.findFirst({
        orderBy: { id: 'asc' },
      })
      return anyTerritory ? { id: anyTerritory.id, territoryName: anyTerritory.territoryName } : null
    }

    // Find territory with fewest assignments
    const sorted = territories.sort((a, b) => a.userAssignments.length - b.userAssignments.length)
    return { id: sorted[0].id, territoryName: sorted[0].territoryName }
  },

  // ===========================================================================
  // TERRITORY OPERATIONS
  // ===========================================================================

  /**
   * Get all territories with current status
   */
  async getTerritoryStatus(): Promise<TerritoryStatus[]> {
    // Get current date for score lookup
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const territories = await prisma.territory.findMany({
      include: {
        controllingFaction: {
          select: { id: true, factionName: true, colorHex: true },
        },
        startingFaction: {
          select: { id: true, factionName: true },
        },
        scores: {
          where: { scoreDate: today },
          include: {
            faction: {
              select: { id: true, factionName: true, colorHex: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    return territories.map(t => ({
      id: t.id,
      name: t.territoryName,
      description: t.description,
      buffType: t.buffType,
      buffValue: t.buffValue,
      isContested: t.isContested,
      controllingFaction: t.controllingFaction
        ? {
            id: t.controllingFaction.id,
            name: t.controllingFaction.factionName,
            colorHex: t.controllingFaction.colorHex,
          }
        : null,
      startingFaction: t.startingFaction
        ? {
            id: t.startingFaction.id,
            name: t.startingFaction.factionName,
          }
        : null,
      scores: t.scores.map(s => ({
        factionId: s.faction.id,
        factionName: s.faction.factionName,
        colorHex: s.faction.colorHex,
        score: Number(s.totalScore),
      })),
    }))
  },

  /**
   * Get user's assigned territory
   */
  async getUserTerritory(userId: number): Promise<TerritoryStatus | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { assignedTerritoryId: true },
    })

    if (!user?.assignedTerritoryId) return null

    const territories = await this.getTerritoryStatus()
    return territories.find(t => t.id === user.assignedTerritoryId) ?? null
  },

  // ===========================================================================
  // TERRITORY SCORING
  // ===========================================================================

  /**
   * Add territory score for user activity
   * Called by play, rob, checkin, mission services
   * MED-03 fix: Now validates activity type at runtime
   */
  async addTerritoryScore(userId: number, activity: FactionActivityType): Promise<void> {
    // MED-03 fix: Validate activity type at runtime
    if (!isValidActivityType(activity)) {
      console.error(`[FactionService] Invalid activity type: ${activity}`)
      return
    }

    // Get user's faction and assigned territory
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        factionId: true,
        assignedTerritoryId: true,
      },
    })

    // User must be in a faction and have assigned territory
    if (!user?.factionId || !user?.assignedTerritoryId) return

    const points = TERRITORY_SCORE_POINTS[activity.toUpperCase() as keyof typeof TERRITORY_SCORE_POINTS] ?? 0
    if (points === 0) return

    // Get today's date at midnight UTC
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Get the scoring field to increment (now safe after validation)
    const fieldMap: Record<FactionActivityType, string> = {
      message: 'messages',
      play: 'plays',
      rob: 'robs',
      mission: 'missions',
      checkin: 'checkins',
    }

    const field = fieldMap[activity]

    // Upsert the territory score for today
    await prisma.territoryScore.upsert({
      where: {
        territoryId_factionId_scoreDate: {
          territoryId: user.assignedTerritoryId,
          factionId: user.factionId,
          scoreDate: today,
        },
      },
      update: {
        totalScore: { increment: points },
        [field]: { increment: 1 },
      },
      create: {
        territoryId: user.assignedTerritoryId,
        factionId: user.factionId,
        scoreDate: today,
        totalScore: points,
        [field]: 1,
      },
    })
  },

  // ===========================================================================
  // BUFF SYSTEM
  // ===========================================================================

  /**
   * Get all active faction buffs for a user
   */
  async getFactionBuffs(userId: number): Promise<FactionBuff[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { factionId: true },
    })

    if (!user?.factionId) return []

    // Get all territories controlled by user's faction
    const territories = await prisma.territory.findMany({
      where: {
        controllingFactionId: user.factionId,
        buffType: { not: null },
        buffValue: { not: null },
      },
      select: {
        territoryName: true,
        buffType: true,
        buffValue: true,
      },
    })

    return territories.map(t => ({
      type: t.buffType!,
      value: t.buffValue!,
      territoryName: t.territoryName,
    }))
  },

  /**
   * Calculate aggregated buff values by type
   * Buffs stack additively
   */
  async getAggregatedBuffs(userId: number): Promise<Record<string, number>> {
    const buffs = await this.getFactionBuffs(userId)

    const aggregated: Record<string, number> = {}
    for (const buff of buffs) {
      aggregated[buff.type] = (aggregated[buff.type] ?? 0) + buff.value
    }

    return aggregated
  },

  /**
   * Apply buff to a reward value
   */
  applyBuff(buffType: string, buffValue: number, amount: number): number {
    // Buff value is a percentage (e.g., 5 means +5%)
    return Math.floor(amount * (1 + buffValue / 100))
  },

  // ===========================================================================
  // SCHEDULED JOBS
  // ===========================================================================

  /**
   * Evaluate territory control based on daily scores
   * Called at midnight UTC daily
   */
  async evaluateTerritoryControl(): Promise<TerritoryChangeResult[]> {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const territories = await prisma.territory.findMany({
      include: {
        controllingFaction: true,
        scores: {
          where: { scoreDate: today },
          orderBy: { totalScore: 'desc' },
          include: {
            faction: { select: { id: true, factionName: true } },
          },
        },
      },
    })

    const changes: TerritoryChangeResult[] = []

    for (const territory of territories) {
      const scores = territory.scores
      if (scores.length === 0) continue

      let newControllerId: number | null = null

      if (territory.isContested) {
        // Contested: Need 2x second place to control
        if (scores.length >= 2) {
          const first = scores[0]
          const second = scores[1]
          if (Number(first.totalScore) >= Number(second.totalScore) * 2) {
            newControllerId = first.factionId
          }
          // If not 2x, remains neutral or keeps current
        } else if (scores.length === 1 && Number(scores[0].totalScore) > 0) {
          // Only one faction competing, they take it
          newControllerId = scores[0].factionId
        }
      } else {
        // Standard: Highest score wins
        if (Number(scores[0].totalScore) > 0) {
          newControllerId = scores[0].factionId
        }
      }

      // Check if control changed
      if (newControllerId !== territory.controllingFactionId) {
        const previousFaction = territory.controllingFaction
        const newFaction = newControllerId
          ? scores.find(s => s.factionId === newControllerId)?.faction
          : null

        changes.push({
          territoryId: territory.id,
          territoryName: territory.territoryName,
          previousFactionId: territory.controllingFactionId,
          previousFactionName: previousFaction?.factionName ?? null,
          newFactionId: newControllerId,
          newFactionName: newFaction?.factionName ?? null,
        })

        // Update territory
        await prisma.territory.update({
          where: { id: territory.id },
          data: {
            controllingFactionId: newControllerId,
            controlChangedAt: new Date(),
            lastEvaluatedAt: new Date(),
          },
        })

        // Update faction territory counts
        if (territory.controllingFactionId) {
          await prisma.faction.update({
            where: { id: territory.controllingFactionId },
            data: { territoriesControlled: { decrement: 1 } },
          })
        }
        if (newControllerId) {
          await prisma.faction.update({
            where: { id: newControllerId },
            data: { territoriesControlled: { increment: 1 } },
          })
        }
      } else {
        // Just update last evaluated
        await prisma.territory.update({
          where: { id: territory.id },
          data: { lastEvaluatedAt: new Date() },
        })
      }
    }

    return changes
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
    const factions = await prisma.faction.findMany({
      include: {
        controlledTerritories: {
          select: { id: true, isContested: true },
        },
        members: {
          where: {
            // Must be eligible for rewards (not on cooldown)
            OR: [
              { factionRewardCooldownUntil: null },
              { factionRewardCooldownUntil: { lte: now } },
            ],
          },
          select: {
            id: true,
            assignedTerritoryId: true,
            statusTier: true,
          },
        },
      },
    })

    // Find faction with most territories (winner bonus)
    let maxTerritories = 0
    let winningFactionId: number | null = null
    for (const faction of factions) {
      if (faction.controlledTerritories.length > maxTerritories) {
        maxTerritories = faction.controlledTerritories.length
        winningFactionId = faction.id
      }
    }

    // Calculate active members and distribute rewards
    for (const faction of factions) {
      if (faction.controlledTerritories.length === 0) continue

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

      for (const territory of faction.controlledTerritories) {
        let territoryWealth = TERRITORY_REWARDS.BASE_WEALTH_PER_TERRITORY
        let territoryXp = TERRITORY_REWARDS.BASE_XP_PER_TERRITORY

        if (territory.isContested) {
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
        const isTopContributor = topContributors.some(tc => tc.userId === member.userId)
        const crateToAward = isTopContributor ? CRATE_TIERS.RARE : null

        await prisma.user.update({
          where: { id: member.userId },
          data: {
            wealth: { increment: perMemberWealth },
            xp: { increment: perMemberXp },
          },
        })

        // Award crate to top contributors
        if (crateToAward) {
          await CrateService.awardCrate(member.userId, crateToAward, CRATE_SOURCES.FACTION)
        }

        results.push({
          userId: member.userId,
          wealth: perMemberWealth,
          xp: perMemberXp,
          crateAwarded: crateToAward,
          territoriesContributed: faction.controlledTerritories.length,
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
    factionId: number,
    weekStart: Date,
    weekEnd: Date
  ): Promise<{ userId: number; totalScore: number }[]> {
    // Sum up each user's contribution across all territories
    const contributions = await prisma.$queryRaw<{ user_id: number; total_score: bigint }[]>`
      SELECT u.user_id, COALESCE(SUM(ts.total_score), 0) as total_score
      FROM users u
      LEFT JOIN territory_scores ts ON ts.faction_id = ${factionId}
        AND ts.score_date >= ${weekStart}
        AND ts.score_date < ${weekEnd}
        AND ts.territory_id = u.assigned_territory_id
      WHERE u.faction_id = ${factionId}
      GROUP BY u.user_id
      HAVING COALESCE(SUM(ts.total_score), 0) >= ${TERRITORY_REWARDS.MIN_CONTRIBUTION_FOR_REWARD}
    `

    return contributions.map(c => ({
      userId: c.user_id,
      totalScore: Number(c.total_score),
    }))
  },

  /**
   * Get top N contributors for a faction in the week
   */
  async getTopContributors(
    factionId: number,
    weekStart: Date,
    weekEnd: Date,
    limit: number
  ): Promise<{ userId: number; totalScore: number }[]> {
    const contributions = await prisma.$queryRaw<{ user_id: number; total_score: bigint }[]>`
      SELECT u.user_id, COALESCE(SUM(ts.total_score), 0) as total_score
      FROM users u
      LEFT JOIN territory_scores ts ON ts.faction_id = ${factionId}
        AND ts.score_date >= ${weekStart}
        AND ts.score_date < ${weekEnd}
        AND ts.territory_id = u.assigned_territory_id
      WHERE u.faction_id = ${factionId}
      GROUP BY u.user_id
      ORDER BY total_score DESC
      LIMIT ${limit}
    `

    return contributions.map(c => ({
      userId: c.user_id,
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

    // Get all factions with weekly scores
    const factions = await prisma.faction.findMany({
      include: {
        _count: {
          select: { members: true },
        },
        controlledTerritories: {
          select: { id: true },
        },
        territoryScores: {
          where: {
            scoreDate: {
              gte: weekStart,
              lt: weekEnd,
            },
          },
        },
      },
    })

    // Calculate total weekly score per faction
    const factionsWithScores = factions.map(f => {
      const weeklyScore = f.territoryScores.reduce(
        (sum, s) => sum + Number(s.totalScore),
        0
      )

      return {
        id: f.id,
        name: f.factionName,
        description: f.description,
        motto: f.motto,
        colorHex: f.colorHex,
        memberCount: f._count.members,
        territoriesControlled: f.controlledTerritories.length,
        weeklyScore,
        rank: 0,
      }
    })

    // Sort by territories controlled, then weekly score
    factionsWithScores.sort((a, b) => {
      if (b.territoriesControlled !== a.territoriesControlled) {
        return b.territoriesControlled - a.territoriesControlled
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
  async getUserFactionRank(userId: number): Promise<{
    rank: number
    totalMembers: number
    weeklyScore: number
  } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { factionId: true, assignedTerritoryId: true },
    })

    if (!user?.factionId) return null

    // Get current week bounds
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    weekStart.setUTCHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

    // Get all faction members with their scores
    const members = await this.getActiveMembersForWeek(user.factionId, weekStart, weekEnd)

    // Also include members with 0 score
    const allMembers = await prisma.user.count({
      where: { factionId: user.factionId },
    })

    // Find user's score
    const userScore = members.find(m => m.userId === userId)?.totalScore ?? 0

    // Calculate rank (higher score = better rank)
    const rank = members.filter(m => m.totalScore > userScore).length + 1

    return {
      rank,
      totalMembers: allMembers,
      weeklyScore: userScore,
    }
  },
}

export default FactionService
