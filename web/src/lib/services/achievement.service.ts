import { prisma } from '../db'
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_TIERS } from '../game'
import { TitleService } from './title.service'

// =============================================================================
// ACHIEVEMENT SERVICE TYPES
// =============================================================================

export interface AchievementWithProgress {
  id: number
  achievementName: string
  achievementKey: string
  description: string
  category: string
  tier: string
  requirementType: string
  requirementValue: bigint
  rewardWealth: number
  rewardXp: number
  rewardTitle: string | null
  isHidden: boolean
  displayOrder: number
  // User progress
  currentProgress: bigint
  isCompleted: boolean
  completedAt: Date | null
}

export interface AchievementsByCategory {
  category: string
  achievements: AchievementWithProgress[]
  totalCount: number
  completedCount: number
}

export interface AchievementUnlockResult {
  unlocked: boolean
  achievement?: {
    name: string
    tier: string
    rewardWealth: number
    rewardXp: number
    titleUnlocked?: string
  }
}

// =============================================================================
// ACHIEVEMENT SERVICE
// =============================================================================

export const AchievementService = {
  /**
   * Get all achievements with user progress
   */
  async getAchievements(userId: number): Promise<AchievementsByCategory[]> {
    // Get all achievements
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    })

    // Get user progress
    const userProgress = await prisma.userAchievement.findMany({
      where: { userId },
    })

    const progressMap = new Map(
      userProgress.map(p => [p.achievementId, p])
    )

    // Group by category
    const categoryMap = new Map<string, AchievementWithProgress[]>()

    for (const achievement of achievements) {
      const progress = progressMap.get(achievement.id)

      const achievementWithProgress: AchievementWithProgress = {
        id: achievement.id,
        achievementName: achievement.achievementName,
        achievementKey: achievement.achievementKey,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        requirementType: achievement.requirementType,
        requirementValue: achievement.requirementValue,
        rewardWealth: achievement.rewardWealth,
        rewardXp: achievement.rewardXp,
        rewardTitle: achievement.rewardTitle,
        isHidden: achievement.isHidden,
        displayOrder: achievement.displayOrder,
        currentProgress: progress?.currentProgress ?? BigInt(0),
        isCompleted: progress?.isCompleted ?? false,
        completedAt: progress?.completedAt ?? null,
      }

      const category = achievement.category
      if (!categoryMap.has(category)) {
        categoryMap.set(category, [])
      }
      categoryMap.get(category)!.push(achievementWithProgress)
    }

    // Convert to array
    const result: AchievementsByCategory[] = []
    for (const [category, achs] of categoryMap) {
      result.push({
        category,
        achievements: achs,
        totalCount: achs.length,
        completedCount: achs.filter(a => a.isCompleted).length,
      })
    }

    return result
  },

  /**
   * Get a single achievement with user progress
   */
  async getAchievement(
    userId: number,
    achievementKey: string
  ): Promise<AchievementWithProgress | null> {
    const achievement = await prisma.achievement.findUnique({
      where: { achievementKey },
    })

    if (!achievement) return null

    const progress = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
    })

    return {
      id: achievement.id,
      achievementName: achievement.achievementName,
      achievementKey: achievement.achievementKey,
      description: achievement.description,
      category: achievement.category,
      tier: achievement.tier,
      requirementType: achievement.requirementType,
      requirementValue: achievement.requirementValue,
      rewardWealth: achievement.rewardWealth,
      rewardXp: achievement.rewardXp,
      rewardTitle: achievement.rewardTitle,
      isHidden: achievement.isHidden,
      displayOrder: achievement.displayOrder,
      currentProgress: progress?.currentProgress ?? BigInt(0),
      isCompleted: progress?.isCompleted ?? false,
      completedAt: progress?.completedAt ?? null,
    }
  },

  /**
   * Increment progress for achievements with matching requirement type
   */
  async incrementProgress(
    userId: number,
    requirementType: string,
    amount: number = 1
  ): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = []

    // Get achievements with this requirement type that aren't completed
    const achievements = await prisma.achievement.findMany({
      where: { requirementType },
    })

    for (const achievement of achievements) {
      // Get or create user progress
      const progress = await prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
        create: {
          userId,
          achievementId: achievement.id,
          currentProgress: BigInt(amount),
        },
        update: {
          currentProgress: { increment: amount },
        },
      })

      // Check if just completed
      if (!progress.isCompleted &&
          progress.currentProgress >= achievement.requirementValue) {
        const result = await this.completeAchievement(userId, achievement.id)
        if (result.unlocked) {
          results.push(result)
        }
      }
    }

    return results
  },

  /**
   * Set progress to absolute value (for streak/level type achievements)
   */
  async setProgress(
    userId: number,
    requirementType: string,
    value: number
  ): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = []

    const achievements = await prisma.achievement.findMany({
      where: { requirementType },
    })

    for (const achievement of achievements) {
      // Get current progress
      const existing = await prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
      })

      // Skip if already completed
      if (existing?.isCompleted) continue

      // Update or create progress
      const progress = await prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
        create: {
          userId,
          achievementId: achievement.id,
          currentProgress: BigInt(value),
        },
        update: {
          currentProgress: BigInt(value),
        },
      })

      // Check if just completed
      if (progress.currentProgress >= achievement.requirementValue) {
        const result = await this.completeAchievement(userId, achievement.id)
        if (result.unlocked) {
          results.push(result)
        }
      }
    }

    return results
  },

  /**
   * Check and potentially complete an achievement
   */
  async checkProgress(
    userId: number,
    requirementType: string,
    currentValue: number
  ): Promise<AchievementUnlockResult[]> {
    return this.setProgress(userId, requirementType, currentValue)
  },

  /**
   * Complete an achievement and award rewards
   */
  async completeAchievement(
    userId: number,
    achievementId: number
  ): Promise<AchievementUnlockResult> {
    const achievement = await prisma.achievement.findUnique({
      where: { id: achievementId },
    })

    if (!achievement) {
      return { unlocked: false }
    }

    // Check if already completed
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId },
      },
    })

    if (existing?.isCompleted) {
      return { unlocked: false }
    }

    // Complete in transaction
    await prisma.$transaction(async (tx) => {
      // Mark as completed
      await tx.userAchievement.upsert({
        where: {
          userId_achievementId: { userId, achievementId },
        },
        create: {
          userId,
          achievementId,
          currentProgress: achievement.requirementValue,
          isCompleted: true,
          completedAt: new Date(),
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      // Award rewards
      await tx.user.update({
        where: { id: userId },
        data: {
          wealth: { increment: achievement.rewardWealth },
          xp: { increment: achievement.rewardXp },
        },
      })

      // Unlock title if applicable
      if (achievement.rewardTitle) {
        await tx.userTitle.upsert({
          where: {
            userId_title: {
              userId,
              title: achievement.rewardTitle,
            },
          },
          create: {
            userId,
            title: achievement.rewardTitle,
          },
          update: {},
        })
      }

      // Create notification
      await tx.userNotification.create({
        data: {
          userId,
          notificationType: 'achievement_unlocked',
          title: 'Achievement Unlocked!',
          message: `You earned "${achievement.achievementName}" - +$${achievement.rewardWealth.toLocaleString()} and +${achievement.rewardXp} XP`,
          icon: this.getTierIcon(achievement.tier),
          linkType: 'achievement',
          linkId: achievement.achievementKey,
        },
      })
    })

    return {
      unlocked: true,
      achievement: {
        name: achievement.achievementName,
        tier: achievement.tier,
        rewardWealth: achievement.rewardWealth,
        rewardXp: achievement.rewardXp,
        titleUnlocked: achievement.rewardTitle ?? undefined,
      },
    }
  },

  /**
   * Get completion stats for a user
   */
  async getCompletionStats(userId: number): Promise<{
    total: number
    completed: number
    percentage: number
    byTier: Record<string, { total: number; completed: number }>
  }> {
    const [allAchievements, userProgress] = await Promise.all([
      prisma.achievement.findMany({
        select: { id: true, tier: true },
      }),
      prisma.userAchievement.findMany({
        where: { userId, isCompleted: true },
        select: { achievementId: true },
      }),
    ])

    const completedIds = new Set(userProgress.map(p => p.achievementId))

    const byTier: Record<string, { total: number; completed: number }> = {}
    for (const tier of Object.values(ACHIEVEMENT_TIERS)) {
      byTier[tier] = { total: 0, completed: 0 }
    }

    for (const ach of allAchievements) {
      if (byTier[ach.tier]) {
        byTier[ach.tier].total++
        if (completedIds.has(ach.id)) {
          byTier[ach.tier].completed++
        }
      }
    }

    const total = allAchievements.length
    const completed = userProgress.length

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      byTier,
    }
  },

  /**
   * Get recently unlocked achievements
   */
  async getRecentUnlocks(userId: number, limit: number = 5) {
    return prisma.userAchievement.findMany({
      where: { userId, isCompleted: true },
      include: {
        achievement: true,
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    })
  },

  /**
   * Get tier icon emoji
   */
  getTierIcon(tier: string): string {
    switch (tier) {
      case ACHIEVEMENT_TIERS.BRONZE: return '🥉'
      case ACHIEVEMENT_TIERS.SILVER: return '🥈'
      case ACHIEVEMENT_TIERS.GOLD: return '🥇'
      case ACHIEVEMENT_TIERS.PLATINUM: return '💎'
      case ACHIEVEMENT_TIERS.LEGENDARY: return '👑'
      default: return '🏅'
    }
  },
}

export default AchievementService
