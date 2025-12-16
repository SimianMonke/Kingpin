import { prisma } from '../db'
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_TIERS } from '../game'
import { TitleService } from './title.service'

// =============================================================================
// ACHIEVEMENT SERVICE TYPES
// =============================================================================

export interface AchievementWithProgress {
  id: number
  name: string
  key: string
  description: string | null
  category: string
  tier: string
  requirement_type: string
  requirement_value: bigint | null
  reward_wealth: number | null
  reward_xp: number | null
  reward_title: string | null
  is_hidden: boolean | null
  display_order: number | null
  // User progress
  current_progress: bigint
  is_completed: boolean
  completed_at: Date | null
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
    reward_wealth: number
    reward_xp: number
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
  async getAchievements(user_id: number): Promise<AchievementsByCategory[]> {
    // Get all achievements
    const achievements = await prisma.achievements.findMany({
      orderBy: [{ category: 'asc' }, { display_order: 'asc' }],
    })

    // Get user progress
    const userProgress = await prisma.user_achievements.findMany({
      where: { user_id },
    })

    const progressMap = new Map(
      userProgress.map(p => [p.achievement_id, p])
    )

    // Group by category
    const categoryMap = new Map<string, AchievementWithProgress[]>()

    for (const achievement of achievements) {
      const progress = progressMap.get(achievement.id)

      const achievementWithProgress: AchievementWithProgress = {
        id: achievement.id,
        name: achievement.name,
        key: achievement.key,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        requirement_type: achievement.requirement_type,
        requirement_value: achievement.requirement_value,
        reward_wealth: achievement.reward_wealth,
        reward_xp: achievement.reward_xp,
        reward_title: achievement.reward_title,
        is_hidden: achievement.is_hidden,
        display_order: achievement.display_order,
        current_progress: progress?.current_progress ?? BigInt(0),
        is_completed: progress?.is_completed ?? false,
        completed_at: progress?.completed_at ?? null,
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
        completedCount: achs.filter(a => a.is_completed).length,
      })
    }

