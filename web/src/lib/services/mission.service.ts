import { prisma } from '../db'
import {
  MISSION_TYPES,
  MISSION_CONFIG,
  MISSION_COMPLETION_BONUS,
  TIER_MULTIPLIERS,
  CRATE_SOURCES,
  type MissionType,
  type Tier,
  type MissionObjectiveType,
  type CrateTier,
} from '../game'
import { getTierFromLevel } from '../game/formulas'
import { CrateService } from './crate.service'
import { FactionService } from './faction.service'
import { UserService } from './user.service'

// =============================================================================
// MISSION SERVICE TYPES
// =============================================================================

export interface UserMissionWithTemplate {
  id: number
  template_id: string | null
  mission_type: string
  assigned_tier: string
  tier_multiplier: number
  objective_value: number
  reward_wealth: number
  reward_xp: number
  current_progress: number | null
  is_completed: boolean | null
  completed_at: Date | null
  assigned_at: Date | null
  expires_at: Date
  status: string | null
  mission_templates: {
    id: string
    name: string
    description: string
    category: string
    difficulty: string
    objective_type: string
  } | null
}

export interface MissionClaimResult {
  success: boolean
  error?: string
  totalWealth: number
  totalXp: number
  bonusWealth: number
  bonusXp: number
  crateAwarded: string | null
  completedMissions: number
}

export interface ActiveMissions {
  daily: UserMissionWithTemplate[]
  weekly: UserMissionWithTemplate[]
  dailyExpiresAt: Date | null
  weeklyExpiresAt: Date | null
  canClaimDaily: boolean
  canClaimWeekly: boolean
  dailyAlreadyClaimed: boolean
  weeklyAlreadyClaimed: boolean
}

// =============================================================================
// MISSION SERVICE
// =============================================================================

