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
  displayName?: string
}

export interface UserProfile {
  id: number
  username: string
  displayName: string | null
  kingpinName: string | null
  wealth: bigint
  xp: bigint
  level: number
  statusTier: string
  hp: number
  checkinStreak: number
  lastCheckinDate: Date | null
  totalPlayCount: number
  wins: number
  losses: number
  factionId: number | null
  factionName: string | null
  equippedTitle: string | null
  createdAt: Date
  lastSeen: Date
  linkedPlatforms: Platform[]
}

export interface CheckinResult {
  success: boolean
  alreadyCheckedIn: boolean
  streak: number
  wealthEarned: number
  xpEarned: number
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
  async findById(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        faction: true,
        titles: { where: { isEquipped: true } },
      },
    })
  },

  /**
   * Find user by platform and platform user ID
   */
  async findByPlatform(platform: Platform, platformUserId: string) {
    const field = getPlatformField(platform)
    if (!field) return null

    return prisma.user.findFirst({
      where: { [field]: platformUserId },
      include: {
        faction: true,
        titles: { where: { isEquipped: true } },
      },
    })
  },

  /**
   * Find user by username (case-insensitive)
   */
  async findByUsername(username: string) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { displayName: { equals: username, mode: 'insensitive' } },
          { kingpinName: { equals: username, mode: 'insensitive' } },
        ],
      },
      include: {
        faction: true,
        titles: { where: { isEquipped: true } },
      },
    })
  },

  /**
   * Create a new user from platform sign-in
   */
  async create(input: CreateUserInput) {
    const field = getPlatformField(input.platform)
    if (!field) throw new Error(`Invalid platform: ${input.platform}`)

    return prisma.user.create({
      data: {
        [field]: input.platformUserId,
        username: input.username,
        displayName: input.displayName || input.username,
        ...(input.platform === 'discord' && {
          discordUsername: input.username,
          discordLinkedAt: new Date(),
        }),
      },
      include: {
        faction: true,
        titles: { where: { isEquipped: true } },
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
  async getProfile(userId: number): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        faction: true,
        titles: { where: { isEquipped: true }, take: 1 },
      },
    })

    if (!user) return null

    // Determine linked platforms
    const linkedPlatforms: Platform[] = []
    if (user.kickUserId) linkedPlatforms.push('kick')
    if (user.twitchUserId) linkedPlatforms.push('twitch')
    if (user.discordUserId) linkedPlatforms.push('discord')

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      kingpinName: user.kingpinName,
      wealth: user.wealth,
      xp: user.xp,
      level: user.level,
      statusTier: user.statusTier,
      hp: user.hp,
      checkinStreak: user.checkinStreak,
      lastCheckinDate: user.lastCheckinDate,
      totalPlayCount: user.totalPlayCount,
      wins: user.wins,
      losses: user.losses,
      factionId: user.factionId,
      factionName: user.faction?.factionName || null,
      equippedTitle: user.titles[0]?.title || null,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      linkedPlatforms,
    }
  },

  /**
   * Link an additional platform to existing user
   */
  async linkPlatform(userId: number, platform: Platform, platformUserId: string) {
    const field = getPlatformField(platform)
    if (!field) throw new Error(`Invalid platform: ${platform}`)

    // Check if this platform ID is already linked to another user
    const existingUser = await this.findByPlatform(platform, platformUserId)
    if (existingUser && existingUser.id !== userId) {
      throw new Error('This account is already linked to another user')
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        [field]: platformUserId,
        ...(platform === 'discord' && {
          discordLinkedAt: new Date(),
        }),
      },
    })
  },

  /**
   * Unlink a platform from user
   */
  async unlinkPlatform(userId: number, platform: Platform) {
    const user = await this.findById(userId)
    if (!user) throw new Error('User not found')

    // Count linked platforms
    const linkedCount = [user.kickUserId, user.twitchUserId, user.discordUserId].filter(Boolean).length

    if (linkedCount <= 1) {
      throw new Error('Cannot unlink the only connected platform')
    }

    const field = getPlatformField(platform)
    if (!field) throw new Error(`Invalid platform: ${platform}`)

    return prisma.user.update({
      where: { id: userId },
      data: {
        [field]: null,
        ...(platform === 'discord' && {
          discordUsername: null,
          discordLinkedAt: null,
        }),
      },
    })
  },

  /**
   * Update user's last seen timestamp
   */
  async updateLastSeen(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    })
  },

  /**
   * Add wealth to user
   */
  async addWealth(userId: number, amount: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { wealth: { increment: amount } },
    })
  },

  /**
   * Remove wealth from user (with floor at 0)
   */
  async removeWealth(userId: number, amount: number) {
    const user = await this.findById(userId)
    if (!user) throw new Error('User not found')

    const newWealth = BigInt(Math.max(0, Number(user.wealth) - amount))

    return prisma.user.update({
      where: { id: userId },
      data: { wealth: newWealth },
    })
  },

  /**
   * Add XP to user and handle level ups
   */
  async addXp(userId: number, amount: number): Promise<{ levelUp: boolean; newLevel?: number; tierPromotion: boolean; newTier?: string }> {
    const user = await this.findById(userId)
    if (!user) throw new Error('User not found')

    const newXp = user.xp + BigInt(amount)
    const newLevel = levelFromXp(Number(newXp))
    const newTier = getTierFromLevel(newLevel)

    const levelUp = newLevel > user.level
    const tierPromotion = newTier !== user.statusTier

    await prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel,
        statusTier: newTier,
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
   * Process daily check-in
   */
  async processCheckin(userId: number): Promise<CheckinResult> {
    const user = await this.findById(userId)
    if (!user) throw new Error('User not found')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if already checked in today
    if (user.lastCheckinDate) {
      const lastCheckin = new Date(user.lastCheckinDate)
      lastCheckin.setHours(0, 0, 0, 0)

      if (lastCheckin.getTime() === today.getTime()) {
        return {
          success: false,
          alreadyCheckedIn: true,
          streak: user.checkinStreak,
          wealthEarned: 0,
          xpEarned: 0,
          levelUp: false,
          tierPromotion: false,
          milestoneReward: null,
        }
      }

      // Check if streak continues (yesterday) or resets
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const streakContinues = lastCheckin.getTime() === yesterday.getTime()
      var newStreak = streakContinues ? user.checkinStreak + 1 : 1
    } else {
      var newStreak = 1
    }

    // Calculate rewards
    const rewards = calculateCheckinRewards(newStreak)
    const milestoneReward = getStreakMilestoneReward(newStreak)

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        checkinStreak: newStreak,
        lastCheckinDate: today,
        wealth: { increment: rewards.wealth },
      },
    })

    // Add XP separately to handle level up
    const xpResult = await this.addXp(userId, rewards.xp)

    // Award milestone crate if applicable (using CrateService for proper escrow handling)
    if (milestoneReward) {
      await CrateService.awardCrate(userId, milestoneReward as CrateTier, CRATE_SOURCES.CHECKIN_MILESTONE)
    }

    // Record check-in event
    await prisma.gameEvent.create({
      data: {
        userId,
        eventType: 'checkin',
        wealthChange: rewards.wealth,
        xpChange: rewards.xp,
        tier: `streak_${newStreak}`,
        eventDescription: `Daily check-in (streak: ${newStreak})`,
      },
    })

    // Update leaderboard snapshots
    await LeaderboardService.updateSnapshot(userId, {
      checkins: 1,
      wealthEarned: rewards.wealth,
      xpEarned: rewards.xp,
    })

    // Check for longest streak record
    await LeaderboardService.checkAndUpdateRecord('longest_streak', userId, newStreak)

    // Update mission progress
    await MissionService.updateProgress(userId, MISSION_OBJECTIVE_TYPES.CHECKIN_TODAY, 1)
    await MissionService.setProgress(userId, MISSION_OBJECTIVE_TYPES.CHECKIN_STREAK, newStreak)
    await MissionService.updateProgress(userId, MISSION_OBJECTIVE_TYPES.CHECKIN_WEEK, 1)
    await MissionService.updateProgress(userId, MISSION_OBJECTIVE_TYPES.WEALTH_EARNED, rewards.wealth)

    // Update achievement progress
    await AchievementService.setProgress(userId, ACHIEVEMENT_REQUIREMENT_TYPES.CHECKIN_STREAK, newStreak)
    await AchievementService.incrementProgress(userId, ACHIEVEMENT_REQUIREMENT_TYPES.TOTAL_WEALTH_EARNED, rewards.wealth)

    // Check level achievements
    if (xpResult.levelUp && xpResult.newLevel) {
      await AchievementService.setProgress(userId, ACHIEVEMENT_REQUIREMENT_TYPES.LEVEL, xpResult.newLevel)
    }

    // Add territory score for faction (15 points per check-in)
    await FactionService.addTerritoryScore(userId, 'checkin')

    return {
      success: true,
      alreadyCheckedIn: false,
      streak: newStreak,
      wealthEarned: rewards.wealth,
      xpEarned: rewards.xp,
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
  async setKingpinName(userId: number, name: string) {
    // Validate name
    if (name.length < 3 || name.length > 20) {
      throw new Error('Name must be between 3 and 20 characters')
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Name can only contain letters, numbers, underscores, and hyphens')
    }

    // Check if name is taken
    const existing = await prisma.user.findFirst({
      where: {
        kingpinName: { equals: name, mode: 'insensitive' },
        id: { not: userId },
      },
    })

    if (existing) {
      throw new Error('This name is already taken')
    }

    return prisma.user.update({
      where: { id: userId },
      data: { kingpinName: name },
    })
  },

  /**
   * Get user stats for display
   */
  async getStats(userId: number) {
    const user = await this.findById(userId)
    if (!user) return null

    const xpProgress = xpProgressInLevel(Number(user.xp))

    return {
      wealth: user.wealth,
      formattedWealth: formatWealth(user.wealth),
      xp: user.xp,
      level: user.level,
      tier: user.statusTier,
      xpProgress,
      checkinStreak: user.checkinStreak,
      totalPlays: user.totalPlayCount,
      wins: user.wins,
      losses: user.losses,
      winRate: user.totalPlayCount > 0 ? (user.wins / user.totalPlayCount) * 100 : 0,
    }
  },

  /**
   * Increment play count
   */
  async incrementPlayCount(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { totalPlayCount: { increment: 1 } },
    })
  },

  /**
   * Record win
   */
  async recordWin(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { wins: { increment: 1 } },
    })
  },

  /**
   * Record loss
   */
  async recordLoss(userId: number) {
    return prisma.user.update({
      where: { id: userId },
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
      return 'kickUserId'
    case 'twitch':
      return 'twitchUserId'
    case 'discord':
      return 'discordUserId'
    default:
      return null
  }
}

export default UserService
