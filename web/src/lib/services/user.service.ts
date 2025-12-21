import { prisma } from '../db'
import {
  getTierFromLevel,
  levelFromXp,
  xpProgressInLevel,
  calculateCheckinRewards,
  getStreakMilestoneReward,
  formatWealth,
  MISSION_OBJECTIVE_TYPES,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  CRATE_SOURCES,
  type CrateTier,
} from '../game'
import { LeaderboardService } from './leaderboard.service'
import { MissionService } from './mission.service'
import { AchievementService } from './achievement.service'
import { CrateService } from './crate.service'
import { FactionService } from './faction.service'
import type { Platform } from '@/types'

// =============================================================================
// USER TYPES
// =============================================================================

export interface CreateUserInput {
  platform: Platform
  platformUserId: string
  username: string
  display_name?: string
}

export interface UserProfile {
  id: number
  username: string
  display_name: string | null
  kingpin_name: string | null
  wealth: bigint
  xp: bigint
  level: number
  status_tier: string
  hp: number
  checkin_streak: number
  last_checkin_date: Date | null
  total_play_count: number
  wins: number
  losses: number
  faction_id: number | null
  faction_name: string | null
  equippedTitle: string | null
  created_at: Date
  last_seen: Date
  linkedPlatforms: Platform[]
}

export interface CheckinResult {
  success: boolean
  alreadyCheckedIn: boolean
  streak: number
  wealth_earned: number
  xp_earned: number
  levelUp: boolean
  newLevel?: number
  tierPromotion: boolean
  newTier?: string
  milestoneReward: string | null
}

// =============================================================================
// USER SERVICE
// =============================================================================