export const MissionService = {
  /**
   * Get active missions for a user
   */
  async getActiveMissions(user_id: number): Promise<ActiveMissions> {
    const now = new Date()

    // Get all active missions
    const missions = await prisma.user_missions.findMany({
      where: {
        user_id,
        status: 'active',
        expires_at: { gt: now },
      },
      include: {
        mission_templates: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            difficulty: true,
            objective_type: true,
          },
        },
      },
      orderBy: { assigned_at: 'asc' },
    })

    const daily = missions.filter(m => m.mission_type === MISSION_TYPES.DAILY)
    const weekly = missions.filter(m => m.mission_type === MISSION_TYPES.WEEKLY)

    // Check if already claimed today/this week
    const todayStart = this.getDailyResetTime()
    const weekStart = this.getWeeklyResetTime()

    const [dailyClaim, weeklyClaim] = await Promise.all([
      prisma.mission_completions.findFirst({
        where: {
          user_id,
          completion_type: MISSION_TYPES.DAILY,
          completed_date: { gte: todayStart },
        },
      }),
      prisma.mission_completions.findFirst({
        where: {
          user_id,
          completion_type: MISSION_TYPES.WEEKLY,
          completed_date: { gte: weekStart },
        },
      }),
    ])

    const canClaimDaily = daily.length === MISSION_CONFIG.DAILY_COUNT &&
      daily.every(m => m.is_completed) &&
      !dailyClaim

    const canClaimWeekly = weekly.length === MISSION_CONFIG.WEEKLY_COUNT &&
      weekly.every(m => m.is_completed) &&
      !weeklyClaim

    return {
      daily: daily.map(m => ({
        ...m,
        tier_multiplier: Number(m.tier_multiplier),
      })) as UserMissionWithTemplate[],
      weekly: weekly.map(m => ({
        ...m,
        tier_multiplier: Number(m.tier_multiplier),
      })) as UserMissionWithTemplate[],
      dailyExpiresAt: daily[0]?.expires_at ?? null,
      weeklyExpiresAt: weekly[0]?.expires_at ?? null,
      canClaimDaily,
      canClaimWeekly,
      dailyAlreadyClaimed: !!dailyClaim,
      weeklyAlreadyClaimed: !!weeklyClaim,
    }
  },

  /**
   * Assign daily missions to a user
   */
  async assignDailyMissions(user_id: number): Promise<void> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { level: true, status_tier: true },
    })

    if (!user) return

    const tier = user.status_tier as Tier
    const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0
    const expires_at = this.getNextDailyReset()

    // Get available templates
    const templates = await prisma.mission_templates.findMany({
      where: { mission_type: MISSION_TYPES.DAILY },
    })

    // Select missions ensuring variety (max 1 per category)
    const selectedTemplates = this.selectMissions(
      templates,
      MISSION_CONFIG.DAILY_COUNT
    )

    // Create user missions
    await prisma.user_missions.createMany({
      data: selectedTemplates.map(t => ({
        user_id,
        template_id: t.id,
        mission_type: MISSION_TYPES.DAILY,
        assigned_tier: tier,
        tier_multiplier: multiplier,
        objective_value: Math.ceil(t.objective_base_value * multiplier),
        reward_wealth: Math.floor(t.reward_wealth * multiplier),
        reward_xp: Math.floor(t.reward_xp * multiplier),
        expires_at,
        status: 'active',
      })),
    })
  },

  /**
   * Assign weekly missions to a user
   */
  async assignWeeklyMissions(user_id: number): Promise<void> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { level: true, status_tier: true },
    })

    if (!user) return

    const tier = user.status_tier as Tier
    const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0
    const expires_at = this.getNextWeeklyReset()

    // Get available templates
    const templates = await prisma.mission_templates.findMany({
      where: { mission_type: MISSION_TYPES.WEEKLY },
    })

    // Select missions ensuring variety
    const selectedTemplates = this.selectMissions(
      templates,
      MISSION_CONFIG.WEEKLY_COUNT
    )

    // Create user missions
    await prisma.user_missions.createMany({
      data: selectedTemplates.map(t => ({
        user_id,
        template_id: t.id,
        mission_type: MISSION_TYPES.WEEKLY,
        assigned_tier: tier,
        tier_multiplier: multiplier,
        objective_value: Math.ceil(t.objective_base_value * multiplier),
        reward_wealth: Math.floor(t.reward_wealth * multiplier),
        reward_xp: Math.floor(t.reward_xp * multiplier),
        expires_at,
        status: 'active',
      })),
    })
  },

  /**
   * Ensure user has missions assigned (call on login/action)
   */
  async ensureMissionsAssigned(user_id: number): Promise<void> {
    const now = new Date()

    // Check for active daily missions
    const dailyCount = await prisma.user_missions.count({
      where: {
        user_id,
        mission_type: MISSION_TYPES.DAILY,
        status: 'active',
        expires_at: { gt: now },
      },
    })

    if (dailyCount === 0) {
      // Expire old daily missions
      await prisma.user_missions.updateMany({
        where: {
          user_id,
          mission_type: MISSION_TYPES.DAILY,
          status: 'active',
        },
        data: { status: 'expired' },
      })
      await this.assignDailyMissions(user_id)
    }

    // Check for active weekly missions
    const weeklyCount = await prisma.user_missions.count({
      where: {
        user_id,
        mission_type: MISSION_TYPES.WEEKLY,
        status: 'active',
        expires_at: { gt: now },
      },
    })

    if (weeklyCount === 0) {
      // Expire old weekly missions
      await prisma.user_missions.updateMany({
        where: {
          user_id,
          mission_type: MISSION_TYPES.WEEKLY,
          status: 'active',
        },
        data: { status: 'expired' },
      })
      await this.assignWeeklyMissions(user_id)
    }
  },

  /**
   * Update progress for missions matching objective type
   */
  async updateProgress(
    user_id: number,
    objectiveType: MissionObjectiveType,
    increment: number = 1
  ): Promise<void> {
    const now = new Date()

    // Get active missions with matching objective type
    const missions = await prisma.user_missions.findMany({
      where: {
        user_id,
        status: 'active',
        is_completed: false,
        expires_at: { gt: now },
        mission_templates: { objective_type: objectiveType },
      },
      include: { mission_templates: true },
    })

    for (const mission of missions) {
      const newProgress = Math.min(
        (mission.current_progress ?? 0) + increment,
        mission.objective_value
      )
      const is_completed = newProgress >= mission.objective_value

      await prisma.user_missions.update({
        where: { id: mission.id },
        data: {
          current_progress: newProgress,
          is_completed,
          completed_at: is_completed ? new Date() : null,
        },
      })
    }
  },

  /**
   * Set progress to absolute value (for streak-type missions)
   */
  async setProgress(
    user_id: number,
    objectiveType: MissionObjectiveType,
    value: number
  ): Promise<void> {
    const now = new Date()

    const missions = await prisma.user_missions.findMany({
      where: {
        user_id,
        status: 'active',
        is_completed: false,
        expires_at: { gt: now },
        mission_templates: { objective_type: objectiveType },
      },
    })

    for (const mission of missions) {
      const newProgress = Math.min(value, mission.objective_value)
      const is_completed = newProgress >= mission.objective_value

      await prisma.user_missions.update({
        where: { id: mission.id },
        data: {
          current_progress: newProgress,
          is_completed,
          completed_at: is_completed ? new Date() : null,
        },
      })
    }
  },

  /**
   * Claim rewards for completed missions
   */
  async claimRewards(
    user_id: number,
    type: MissionType
  ): Promise<MissionClaimResult> {
    const now = new Date()

    // Get completed missions of this type
    const missions = await prisma.user_missions.findMany({
      where: {
        user_id,
        mission_type: type,
        status: 'active',
        expires_at: { gt: now },
      },
    })

    const expectedCount = type === MISSION_TYPES.DAILY
      ? MISSION_CONFIG.DAILY_COUNT
      : MISSION_CONFIG.WEEKLY_COUNT

    // Check all-or-nothing requirement
    if (missions.length !== expectedCount) {
      return {
        success: false,
        error: 'Not all missions assigned',
        totalWealth: 0,
        totalXp: 0,
        bonusWealth: 0,
        bonusXp: 0,
        crateAwarded: null,
        completedMissions: 0,
      }
    }

    const completedCount = missions.filter(m => m.is_completed).length
    if (completedCount !== expectedCount) {
      return {
        success: false,
        error: `Only ${completedCount}/${expectedCount} missions completed`,
        totalWealth: 0,
        totalXp: 0,
        bonusWealth: 0,
        bonusXp: 0,
        crateAwarded: null,
        completedMissions: completedCount,
      }
    }

    // Check if already claimed
    const checkDate = type === MISSION_TYPES.DAILY
      ? this.getDailyResetTime()
      : this.getWeeklyResetTime()

    const existingClaim = await prisma.mission_completions.findFirst({
      where: {
        user_id,
        completion_type: type,
        completed_date: { gte: checkDate },
      },
    })

    if (existingClaim) {
      return {
        success: false,
        error: 'Already claimed',
        totalWealth: 0,
        totalXp: 0,
        bonusWealth: 0,
        bonusXp: 0,
        crateAwarded: null,
        completedMissions: expectedCount,
      }
    }

    // Calculate base rewards
    const baseWealth = missions.reduce((sum, m) => sum + m.reward_wealth, 0)
    const totalXp = missions.reduce((sum, m) => sum + m.reward_xp, 0)
    const bonus = MISSION_COMPLETION_BONUS[type]
    const crateAwarded = bonus.crate

    // Phase 2 Economy Rebalance: Apply daily/weekly wealth cap
    const wealthCap = type === MISSION_TYPES.DAILY
      ? MISSION_CONFIG.DAILY_WEALTH_CAP
      : MISSION_CONFIG.WEEKLY_WEALTH_CAP

    // Get previous claims in current period
    const periodStart = type === MISSION_TYPES.DAILY
      ? this.getDailyResetTime()
      : this.getWeeklyResetTime()

    const previousClaims = await prisma.mission_completions.aggregate({
      where: {
        user_id,
        completion_type: type,
        completed_date: { gte: periodStart },
      },
      _sum: { total_wealth: true },
    })

    const alreadyClaimed = previousClaims._sum.total_wealth || 0
    const remainingCap = Math.max(0, wealthCap - alreadyClaimed)

    // Cap the total wealth (base + bonus) to remaining allowance
    const uncappedWealth = baseWealth + bonus.wealth
    const totalWealth = Math.min(uncappedWealth, remainingCap)

    // Get user tier for completion record
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { status_tier: true },
    })

    // Calculate actual bonus after cap (for return value)
    const actualBonusWealth = totalWealth > baseWealth ? Math.min(bonus.wealth, totalWealth - baseWealth) : 0
    const actualBaseWealth = totalWealth - actualBonusWealth

    // Process rewards in transaction
    await prisma.$transaction(async (tx) => {
      // Award wealth (totalWealth already includes capped base + bonus)
      await tx.users.update({
        where: { id: user_id },
        data: {
          wealth: { increment: totalWealth },
        },
      })

      // Award XP with level recalculation
      const xpToAward = totalXp + bonus.xp
      if (xpToAward > 0) {
        await UserService.addXpInTransaction(user_id, xpToAward, tx)
      }

      // Mark missions as claimed
      await tx.user_missions.updateMany({
        where: { id: { in: missions.map(m => m.id) } },
        data: { status: 'claimed' },
      })

      // Record completion (store actual capped values)
      await tx.mission_completions.create({
        data: {
          user_id,
          completion_type: type,
          completed_date: new Date(),
          mission_ids: missions.map(m => m.id),
          total_wealth: actualBaseWealth,
          total_xp: totalXp,
          bonus_wealth: actualBonusWealth,
          bonus_xp: bonus.xp,
          crate_awarded: crateAwarded,
          player_tier: user?.status_tier ?? 'Rookie',
        },
      })
    })

    // Award crate if applicable (outside transaction to use CrateService)
    if (crateAwarded) {
      await CrateService.awardCrate(user_id, crateAwarded as CrateTier, CRATE_SOURCES.MISSION)
    }

    // Add territory score for faction (25 points per mission batch completion)
    await FactionService.addTerritoryScore(user_id, 'mission')

    return {
      success: true,
      totalWealth: actualBaseWealth,
      totalXp,
      bonusWealth: actualBonusWealth,
      bonusXp: bonus.xp,
      crateAwarded,
      completedMissions: expectedCount,
    }
  },

  /**
   * Select missions with variety guarantee
   */
  selectMissions<T extends { id: string; category: string; is_luck_based: boolean | null; objective_base_value: number; reward_wealth: number; reward_xp: number }>(
    templates: T[],
    count: number
  ): T[] {
    const selected: typeof templates = []
    const usedCategories = new Set<string>()
    let luckBasedCount = 0

    // Shuffle templates
    const shuffled = [...templates].sort(() => Math.random() - 0.5)

    for (const template of shuffled) {
      if (selected.length >= count) break

      // Variety: max 1 per category
      if (usedCategories.has(template.category)) continue

      // Max 1 luck-based per day
      if (template.is_luck_based && luckBasedCount >= 1) continue

      selected.push(template)
      usedCategories.add(template.category)
      if (template.is_luck_based) luckBasedCount++
    }

    // If we couldn't fill with variety, add any remaining
    if (selected.length < count) {
      for (const template of shuffled) {
        if (selected.length >= count) break
        if (!selected.includes(template)) {
          selected.push(template)
        }
      }
    }

    return selected
  },

  /**
   * Get UTC midnight today (daily reset time)
   */
  getDailyResetTime(): Date {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  },

  /**
   * Get next UTC midnight
   */
  getNextDailyReset(): Date {
    const now = new Date()
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    ))
  },

  /**
   * Get Sunday midnight UTC (weekly reset time)
   */
  getWeeklyResetTime(): Date {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const daysToSubtract = dayOfWeek // Sunday = 0
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysToSubtract
    ))
  },

  /**
   * Get next Sunday midnight UTC
   */
  getNextWeeklyReset(): Date {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const daysToAdd = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysToAdd
    ))
  },

  /**
   * Get mission history for a user
   */
  async getMissionHistory(user_id: number, limit: number = 20) {
    return prisma.mission_completions.findMany({
      where: { user_id },
      orderBy: { completed_at: 'desc' },
      take: limit,
    })
  },
}

export default MissionService
