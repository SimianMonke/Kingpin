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
  link_type: NotificationLinkType | null
  link_id: string | null
  is_seen: boolean
  created_at: Date
}

export interface CreateNotificationOptions {
  link_type?: NotificationLinkType
  link_id?: string
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
    user_id: number,
    type: NotificationType,
    message: string,
    options: CreateNotificationOptions = {}
  ): Promise<NotificationData | null> {
    try {
      // Enforce limit first (delete oldest if at max)
      await this.enforceLimit(user_id)

      const expires_at = new Date()
      expires_at.setDate(expires_at.getDate() + NOTIFICATION_CONFIG.RETENTION_DAYS)

      const notification = await prisma.user_notifications.create({
        data: {
          user_id,
          notification_type: type,
          title: options.customTitle ?? NOTIFICATION_TITLES[type],
          message,
          icon: options.customIcon ?? NOTIFICATION_ICONS[type],
          link_type: options.link_type ?? null,
          link_id: options.link_id ?? null,
          expires_at,
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
    user_id: number,
    limit = 25,
    includeRead = false
  ): Promise<NotificationListResult> {
    const where = {
      user_id,
      is_dismissed: false,
      ...(includeRead ? {} : { is_seen: false }),
    }

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.user_notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      prisma.user_notifications.count({
        where: { user_id, is_seen: false, is_dismissed: false },
      }),
      prisma.user_notifications.count({
        where: { user_id, is_dismissed: false },
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
  async getUnreadCount(user_id: number): Promise<number> {
    return prisma.user_notifications.count({
      where: { user_id, is_seen: false, is_dismissed: false },
    })
  },

  /**
   * Mark notifications as seen
   */
  async markAsSeen(user_id: number, notificationIds?: number[]): Promise<number> {
    const result = await prisma.user_notifications.updateMany({
      where: {
        user_id,
        is_seen: false,
        ...(notificationIds ? { id: { in: notificationIds } } : {}),
      },
      data: {
        is_seen: true,
        seen_at: new Date(),
      },
    })

    return result.count
  },

  /**
   * Dismiss a single notification
   */
  async dismiss(user_id: number, notificationId: number): Promise<boolean> {
    const result = await prisma.user_notifications.updateMany({
      where: { notification_id: notificationId, user_id },
      data: {
        is_dismissed: true,
        dismissed_at: new Date(),
      },
    })

    return result.count > 0
  },

  /**
   * Clear all notifications for a user
   */
  async clearAll(user_id: number): Promise<number> {
    const result = await prisma.user_notifications.updateMany({
      where: { user_id, is_dismissed: false },
      data: {
        is_dismissed: true,
        dismissed_at: new Date(),
      },
    })

    return result.count
  },

  /**
   * Enforce notification limit (max 25 per user)
   */
  async enforceLimit(user_id: number): Promise<void> {
    const count = await prisma.user_notifications.count({
      where: { user_id, is_dismissed: false },
    })

    if (count >= NOTIFICATION_CONFIG.MAX_PER_USER) {
      // Find the oldest notifications beyond the limit
      const toDelete = await prisma.user_notifications.findMany({
        where: { user_id, is_dismissed: false },
        orderBy: { created_at: 'asc' },
        take: count - NOTIFICATION_CONFIG.MAX_PER_USER + 1,
        select: { notification_id: true },
      })

      if (toDelete.length > 0) {
        await prisma.user_notifications.deleteMany({
          where: { notification_id: { in: toDelete.map(n => n.notification_id) } },
        })
      }
    }
  },

  /**
   * Cleanup expired notifications (scheduled job)
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.user_notifications.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: new Date() } },
          {
            created_at: {
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
  async notifyCheckin(user_id: number, streak: number, wealth: number, xp: number): Promise<void> {
    const isMilestone = [7, 14, 30, 60, 90, 180, 365].includes(streak)
    const type = isMilestone ? NOTIFICATION_TYPES.CHECKIN_MILESTONE : NOTIFICATION_TYPES.CHECKIN

    await this.create(
      user_id,
      type,
      isMilestone
        ? `${streak}-day streak reached! +$${wealth.toLocaleString()}, +${xp} XP, and a bonus crate!`
        : `Streak: ${streak} days. +$${wealth.toLocaleString()}, +${xp} XP`,
      { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of level up
   */
  async notifyLevelUp(user_id: number, newLevel: number): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.LEVEL_UP,
      `You reached level ${newLevel}!`,
      { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of tier promotion
   */
  async notifyTierPromotion(user_id: number, newTier: string): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.TIER_PROMOTION,
      `You've been promoted to ${newTier}!`,
      { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
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
        { link_type: NOTIFICATION_LINK_TYPES.INVENTORY }
      )
    } else {
      await this.create(
        defenderId,
        NOTIFICATION_TYPES.ROBBED,
        `${attackerName} robbed you for $${amount.toLocaleString()}`,
        { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
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
      { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user that their item broke
   */
  async notifyItemBroke(user_id: number, itemName: string, slot: string): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.ITEM_BROKE,
      `Your ${itemName} (${slot}) has broken from use!`,
      { link_type: NOTIFICATION_LINK_TYPES.INVENTORY }
    )
  },

  /**
   * Notify user of crate received
   */
  async notifyCrateReceived(
    user_id: number,
    crate_tier: string,
    source: string,
    is_escrowed = false
  ): Promise<void> {
    const type = is_escrowed ? NOTIFICATION_TYPES.CRATE_ESCROW : NOTIFICATION_TYPES.CRATE_RECEIVED
    const escrowNote = is_escrowed ? ' (in escrow - claim within 1 hour!)' : ''

    await this.create(
      user_id,
      type,
      `You received a ${crate_tier} crate from ${source}${escrowNote}`,
      { link_type: NOTIFICATION_LINK_TYPES.CRATES }
    )
  },

  /**
   * Notify user of crate expiration
   */
  async notifyCrateExpired(user_id: number, crate_tier: string): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.CRATE_EXPIRED,
      `Your ${crate_tier} crate expired! Remember to claim escrowed crates within 1 hour.`,
      { link_type: NOTIFICATION_LINK_TYPES.CRATES }
    )
  },

  /**
   * Notify user of achievement unlock
   */
  async notifyAchievement(
    user_id: number,
    name: string,
    tier: string,
    rewards: { wealth?: number; xp?: number; title?: string }
  ): Promise<void> {
    const rewardParts: string[] = []
    if (rewards.wealth) rewardParts.push(`$${rewards.wealth.toLocaleString()}`)
    if (rewards.xp) rewardParts.push(`${rewards.xp} XP`)
    if (rewards.title) rewardParts.push(`"${rewards.title}" title`)

    const rewardText = rewardParts.length > 0 ? ` Rewards: ${rewardParts.join(', ')}` : ''

    await this.create(
      user_id,
      NOTIFICATION_TYPES.ACHIEVEMENT,
      `${name} (${tier})!${rewardText}`,
      { link_type: NOTIFICATION_LINK_TYPES.ACHIEVEMENTS }
    )
  },

  /**
   * Notify user of title unlock
   */
  async notifyTitleUnlocked(user_id: number, title: string): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.TITLE_UNLOCKED,
      `You unlocked the "${title}" title! Equip it in your profile.`,
      { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of mission completion
   */
  async notifyMissionComplete(
    user_id: number,
    mission_type: string,
    totalRewards: { wealth: number; xp: number; crate?: string }
  ): Promise<void> {
    const crateText = totalRewards.crate ? ` + ${totalRewards.crate} crate` : ''

    await this.create(
      user_id,
      NOTIFICATION_TYPES.MISSION_COMPLETE,
      `All ${mission_type} missions complete! +$${totalRewards.wealth.toLocaleString()}, +${totalRewards.xp} XP${crateText}`,
      { link_type: NOTIFICATION_LINK_TYPES.MISSIONS }
    )
  },

  /**
   * Notify user of mission expiration
   */
  async notifyMissionExpired(user_id: number, mission_type: string, count: number): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.MISSION_EXPIRED,
      `${count} ${mission_type} mission${count > 1 ? 's' : ''} expired. New missions available!`,
      { link_type: NOTIFICATION_LINK_TYPES.MISSIONS }
    )
  },

  /**
   * Notify user of faction join
   */
  async notifyFactionJoined(user_id: number, faction_name: string): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.FACTION_JOINED,
      `Welcome to ${faction_name}! Start earning territory points for your faction.`,
      { link_type: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user of territory capture
   */
  async notifyTerritoryCapture(
    user_id: number,
    territoryName: string,
    faction_name: string
  ): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.TERRITORY_CAPTURED,
      `${faction_name} has captured ${territoryName}!`,
      { link_type: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user of territory loss
   */
  async notifyTerritoryLost(
    user_id: number,
    territoryName: string,
    newControllerName: string
  ): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.TERRITORY_LOST,
      `${territoryName} was lost to ${newControllerName}`,
      { link_type: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user of faction weekly reward
   */
  async notifyFactionReward(
    user_id: number,
    faction_name: string,
    wealth: number,
    xp: number
  ): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.FACTION_REWARD,
      `Weekly ${faction_name} reward: +$${wealth.toLocaleString()}, +${xp} XP`,
      { link_type: NOTIFICATION_LINK_TYPES.FACTION }
    )
  },

  /**
   * Notify user they became the Juicernaut
   */
  async notifyJuicernautCrown(user_id: number, totalUsd: number): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.JUICERNAUT_CROWN,
      `You're now the Juicernaut! ($${totalUsd.toFixed(2)}) Enjoy 2x XP, 3x loot, and rob immunity!`,
      { link_type: NOTIFICATION_LINK_TYPES.LEADERBOARDS }
    )
  },

  /**
   * Notify user they lost the Juicernaut crown
   */
  async notifyJuicernautDethroned(user_id: number, newHolderName: string): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.JUICERNAUT_DETHRONED,
      `${newHolderName} has taken the Juicernaut crown from you!`,
      { link_type: NOTIFICATION_LINK_TYPES.LEADERBOARDS }
    )
  },

  /**
   * Notify user of Juicernaut session reward
   */
  async notifyJuicernautReward(
    user_id: number,
    wealth: number,
    xp: number,
    crate?: string
  ): Promise<void> {
    const crateText = crate ? ` + ${crate} crate` : ''

    await this.create(
      user_id,
      NOTIFICATION_TYPES.JUICERNAUT_REWARD,
      `Juicernaut session ended! +$${wealth.toLocaleString()}, +${xp} XP${crateText}`,
      { link_type: NOTIFICATION_LINK_TYPES.LEADERBOARDS }
    )
  },

  /**
   * Notify user of monetization reward
   */
  async notifyMonetization(
    user_id: number,
    event_type: string,
    wealth: number,
    xp: number
  ): Promise<void> {
    await this.create(
      user_id,
      NOTIFICATION_TYPES.MONETIZATION,
      `Thank you for your ${event_type}! +$${wealth.toLocaleString()}, +${xp} XP`,
      { link_type: NOTIFICATION_LINK_TYPES.PROFILE }
    )
  },

  /**
   * Notify user of heist win
   */
  async notifyHeistWon(
    user_id: number,
    crate_tier: string,
    response_time_ms: number
  ): Promise<void> {
    const responseTimeSec = (response_time_ms / 1000).toFixed(2)

    await this.create(
      user_id,
      NOTIFICATION_TYPES.HEIST_WON,
      `You won the heist! ${crate_tier} crate earned in ${responseTimeSec}s`,
      { link_type: NOTIFICATION_LINK_TYPES.EVENTS }
    )
  },

  /**
   * Notify user of black market rotation (bulk notification)
   */
  async notifyBlackMarketRotation(user_ids: number[]): Promise<void> {
    // Use bulk insert for efficiency
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + NOTIFICATION_CONFIG.RETENTION_DAYS)

    const notifications = user_ids.map(user_id => ({
      user_id,
      notification_type: NOTIFICATION_TYPES.BLACK_MARKET_ROTATION,
      title: NOTIFICATION_TITLES[NOTIFICATION_TYPES.BLACK_MARKET_ROTATION],
      message: 'New items available in the Black Market!',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.BLACK_MARKET_ROTATION],
      link_type: NOTIFICATION_LINK_TYPES.MARKET,
      expires_at,
    }))

    await prisma.user_notifications.createMany({
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
    notification_id: number
    notification_type: string
    title: string
    message: string
    icon: string | null
    link_type: string | null
    link_id: string | null
    is_seen: boolean | null
    created_at: Date | null
  }): NotificationData {
    return {
      id: notification.notification_id,
      type: notification.notification_type as NotificationType,
      title: notification.title,
      message: notification.message,
      icon: notification.icon ?? NOTIFICATION_ICONS[notification.notification_type as NotificationType] ?? '',
      link_type: notification.link_type as NotificationLinkType | null,
      link_id: notification.link_id,
      is_seen: notification.is_seen ?? false,
      created_at: notification.created_at ?? new Date(),
    }
  },
}

export default NotificationService
