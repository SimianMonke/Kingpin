import { prisma } from '../db'
import {
  NOTIFICATION_CONFIG,
  NOTIFICATION_TYPES,
  NOTIFICATION_ICONS,
  NOTIFICATION_TITLES,
  NOTIFICATION_LINK_TYPES,
  type NotificationType,
  type NotificationLinkType,
} from '../game/constants'

// =============================================================================
// NOTIFICATION SERVICE TYPES
// =============================================================================

export interface NotificationData {
  id: number
  type: NotificationType
  title: string
  message: string
  icon: string
  linkType: NotificationLinkType | null
  linkId: string | null
  isSeen: boolean
  createdAt: Date
}

export interface CreateNotificationOptions {
  linkType?: NotificationLinkType
  linkId?: string
  customTitle?: string
  customIcon?: string
}

export interface NotificationListResult {
  notifications: NotificationData[]
  unreadCount: number
  total: number
}

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

export const NotificationService = {
  /**
   * Create a notification for a user
   */
  async create(
    userId: number,
    type: NotificationType,
    message: string,
    options: CreateNotificationOptions = {}
  ): Promise<NotificationData | null> {
    try {
      // Enforce limit first (delete oldest if at max)
      await this.enforceLimit(userId)

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + NOTIFICATION_CONFIG.RETENTION_DAYS)

      const notification = await prisma.userNotification.create({
        data: {
          userId,
          notificationType: type,
          title: options.customTitle ?? NOTIFICATION_TITLES[type],
          message,
          icon: options.customIcon ?? NOTIFICATION_ICONS[type],
          linkType: options.linkType ?? null,
          linkId: options.linkId ?? null,
          expiresAt,
        },
      })

      return this.mapNotification(notification)
    } catch (error) {
      console.error('Failed to create notification:', error)
      return null
    }
  },

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: number,
    limit = 25,
    includeRead = false
  ): Promise<NotificationListResult> {
    const where = {
      userId,
      isDismissed: false,
      ...(includeRead ? {} : { isSeen: false }),
    }

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.userNotification.count({
        where: { userId, isSeen: false, isDismissed: false },
      }),
      prisma.userNotification.count({
        where: { userId, isDismissed: false },
      }),
    ])

    return {
      notifications: notifications.map(n => this.mapNotification(n)),
      unreadCount,
      total,
    }
  },

  /**
   * Get unread notification count (lightweight endpoint)
   */
  async getUnreadCount(userId: number): Promise<number> {
    return prisma.userNotification.count({
      where: { userId, isSeen: false, isDismissed: false },
    })
  },

  /**
   * Mark notifications as seen
   */
  async markAsSeen(userId: number, notificationIds?: number[]): Promise<number> {
    const result = await prisma.userNotification.updateMany({
      where: {
        userId,
        isSeen: false,
        ...(notificationIds ? { id: { in: notificationIds } } : {}),
      },
      data: {
        isSeen: true,
        seenAt: new Date(),
      },
    })

    return result.count
  },

  /**
   * Dismiss a single notification
   */
  async dismiss(userId: number, notificationId: number): Promise<boolean> {
    const result = await prisma.userNotification.updateMany({
      where: { id: notificationId, userId },
      data: {
        isDismissed: true,
        dismissedAt: new Date(),
      },
    })

    return result.count > 0
  },

  /**
   * Clear all notifications for a user
   */
  async clearAll(userId: number): Promise<number> {
    const result = await prisma.userNotification.updateMany({
      where: { userId, isDismissed: false },
      data: {
        isDismissed: true,
        dismissedAt: new Date(),
      },
    })

    return result.count
  },

  /**
   * Enforce notification limit (max 25 per user)
   */
  async enforceLimit(userId: number): Promise<void> {
    const count = await prisma.userNotification.count({
      where: { userId, isDismissed: false },
    })

    if (count >= NOTIFICATION_CONFIG.MAX_PER_USER) {
      // Find the oldest notifications beyond the limit
      const toDelete = await prisma.userNotification.findMany({
        where: { userId, isDismissed: false },
        orderBy: { createdAt: 'asc' },
        take: count - NOTIFICATION_CONFIG.MAX_PER_USER + 1,
        select: { id: true },
      })

      if (toDelete.length > 0) {
        await prisma.userNotification.deleteMany({
          where: { id: { in: toDelete.map(n => n.id) } },
        })
      }
    }
  },

  /**
   * Cleanup expired notifications (scheduled job)
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.userNotification.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            createdAt: {
              lt: new Date(Date.now() - NOTIFICATION_CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    })

    return result.count
  },

  // =============================================================================
  // HELPER METHODS - Create specific notification types
  // =============================================================================

  /**
   * Notify user of successful check-in
   */
  async notifyCheckin(userId: number, streak: number, wealth: number, xp: number): Promise<void> {
    const isMilestone = [7, 14, 30, 60, 90, 180, 365].includes(streak)
    const type = isMilestone ? NOTIFICATION_TYPES.CHECKIN_MILESTONE : NOTIFICATION_TYPES.CHECKIN

    await this.create(
      userId,
      type,
      isMilestone
        ? `${streak}-day streak reached! +$${wealth.toLocaleString()}, +${xp} XP, and a bonus crate!`
        : `Streak: ${streak} days. +$${wealth.toLocaleString()}, +${xp} XP`,
      { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of level up
   */
  async notifyLevelUp(userId: number, newLevel: number): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.LEVEL_UP,
      `You reached level ${newLevel}!`,
      { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of tier promotion
   */
  async notifyTierPromotion(userId: number, newTier: string): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.TIER_PROMOTION,
      `You've been promoted to ${newTier}!`,
      { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify defender that they were robbed
   */
  async notifyRobbed(
    defenderId: number,
    attackerName: string,
    amount: number,
    itemStolen?: string
  ): Promise<void> {
    if (itemStolen) {
      await this.create(
        defenderId,
        NOTIFICATION_TYPES.ITEM_STOLEN,
        `${attackerName} robbed you for $${amount.toLocaleString()} and stole your ${itemStolen}!`,
        { linkType: NOTIFICATION_LINK_TYPES.INVENTORY }
      )
    } else {
      await this.create(
        defenderId,
        NOTIFICATION_TYPES.ROBBED,
        `${attackerName} robbed you for $${amount.toLocaleString()}`,
        { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
      )
    }
  },

  /**
   * Notify defender that they blocked a robbery
   */
  async notifyRobDefended(defenderId: number, attackerName: string): Promise<void> {
    await this.create(
      defenderId,
      NOTIFICATION_TYPES.ROB_DEFENDED,
      `You blocked ${attackerName}'s robbery attempt!`,
      { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user that their item broke
   */
  async notifyItemBroke(userId: number, itemName: string, slot: string): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.ITEM_BROKE,
      `Your ${itemName} (${slot}) has broken from use!`,
      { linkType: NOTIFICATION_LINK_TYPES.INVENTORY }
    )
  },

  /**
   * Notify user of crate received
   */
  async notifyCrateReceived(
    userId: number,
    crateTier: string,
    source: string,
    isEscrowed = false
  ): Promise<void> {
    const type = isEscrowed ? NOTIFICATION_TYPES.CRATE_ESCROW : NOTIFICATION_TYPES.CRATE_RECEIVED
    const escrowNote = isEscrowed ? ' (in escrow - claim within 1 hour!)' : ''

    await this.create(
      userId,
      type,
      `You received a ${crateTier} crate from ${source}${escrowNote}`,
      { linkType: NOTIFICATION_LINK_TYPES.CRATES }
    )
  },

  /**
   * Notify user of crate expiration
   */
  async notifyCrateExpired(userId: number, crateTier: string): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.CRATE_EXPIRED,
      `Your ${crateTier} crate expired! Remember to claim escrowed crates within 1 hour.`,
      { linkType: NOTIFICATION_LINK_TYPES.CRATES }
    )
  },

  /**
   * Notify user of achievement unlock
   */
  async notifyAchievement(
    userId: number,
    achievementName: string,
    tier: string,
    rewards: { wealth?: number; xp?: number; title?: string }
  ): Promise<void> {
    const rewardParts: string[] = []
    if (rewards.wealth) rewardParts.push(`$${rewards.wealth.toLocaleString()}`)
    if (rewards.xp) rewardParts.push(`${rewards.xp} XP`)
    if (rewards.title) rewardParts.push(`"${rewards.title}" title`)

    const rewardText = rewardParts.length > 0 ? ` Rewards: ${rewardParts.join(', ')}` : ''

    await this.create(
      userId,
      NOTIFICATION_TYPES.ACHIEVEMENT,
      `${achievementName} (${tier})!${rewardText}`,
      { linkType: NOTIFICATION_LINK_TYPES.ACHIEVEMENTS }
    )
  },

  /**
   * Notify user of title unlock
   */
  async notifyTitleUnlocked(userId: number, title: string): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.TITLE_UNLOCKED,
      `You unlocked the "${title}" title! Equip it in your profile.`,
      { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of mission completion
   */
  async notifyMissionComplete(
    userId: number,
    missionType: string,
    totalRewards: { wealth: number; xp: number; crate?: string }
  ): Promise<void> {
    const crateText = totalRewards.crate ? ` + ${totalRewards.crate} crate` : ''

    await this.create(
      userId,
      NOTIFICATION_TYPES.MISSION_COMPLETE,
      `All ${missionType} missions complete! +$${totalRewards.wealth.toLocaleString()}, +${totalRewards.xp} XP${crateText}`,
      { linkType: NOTIFICATION_LINK_TYPES.MISSIONS }
    )
  },

  /**
   * Notify user of mission expiration
   */
  async notifyMissionExpired(userId: number, missionType: string, count: number): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.MISSION_EXPIRED,
      `${count} ${missionType} mission${count > 1 ? 's' : ''} expired. New missions available!`,
      { linkType: NOTIFICATION_LINK_TYPES.MISSIONS }
    )
  },

  /**
   * Notify user of faction join
   */
  async notifyFactionJoined(userId: number, factionName: string): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.FACTION_JOINED,
      `Welcome to ${factionName}! Start earning territory points for your faction.`,
      { linkType: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user of territory capture
   */
  async notifyTerritoryCapture(
    userId: number,
    territoryName: string,
    factionName: string
  ): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.TERRITORY_CAPTURED,
      `${factionName} has captured ${territoryName}!`,
      { linkType: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user of territory loss
   */
  async notifyTerritoryLost(
    userId: number,
    territoryName: string,
    newControllerName: string
  ): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.TERRITORY_LOST,
      `${territoryName} was lost to ${newControllerName}`,
      { linkType: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user of faction weekly reward
   */
  async notifyFactionReward(
    userId: number,
    factionName: string,
    wealth: number,
    xp: number
  ): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.FACTION_REWARD,
      `Weekly ${factionName} reward: +$${wealth.toLocaleString()}, +${xp} XP`,
      { linkType: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user they became the Juicernaut
   */
  async notifyJuicernautCrown(userId: number, totalUsd: number): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.JUICERNAUT_CROWN,
      `You're now the Juicernaut! ($${totalUsd.toFixed(2)}) Enjoy 2x XP, 3x loot, and rob immunity!`,
      { linkType: NOTIFICATION_LINK_TYPES.LEADERBOARDS }
    )
  },

  /**
   * Notify user they lost the Juicernaut crown
   */
  async notifyJuicernautDethroned(userId: number, newHolderName: string): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.JUICERNAUT_DETHRONED,
      `${newHolderName} has taken the Juicernaut crown from you!`,
      { linkType: NOTIFICATION_LINK_TYPES.LEADERBOARDS }
    )
  },

  /**
   * Notify user of Juicernaut session reward
   */
  async notifyJuicernautReward(
    userId: number,
    wealth: number,
    xp: number,
    crate?: string
  ): Promise<void> {
    const crateText = crate ? ` + ${crate} crate` : ''

    await this.create(
      userId,
      NOTIFICATION_TYPES.JUICERNAUT_REWARD,
      `Juicernaut session ended! +$${wealth.toLocaleString()}, +${xp} XP${crateText}`,
      { linkType: NOTIFICATION_LINK_TYPES.LEADERBOARDS }
    )
  },

  /**
   * Notify user of monetization reward
   */
  async notifyMonetization(
    userId: number,
    eventType: string,
    wealth: number,
    xp: number
  ): Promise<void> {
    await this.create(
      userId,
      NOTIFICATION_TYPES.MONETIZATION,
      `Thank you for your ${eventType}! +$${wealth.toLocaleString()}, +${xp} XP`,
      { linkType: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of heist win
   */
  async notifyHeistWon(
    userId: number,
    crateTier: string,
    responseTimeMs: number
  ): Promise<void> {
    const responseTimeSec = (responseTimeMs / 1000).toFixed(2)

    await this.create(
      userId,
      NOTIFICATION_TYPES.HEIST_WON,
      `You won the heist! ${crateTier} crate earned in ${responseTimeSec}s`,
      { linkType: NOTIFICATION_LINK_TYPES.EVENTS }
    )
  },

  /**
   * Notify user of black market rotation (bulk notification)
   */
  async notifyBlackMarketRotation(userIds: number[]): Promise<void> {
    // Use bulk insert for efficiency
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + NOTIFICATION_CONFIG.RETENTION_DAYS)

    const notifications = userIds.map(userId => ({
      userId,
      notificationType: NOTIFICATION_TYPES.BLACK_MARKET_ROTATION,
      title: NOTIFICATION_TITLES[NOTIFICATION_TYPES.BLACK_MARKET_ROTATION],
      message: 'New items available in the Black Market!',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.BLACK_MARKET_ROTATION],
      linkType: NOTIFICATION_LINK_TYPES.MARKET,
      expiresAt,
    }))

    await prisma.userNotification.createMany({
      data: notifications,
      skipDuplicates: true,
    })
  },

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Map database notification to NotificationData
   */
  mapNotification(notification: {
    id: number
    notificationType: string
    title: string
    message: string
    icon: string | null
    linkType: string | null
    linkId: string | null
    isSeen: boolean
    createdAt: Date
  }): NotificationData {
    return {
      id: notification.id,
      type: notification.notificationType as NotificationType,
      title: notification.title,
      message: notification.message,
      icon: notification.icon ?? NOTIFICATION_ICONS[notification.notificationType as NotificationType] ?? '',
      linkType: notification.linkType as NotificationLinkType | null,
      linkId: notification.linkId,
      isSeen: notification.isSeen,
      createdAt: notification.createdAt,
    }
  },
}

export default NotificationService