export const UserService = {
  /**
   * Find user by internal ID
   */
  async findById(user_id: number) {
    return prisma.users.findUnique({
      where: { id: user_id },
      include: {
        factions: true,
        user_titles: { where: { is_equipped: true } },
      },
    })
  },

  /**
   * Find user by platform and platform user ID
   */
  async findByPlatform(platform: Platform, platformUserId: string) {
    const field = getPlatformField(platform)
    if (!field) return null

    return prisma.users.findFirst({
      where: { [field]: platformUserId },
      include: {
        factions: true,
        user_titles: { where: { is_equipped: true } },
      },
    })
  },

  /**
   * Find user by username (case-insensitive)
   */
  async findByUsername(username: string) {
    return prisma.users.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { display_name: { equals: username, mode: 'insensitive' } },
          { kingpin_name: { equals: username, mode: 'insensitive' } },
        ],
      },
      include: {
        factions: true,
        user_titles: { where: { is_equipped: true } },
      },
    })
  },

  /**
   * Create a new user from platform sign-in
   */
  async create(input: CreateUserInput) {
    const field = getPlatformField(input.platform)
    if (!field) throw new Error(`Invalid platform: ${input.platform}`)

    return prisma.users.create({
      data: {
        [field]: input.platformUserId,
        username: input.username,
        display_name: input.display_name || input.username,
        ...(input.platform === 'discord' && {
          discordUsername: input.username,
          discordLinkedAt: new Date(),
        }),
      },
      include: {
        factions: true,
        user_titles: { where: { is_equipped: true } },
      },
    })
  },

  /**
   * Get or create user (used for chat bot auto-registration)
   */
  async getOrCreate(platform: Platform, platformUserId: string, username: string) {
    let user = await this.findByPlatform(platform, platformUserId)

    if (!user) {
      user = await this.create({
        platform,
        platformUserId,
        username,
      })
    }

    return user
  },

  /**
   * Get full user profile with computed fields
   */
  async getProfile(user_id: number): Promise<UserProfile | null> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      include: {
        factions: true,
        user_titles: { where: { is_equipped: true }, take: 1 },
      },
    })

    if (!user) return null

    // Determine linked platforms
    const linkedPlatforms: Platform[] = []
    if (user.kick_user_id) linkedPlatforms.push('kick')
    if (user.twitch_user_id) linkedPlatforms.push('twitch')
    if (user.discord_user_id) linkedPlatforms.push('discord')

    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      kingpin_name: user.kingpin_name,
      wealth: user.wealth ?? BigInt(0),
      xp: user.xp ?? BigInt(0),
      level: user.level ?? 1,
      status_tier: user.status_tier ?? 'Punk',
      hp: user.hp ?? 100,
      checkin_streak: user.checkin_streak ?? 0,
      last_checkin_date: user.last_checkin_date,
      total_play_count: user.total_play_count ?? 0,
      wins: user.wins ?? 0,
      losses: user.losses ?? 0,
      faction_id: user.faction_id,
      faction_name: user.factions?.name || null,
      equippedTitle: user.user_titles[0]?.title || null,
      created_at: user.created_at ?? new Date(),
      last_seen: user.last_seen ?? new Date(),
      linkedPlatforms,
    }
  },

  /**
   * Link an additional platform to existing user
   */
  async linkPlatform(user_id: number, platform: Platform, platformUserId: string) {
    const field = getPlatformField(platform)
    if (!field) throw new Error(`Invalid platform: ${platform}`)

    // Check if this platform ID is already linked to another user
    const existingUser = await this.findByPlatform(platform, platformUserId)
    if (existingUser && existingUser.id !== user_id) {
      throw new Error('This account is already linked to another user')
    }

    return prisma.users.update({
      where: { id: user_id },
      data: {
        [field]: platformUserId,
        ...(platform === 'discord' && {
          discord_linked_at: new Date(),
        }),
      },
    })
  },

  /**
   * Unlink a platform from user
   */
  async unlinkPlatform(user_id: number, platform: Platform) {
    const user = await this.findById(user_id)
    if (!user) throw new Error('User not found')

    // Count linked platforms
    const linkedCount = [user.kick_user_id, user.twitch_user_id, user.discord_user_id].filter(Boolean).length

    if (linkedCount <= 1) {
      throw new Error('Cannot unlink the only connected platform')
    }

    const field = getPlatformField(platform)
    if (!field) throw new Error(`Invalid platform: ${platform}`)

    return prisma.users.update({
      where: { id: user_id },
      data: {
        [field]: null,
        ...(platform === 'discord' && {
          discord_username: null,
          discord_linked_at: null,
        }),
      },
    })
  },

  /**
   * Update user's last seen timestamp
   */
  async updateLastSeen(user_id: number) {
    return prisma.users.update({
      where: { id: user_id },
      data: { last_seen: new Date() },
    })
  },

  /**
   * Add wealth to user
   */
  async addWealth(user_id: number, amount: number) {
    return prisma.users.update({
      where: { id: user_id },
      data: { wealth: { increment: amount } },
    })
  },

  /**
   * Remove wealth from user (with floor at 0)
   */
  async removeWealth(user_id: number, amount: number) {
    const user = await this.findById(user_id)
    if (!user) throw new Error('User not found')

    const newWealth = BigInt(Math.max(0, Number(user.wealth) - amount))

    return prisma.users.update({
      where: { id: user_id },
      data: { wealth: newWealth },
    })
  },

  /**
   * Add XP to user and handle level ups
   */
  async addXp(user_id: number, amount: number): Promise<{ levelUp: boolean; newLevel?: number; tierPromotion: boolean; newTier?: string }> {
    const user = await this.findById(user_id)
    if (!user) throw new Error('User not found')

    const newXp = (user.xp ?? BigInt(0)) + BigInt(amount)
    const newLevel = levelFromXp(Number(newXp))
    const newTier = getTierFromLevel(newLevel)

    const levelUp = newLevel > (user.level ?? 1)
    const tierPromotion = newTier !== user.status_tier

    await prisma.users.update({
      where: { id: user_id },
      data: {
        xp: newXp,
        level: newLevel,
        status_tier: newTier,
      },
    })

    return {
      levelUp,
      newLevel: levelUp ? newLevel : undefined,
      tierPromotion,
      newTier: tierPromotion ? newTier : undefined,
    }
  },

  /**
   * Add XP to user within a transaction (for atomic operations)
   * Use this when you need to increment XP as part of a larger transaction.
   * This ensures level and tier are always recalculated when XP changes.
   */
  async addXpInTransaction(
    user_id: number,
    amount: number,
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
  ): Promise<{ levelUp: boolean; newLevel: number; tierPromotion: boolean; newTier: string }> {
    // Fetch current user within transaction for consistency
    const user = await tx.users.findUnique({
      where: { id: user_id },
      select: { xp: true, level: true, status_tier: true },
    })

    if (!user) throw new Error('User not found')

    const currentXp = user.xp ?? BigInt(0)
    const newXp = currentXp + BigInt(amount)
    const newLevel = levelFromXp(Number(newXp))
    const newTier = getTierFromLevel(newLevel)

    const levelUp = newLevel > (user.level ?? 1)
    const tierPromotion = newTier !== user.status_tier

    await tx.users.update({
      where: { id: user_id },
      data: {
        xp: newXp,
        level: newLevel,
        status_tier: newTier,
      },
    })

    return {
      levelUp,
      newLevel,
      tierPromotion,
      newTier,
    }
  },

  /**
   * Process daily check-in
   */
  async processCheckin(user_id: number): Promise<CheckinResult> {
    const user = await this.findById(user_id)
    if (!user) throw new Error('User not found')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if already checked in today
    if (user.last_checkin_date) {
      const lastCheckin = new Date(user.last_checkin_date)
      lastCheckin.setHours(0, 0, 0, 0)

      if (lastCheckin.getTime() === today.getTime()) {
        return {
          success: false,
          alreadyCheckedIn: true,
          streak: user.checkin_streak ?? 0,
          wealth_earned: 0,
          xp_earned: 0,
          levelUp: false,
          tierPromotion: false,
          milestoneReward: null,
        }
      }

      // Check if streak continues (yesterday) or resets
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const streakContinues = lastCheckin.getTime() === yesterday.getTime()
      var newStreak = streakContinues ? (user.checkin_streak ?? 0) + 1 : 1
    } else {
      var newStreak = 1
    }

    // Calculate rewards
    const rewards = calculateCheckinRewards(newStreak)
    const milestoneReward = getStreakMilestoneReward(newStreak)

    // Update user
    await prisma.users.update({
      where: { id: user_id },
      data: {
        checkin_streak: newStreak,
        last_checkin_date: today,
        wealth: { increment: rewards.wealth },
      },
    })

    // Add XP separately to handle level up
    const xpResult = await this.addXp(user_id, rewards.xp)

    // Award milestone crate if applicable (using CrateService for proper escrow handling)
    if (milestoneReward) {
      await CrateService.awardCrate(user_id, milestoneReward as CrateTier, CRATE_SOURCES.CHECKIN_MILESTONE)
    }

    // Record check-in event
    await prisma.game_events.create({
      data: {
        user_id,
        event_type: 'checkin',
        wealth_change: rewards.wealth,
        xp_change: rewards.xp,
        tier: `streak_${newStreak}`,
        event_description: `Daily check-in (streak: ${newStreak})`,
      },
    })

    // Update leaderboard snapshots
    await LeaderboardService.updateSnapshot(user_id, {
      checkins: 1,
      wealth_earned: rewards.wealth,
      xp_earned: rewards.xp,
    })

    // Check for longest streak record
    await LeaderboardService.checkAndUpdateRecord('longest_streak', user_id, newStreak)

    // Update mission progress
    await MissionService.updateProgress(user_id, MISSION_OBJECTIVE_TYPES.CHECKIN_TODAY, 1)
    await MissionService.setProgress(user_id, MISSION_OBJECTIVE_TYPES.CHECKIN_STREAK, newStreak)
    await MissionService.updateProgress(user_id, MISSION_OBJECTIVE_TYPES.CHECKIN_WEEK, 1)
    await MissionService.updateProgress(user_id, MISSION_OBJECTIVE_TYPES.WEALTH_EARNED, rewards.wealth)

    // Update achievement progress
    await AchievementService.setProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.CHECKIN_STREAK, newStreak)
    await AchievementService.incrementProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.TOTAL_WEALTH_EARNED, rewards.wealth)

    // Check level achievements
    if (xpResult.levelUp && xpResult.newLevel) {
      await AchievementService.setProgress(user_id, ACHIEVEMENT_REQUIREMENT_TYPES.LEVEL, xpResult.newLevel)
    }

    // Add territory score for faction (15 points per check-in)
    await FactionService.addTerritoryScore(user_id, 'checkin')

    return {
      success: true,
      alreadyCheckedIn: false,
      streak: newStreak,
      wealth_earned: rewards.wealth,
      xp_earned: rewards.xp,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
      tierPromotion: xpResult.tierPromotion,
      newTier: xpResult.newTier,
      milestoneReward,
    }
  },

  /**
   * Update user's Kingpin name (custom display name)
   */
  async setKingpinName(user_id: number, name: string) {
    // Validate name
    if (name.length < 3 || name.length > 20) {
      throw new Error('Name must be between 3 and 20 characters')
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Name can only contain letters, numbers, underscores, and hyphens')
    }

    // Check if name is taken
    const existing = await prisma.users.findFirst({
      where: {
        kingpin_name: { equals: name, mode: 'insensitive' },
        id: { not: user_id },
      },
    })

    if (existing) {
      throw new Error('This name is already taken')
    }

    return prisma.users.update({
      where: { id: user_id },
      data: { kingpin_name: name },
    })
  },

  /**
   * Get user stats for display
   */
  async getStats(user_id: number) {
    const user = await this.findById(user_id)
    if (!user) return null

    const xpProgress = xpProgressInLevel(Number(user.xp ?? BigInt(0)))

    return {
      wealth: user.wealth,
      formattedWealth: formatWealth(user.wealth ?? BigInt(0)),
      xp: user.xp,
      level: user.level,
      tier: user.status_tier,
      xpProgress,
      checkin_streak: user.checkin_streak,
      totalPlays: user.total_play_count,
      wins: user.wins,
      losses: user.losses,
      winRate: (user.total_play_count ?? 0) > 0 ? ((user.wins ?? 0) / (user.total_play_count ?? 1)) * 100 : 0,
    }
  },

  /**
   * Increment play count
   */
  async incrementPlayCount(user_id: number) {
    return prisma.users.update({
      where: { id: user_id },
      data: { total_play_count: { increment: 1 } },
    })
  },

  /**
   * Record win
   */
  async recordWin(user_id: number) {
    return prisma.users.update({
      where: { id: user_id },
      data: { wins: { increment: 1 } },
    })
  },

  /**
   * Record loss
   */
  async recordLoss(user_id: number) {
    return prisma.users.update({
      where: { id: user_id },
      data: { losses: { increment: 1 } },
    })
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPlatformField(platform: Platform): string | null {
  switch (platform) {
    case 'kick':
      return 'kick_user_id'
    case 'twitch':
      return 'twitch_user_id'
    case 'discord':
      return 'discord_user_id'
    default:
      return null
  }
}

export default UserService
