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

// =============================================================================
// MISSION SERVICE TYPES
// =============================================================================

export interface UserMissionWithTemplate {
  id: number
  templateId: string
  missionType: string
  assignedTier: string
  tierMultiplier: number
  objectiveValue: number
  rewardWealth: number
  rewardXp: number
  currentProgress: number
  isCompleted: boolean
  completedAt: Date | null
  assignedAt: Date
  expiresAt: Date
  status: string
  template: {
    id: string
    name: string
    description: string
    category: string
    difficulty: string
    objectiveType: string
  }
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
  async getActiveMissions(userId: number): Promise<ActiveMissions> {
    const now = new Date()

    // Get all active missions
    const missions = await prisma.userMission.findMany({
      where: {
        userId,
        status: 'active',
        expiresAt: { gt: now },
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            difficulty: true,
            objectiveType: true,
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    })

    const daily = missions.filter(m => m.missionType === MISSION_TYPES.DAILY)
    const weekly = missions.filter(m => m.missionType === MISSION_TYPES.WEEKLY)

    // Check if already claimed today/this week
    const todayStart = this.getDailyResetTime()
    const weekStart = this.getWeeklyResetTime()

    const [dailyClaim, weeklyClaim] = await Promise.all([
      prisma.missionCompletion.findFirst({
        where: {
          userId,
          completionType: MISSION_TYPES.DAILY,
          completedDate: { gte: todayStart },
        },
      }),
      prisma.missionCompletion.findFirst({
        where: {
          userId,
          completionType: MISSION_TYPES.WEEKLY,
          completedDate: { gte: weekStart },
        },
      }),
    ])

    const canClaimDaily = daily.length === MISSION_CONFIG.DAILY_COUNT &&
      daily.every(m => m.isCompleted) &&
      !dailyClaim

    const canClaimWeekly = weekly.length === MISSION_CONFIG.WEEKLY_COUNT &&
      weekly.every(m => m.isCompleted) &&
      !weeklyClaim

    return {
      daily: daily.map(m => ({
        ...m,
        tierMultiplier: Number(m.tierMultiplier),
      })) as UserMissionWithTemplate[],
      weekly: weekly.map(m => ({
        ...m,
        tierMultiplier: Number(m.tierMultiplier),
      })) as UserMissionWithTemplate[],
      dailyExpiresAt: daily[0]?.expiresAt ?? null,
      weeklyExpiresAt: weekly[0]?.expiresAt ?? null,
      canClaimDaily,
      canClaimWeekly,
      dailyAlreadyClaimed: !!dailyClaim,
      weeklyAlreadyClaimed: !!weeklyClaim,
    }
  },

  /**
   * Assign daily missions to a user
   */
  async assignDailyMissions(userId: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, statusTier: true },
    })

    if (!user) return

    const tier = user.statusTier as Tier
    const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0
    const expiresAt = this.getNextDailyReset()

    // Get available templates
    const templates = await prisma.missionTemplate.findMany({
      where: { missionType: MISSION_TYPES.DAILY },
    })

    // Select missions ensuring variety (max 1 per category)
    const selectedTemplates = this.selectMissions(
      templates,
      MISSION_CONFIG.DAILY_COUNT
    )

    // Create user missions
    await prisma.userMission.createMany({
      data: selectedTemplates.map(t => ({
        userId,
        templateId: t.id,
        missionType: MISSION_TYPES.DAILY,
        assignedTier: tier,
        tierMultiplier: multiplier,
        objectiveValue: Math.ceil(t.objectiveBaseValue * multiplier),
        rewardWealth: Math.floor(t.rewardWealth * multiplier),
        rewardXp: Math.floor(t.rewardXp * multiplier),
        expiresAt,
        status: 'active',
      })),
    })
  },

  /**
   * Assign weekly missions to a user
   */
  async assignWeeklyMissions(userId: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, statusTier: true },
    })

    if (!user) return

    const tier = user.statusTier as Tier
    const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0
    const expiresAt = this.getNextWeeklyReset()

    // Get available templates
    const templates = await prisma.missionTemplate.findMany({
      where: { missionType: MISSION_TYPES.WEEKLY },
    })

    // Select missions ensuring variety
    const selectedTemplates = this.selectMissions(
      templates,
      MISSION_CONFIG.WEEKLY_COUNT
    )

    // Create user missions
    await prisma.userMission.createMany({
      data: selectedTemplates.map(t => ({
        userId,
        templateId: t.id,
        missionType: MISSION_TYPES.WEEKLY,
        assignedTier: tier,
        tierMultiplier: multiplier,
        objectiveValue: Math.ceil(t.objectiveBaseValue * multiplier),
        rewardWealth: Math.floor(t.rewardWealth * multiplier),
        rewardXp: Math.floor(t.rewardXp * multiplier),
        expiresAt,
        status: 'active',
      })),
    })
  },

  /**
   * Ensure user has missions assigned (call on login/action)
   */
  async ensureMissionsAssigned(userId: number): Promise<void> {
    const now = new Date()

    // Check for active daily missions
    const dailyCount = await prisma.userMission.count({
      where: {
        userId,
        missionType: MISSION_TYPES.DAILY,
        status: 'active',
        expiresAt: { gt: now },
      },
    })

    if (dailyCount === 0) {
      // Expire old daily missions
      await prisma.userMission.updateMany({
        where: {
          userId,
          missionType: MISSION_TYPES.DAILY,
          status: 'active',
        },
        data: { status: 'expired' },
      })
      await this.assignDailyMissions(userId)
    }

    // Check for active weekly missions
    const weeklyCount = await prisma.userMission.count({
      where: {
        userId,
        missionType: MISSION_TYPES.WEEKLY,
        status: 'active',
        expiresAt: { gt: now },
      },
    })

    if (weeklyCount === 0) {
      // Expire old weekly missions
      await prisma.userMission.updateMany({
        where: {
          userId,
          missionType: MISSION_TYPES.WEEKLY,
          status: 'active',
        },
        data: { status: 'expired' },
      })
      await this.assignWeeklyMissions(userId)
    }
  },

  /**
   * Update progress for missions matching objective type
   */
  async updateProgress(
    userId: number,
    objectiveType: MissionObjectiveType,
    increment: number = 1
  ): Promise<void> {
    const now = new Date()

    // Get active missions with matching objective type
    const missions = await prisma.userMission.findMany({
      where: {
        userId,
        status: 'active',
        isCompleted: false,
        expiresAt: { gt: now },
        template: { objectiveType },
      },
      include: { template: true },
    })

    for (const mission of missions) {
      const newProgress = Math.min(
        mission.currentProgress + increment,
        mission.objectiveValue
      )
      const isCompleted = newProgress >= mission.objectiveValue

      await prisma.userMission.update({
        where: { id: mission.id },
        data: {
          currentProgress: newProgress,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      })
    }
  },

  /**
   * Set progress to absolute value (for streak-type missions)
   */
  async setProgress(
    userId: number,
    objectiveType: MissionObjectiveType,
    value: number
  ): Promise<void> {
    const now = new Date()

    const missions = await prisma.userMission.findMany({
      where: {
        userId,
        status: 'active',
        isCompleted: false,
        expiresAt: { gt: now },
        template: { objectiveType },
      },
    })

    for (const mission of missions) {
      const newProgress = Math.min(value, mission.objectiveValue)
      const isCompleted = newProgress >= mission.objectiveValue

      await prisma.userMission.update({
        where: { id: mission.id },
        data: {
          currentProgress: newProgress,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      })
    }
  },

  /**
   * Claim rewards for completed missions
   */
  async claimRewards(
    userId: number,
    type: MissionType
  ): Promise<MissionClaimResult> {
    const now = new Date()

    // Get completed missions of this type
    const missions = await prisma.userMission.findMany({
      where: {
        userId,
        missionType: type,
        status: 'active',
        expiresAt: { gt: now },
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

    const completedCount = missions.filter(m => m.isCompleted).length
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

    const existingClaim = await prisma.missionCompletion.findFirst({
      where: {
        userId,
        completionType: type,
        completedDate: { gte: checkDate },
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

    // Calculate rewards
    const totalWealth = missions.reduce((sum, m) => sum + m.rewardWealth, 0)
    const totalXp = missions.reduce((sum, m) => sum + m.rewardXp, 0)
    const bonus = MISSION_COMPLETION_BONUS[type]
    const crateAwarded = bonus.crate

    // Get user tier for completion record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { statusTier: true },
    })

    // Process rewards in transaction
    await prisma.$transaction(async (tx) => {
      // Award wealth and XP
      await tx.user.update({
        where: { id: userId },
        data: {
          wealth: { increment: totalWealth + bonus.wealth },
          xp: { increment: totalXp + bonus.xp },
        },
      })

      // Mark missions as claimed
      await tx.userMission.updateMany({
        where: { id: { in: missions.map(m => m.id) } },
        data: { status: 'claimed' },
      })

      // Record completion
      await tx.missionCompletion.create({
        data: {
          userId,
          completionType: type,
          completedDate: new Date(),
          missionIds: missions.map(m => m.id),
          totalWealth,
          totalXp,
          bonusWealth: bonus.wealth,
          bonusXp: bonus.xp,
          crateAwarded,
          playerTier: user?.statusTier ?? 'Rookie',
        },
      })
    })

    // Award crate if applicable (outside transaction to use CrateService)
    if (crateAwarded) {
      await CrateService.awardCrate(userId, crateAwarded as CrateTier, CRATE_SOURCES.MISSION)
    }

    // Add territory score for faction (25 points per mission batch completion)
    await FactionService.addTerritoryScore(userId, 'mission')

    return {
      success: true,
      totalWealth,
      totalXp,
      bonusWealth: bonus.wealth,
      bonusXp: bonus.xp,
      crateAwarded,
      completedMissions: expectedCount,
    }
  },

  /**
   * Select missions with variety guarantee
   */
  selectMissions<T extends { id: string; category: string; isLuckBased: boolean }>(
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
      if (template.isLuckBased && luckBasedCount >= 1) continue

      selected.push(template)
      usedCategories.add(template.category)
      if (template.isLuckBased) luckBasedCount++
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
  async getMissionHistory(userId: number, limit: number = 20) {
    return prisma.missionCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: limit,
    })
  },
}

export default MissionService