    return result
  },

  /**
   * Get a single achievement with user progress
   */
  async getAchievement(
    user_id: number,
    key: string
  ): Promise<AchievementWithProgress | null> {
    const achievement = await prisma.achievements.findUnique({
      where: { key },
    })

    if (!achievement) return null

    const progress = await prisma.user_achievements.findUnique({
      where: {
        user_id_achievement_id: {
          user_id,
          achievement_id: achievement.id,
        },
      },
    })

    return {
      id: achievement.id,
      name: achievement.name,
      key: achievement.key,
      description: achievement.description,
      category: achievement.category,
      tier: achievement.tier,
      requirement_type: achievement.requirement_type,
      requirement_value: achievement.requirement_value,
      reward_wealth: achievement.reward_wealth,
      reward_xp: achievement.reward_xp,
      reward_title: achievement.reward_title,
      is_hidden: achievement.is_hidden,
      display_order: achievement.display_order,
      current_progress: progress?.current_progress ?? BigInt(0),
      is_completed: progress?.is_completed ?? false,
      completed_at: progress?.completed_at ?? null,
    }
  },

  /**
   * Increment progress for achievements with matching requirement type
   */
  async incrementProgress(
    user_id: number,
    requirement_type: string,
    amount: number = 1
  ): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = []

    // Get achievements with this requirement type that aren't completed
    const achievements = await prisma.achievements.findMany({
      where: { requirement_type },
    })

    for (const achievement of achievements) {
      // Get or create user progress
      const progress = await prisma.user_achievements.upsert({
        where: {
          user_id_achievement_id: {
            user_id,
            achievement_id: achievement.id,
          },
        },
        create: {
          user_id,
          achievement_id: achievement.id,
          current_progress: BigInt(amount),
        },
        update: {
          current_progress: { increment: amount },
        },
      })

      // Check if just completed
      if (!progress.is_completed &&
          (progress.current_progress ?? 0) >= achievement.requirement_value) {
        const result = await this.completeAchievement(user_id, achievement.id)
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
    user_id: number,
    requirement_type: string,
    value: number
  ): Promise<AchievementUnlockResult[]> {
    const results: AchievementUnlockResult[] = []

    const achievements = await prisma.achievements.findMany({
      where: { requirement_type },
    })

    for (const achievement of achievements) {
      // Get current progress
      const existing = await prisma.user_achievements.findUnique({
        where: {
          user_id_achievement_id: {
            user_id,
            achievement_id: achievement.id,
          },
        },
      })

      // Skip if already completed
      if (existing?.is_completed) continue

      // Update or create progress
      const progress = await prisma.user_achievements.upsert({
        where: {
          user_id_achievement_id: {
            user_id,
            achievement_id: achievement.id,
          },
        },
        create: {
          user_id,
          achievement_id: achievement.id,
          current_progress: BigInt(value),
        },
        update: {
          current_progress: BigInt(value),
        },
      })

      // Check if just completed
      if ((progress.current_progress ?? BigInt(0)) >= achievement.requirement_value) {
        const result = await this.completeAchievement(user_id, achievement.id)
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
    user_id: number,
    requirement_type: string,
    currentValue: number
  ): Promise<AchievementUnlockResult[]> {
    return this.setProgress(user_id, requirement_type, currentValue)
  },

  /**
   * Complete an achievement and award rewards
   */
  async completeAchievement(
    user_id: number,
    achievement_id: number
  ): Promise<AchievementUnlockResult> {
    const achievement = await prisma.achievements.findUnique({
      where: { id: achievement_id },
    })

    if (!achievement) {
      return { unlocked: false }
    }

    // Check if already completed
    const existing = await prisma.user_achievements.findUnique({
      where: {
        user_id_achievement_id: { user_id, achievement_id },
      },
    })

    if (existing?.is_completed) {
      return { unlocked: false }
    }

    // Complete in transaction
    await prisma.$transaction(async (tx) => {
      // Mark as completed
      await tx.user_achievements.upsert({
        where: {
          user_id_achievement_id: { user_id, achievement_id },
        },
        create: {
          user_id,
          achievement_id,
          current_progress: achievement.requirement_value,
          is_completed: true,
          completed_at: new Date(),
        },
        update: {
          is_completed: true,
          completed_at: new Date(),
        },
      })

      // Award rewards
      await tx.users.update({
        where: { id: user_id },
        data: {
          wealth: { increment: achievement.reward_wealth ?? 0 },
          xp: { increment: achievement.reward_xp ?? 0 },
        },
      })

      // Unlock title if applicable
      if (achievement.reward_title) {
        await tx.user_titles.upsert({
          where: {
            user_id_title: {
              user_id,
              title: achievement.reward_title,
            },
          },
          create: {
            user_id,
            title: achievement.reward_title,
          },
          update: {},
        })
      }

      // Create notification
      await tx.user_notifications.create({
        data: {
          user_id,
          notification_type: 'achievement_unlocked',
          title: 'Achievement Unlocked!',
          message: `You earned "${achievement.name}" - +$${(achievement.reward_wealth ?? 0).toLocaleString()} and +${achievement.reward_xp ?? 0} XP`,
          icon: this.getTierIcon(achievement.tier),
          link_type: 'achievement',
          link_id: achievement.key,
        },
      })
    })

    return {
      unlocked: true,
      achievement: {
        name: achievement.name,
        tier: achievement.tier,
        reward_wealth: achievement.reward_wealth ?? 0,
        reward_xp: achievement.reward_xp ?? 0,
        titleUnlocked: achievement.reward_title ?? undefined,
      },
    }
  },

  /**
   * Get completion stats for a user
   */
  async getCompletionStats(user_id: number): Promise<{
    total: number
    completed: number
    percentage: number
    byTier: Record<string, { total: number; completed: number }>
  }> {
    const [allAchievements, userProgress] = await Promise.all([
      prisma.achievements.findMany({
        select: { id: true, tier: true },
      }),
      prisma.user_achievements.findMany({
        where: { user_id, is_completed: true },
        select: { achievement_id: true },
      }),
    ])

    const completedIds = new Set(userProgress.map(p => p.achievement_id))

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
  async getRecentUnlocks(user_id: number, limit: number = 5) {
    return prisma.user_achievements.findMany({
      where: { user_id: user_id, is_completed: true },
      include: {
        achievements: true,
      },
      orderBy: { completed_at: 'desc' },
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
