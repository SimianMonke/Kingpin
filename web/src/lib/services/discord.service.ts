import {
  DISCORD_FEED_CONFIG,
  TIERS,
  ACHIEVEMENT_TIERS,
  CRATE_TIERS,
  type Tier,
  type AchievementTier,
  type CrateTier,
} from '../game/constants'

// =============================================================================
// DISCORD SERVICE TYPES
// =============================================================================

interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  thumbnail?: { url: string }
  footer?: { text: string }
  timestamp?: string
}

interface DiscordWebhookPayload {
  content?: string | null
  embeds?: DiscordEmbed[]
  username?: string
  avatar_url?: string
}

// =============================================================================
// DISCORD SERVICE
// =============================================================================

export const DiscordService = {
  /**
   * Get the Discord feed webhook URL
   */
  getFeedWebhookUrl(): string | null {
    return process.env.DISCORD_FEED_WEBHOOK_URL ?? null
  },

  /**
   * Get the Discord admin webhook URL
   */
  getAdminWebhookUrl(): string | null {
    return process.env.DISCORD_ADMIN_WEBHOOK_URL ?? null
  },

  /**
   * Send a webhook message to Discord
   */
  async sendWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          username: payload.username ?? 'Kingpin RPG',
        }),
      })

      if (!response.ok) {
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`)
        return false
      }

      return true
    } catch (error) {
      console.error('Discord webhook error:', error)
      return false
    }
  },

  /**
   * Post an embed to the feed channel
   */
  async postToFeed(embed: DiscordEmbed): Promise<boolean> {
    const webhookUrl = this.getFeedWebhookUrl()
    if (!webhookUrl) {
      console.warn('DISCORD_FEED_WEBHOOK_URL not configured')
      return false
    }

    return this.sendWebhook(webhookUrl, {
      embeds: [{
        ...embed,
        timestamp: embed.timestamp ?? new Date().toISOString(),
        footer: embed.footer ?? { text: 'Kingpin RPG' },
      }],
    })
  },

  /**
   * Post an embed to the admin channel
   */
  async postAdminAlert(embed: DiscordEmbed): Promise<boolean> {
    const webhookUrl = this.getAdminWebhookUrl()
    if (!webhookUrl) {
      console.warn('DISCORD_ADMIN_WEBHOOK_URL not configured')
      return false
    }

    return this.sendWebhook(webhookUrl, {
      embeds: [{
        ...embed,
        timestamp: embed.timestamp ?? new Date().toISOString(),
        footer: embed.footer ?? { text: 'Kingpin Admin' },
      }],
    })
  },

  // =============================================================================
  // FEED CHANNEL POSTS (Major events only)
  // =============================================================================

  /**
   * Post tier promotion to feed (Captain+ only)
   */
  async postTierPromotion(username: string, tier: Tier): Promise<boolean> {
    // Only post Captain and above
    const tierOrder = [TIERS.PUNK, TIERS.ASSOCIATE, TIERS.SOLDIER, TIERS.CAPTAIN, TIERS.UNDERBOSS, TIERS.KINGPIN]
    const tierIndex = tierOrder.indexOf(tier)
    const minTierIndex = tierOrder.indexOf(DISCORD_FEED_CONFIG.TIER_PROMOTION_MIN_TIER)

    if (tierIndex < minTierIndex) {
      return false
    }

    return this.postToFeed({
      title: `${getTierEmoji(tier)} Tier Promotion!`,
      description: `**${username}** has reached **${tier}** tier!`,
      color: DISCORD_FEED_CONFIG.COLORS.GOLD,
    })
  },

  /**
   * Post legendary item drop to feed
   */
  async postLegendaryDrop(
    username: string,
    itemName: string,
    type: string,
    source: string
  ): Promise<boolean> {
    return this.postToFeed({
      title: '🌟 Legendary Drop!',
      description: `**${username}** found a **${itemName}** (Legendary ${type})!`,
      color: DISCORD_FEED_CONFIG.COLORS.GOLD,
      fields: [
        { name: 'Source', value: source, inline: true },
      ],
    })
  },

  /**
   * Post achievement unlock to feed (Platinum+ only)
   */
  async postAchievement(
    username: string,
    name: string,
    tier: AchievementTier
  ): Promise<boolean> {
    // Only post Platinum and above
    const tierOrder = [
      ACHIEVEMENT_TIERS.BRONZE,
      ACHIEVEMENT_TIERS.SILVER,
      ACHIEVEMENT_TIERS.GOLD,
      ACHIEVEMENT_TIERS.PLATINUM,
      ACHIEVEMENT_TIERS.LEGENDARY,
    ]
    const tierIndex = tierOrder.indexOf(tier)
    const minTierIndex = tierOrder.indexOf(DISCORD_FEED_CONFIG.ACHIEVEMENT_MIN_TIER as AchievementTier)

    if (tierIndex < minTierIndex) {
      return false
    }

    return this.postToFeed({
      title: `${getAchievementEmoji(tier)} Achievement Unlocked!`,
      description: `**${username}** unlocked **${name}** (${tier})!`,
      color: tier === ACHIEVEMENT_TIERS.LEGENDARY
        ? DISCORD_FEED_CONFIG.COLORS.GOLD
        : DISCORD_FEED_CONFIG.COLORS.PURPLE,
    })
  },

  /**
   * Post territory capture to feed
   */
  async postTerritoryCapture(
    faction_name: string,
    territoryName: string,
    previousController?: string
  ): Promise<boolean> {
    const description = previousController
      ? `**${faction_name}** captured **${territoryName}** from ${previousController}!`
      : `**${faction_name}** captured **${territoryName}**!`

    return this.postToFeed({
      title: '🏴 Territory Captured!',
      description,
      color: DISCORD_FEED_CONFIG.COLORS.BLUE,
    })
  },

  /**
   * Post weekly faction winner to feed
   */
  async postWeeklyFactionWinner(
    faction_name: string,
    territories_controlled: number,
    totalScore: number
  ): Promise<boolean> {
    return this.postToFeed({
      title: '🏆 Weekly Faction Winner!',
      description: `**${faction_name}** dominated this week!`,
      color: DISCORD_FEED_CONFIG.COLORS.GOLD,
      fields: [
        { name: 'Territories', value: territories_controlled.toString(), inline: true },
        { name: 'Total Score', value: totalScore.toLocaleString(), inline: true },
      ],
    })
  },

  /**
   * Post item theft to feed
   */
  async postItemTheft(
    attackerName: string,
    defenderName: string,
    itemName: string,
    item_tier: string
  ): Promise<boolean> {
    return this.postToFeed({
      title: '🔥 Item Stolen!',
      description: `**${attackerName}** stole **${itemName}** (${item_tier}) from **${defenderName}**!`,
      color: DISCORD_FEED_CONFIG.COLORS.ORANGE,
    })
  },

  /**
   * Post rare/legendary crate drop to feed
   */
  async postCrateDrop(
    username: string,
    crate_tier: CrateTier,
    source: string
  ): Promise<boolean> {
    // Only post Rare and above
    const tierOrder = [CRATE_TIERS.COMMON, CRATE_TIERS.UNCOMMON, CRATE_TIERS.RARE, CRATE_TIERS.LEGENDARY]
    const tierIndex = tierOrder.indexOf(crate_tier)
    const minTierIndex = tierOrder.indexOf(DISCORD_FEED_CONFIG.CRATE_DROP_MIN_TIER as CrateTier)

    if (tierIndex < minTierIndex) {
      return false
    }

    return this.postToFeed({
      title: `${getCrateEmoji(crate_tier)} ${crate_tier} Crate Found!`,
      description: `**${username}** found a **${crate_tier}** crate from ${source}!`,
      color: crate_tier === CRATE_TIERS.LEGENDARY
        ? DISCORD_FEED_CONFIG.COLORS.GOLD
        : DISCORD_FEED_CONFIG.COLORS.PURPLE,
    })
  },

  /**
   * Post heist winner to feed (for hard difficulty)
   */
  async postHeistWinner(
    username: string,
    event_type: string,
    difficulty: string,
    crate_tier: string,
    response_time_ms: number
  ): Promise<boolean> {
    // Only post hard difficulty wins
    if (difficulty !== 'hard') {
      return false
    }

    const responseTimeSec = (response_time_ms / 1000).toFixed(2)

    return this.postToFeed({
      title: '🚨 Heist Completed!',
      description: `**${username}** cracked the ${event_type} heist in **${responseTimeSec}s**!`,
      color: DISCORD_FEED_CONFIG.COLORS.ORANGE,
      fields: [
        { name: 'Reward', value: `${crate_tier} Crate`, inline: true },
      ],
    })
  },

  // =============================================================================
  // ADMIN CHANNEL POSTS (All significant events)
  // =============================================================================

  /**
   * Post monetization event to admin
   */
  async postMonetization(
    username: string,
    platform: string,
    event_type: string,
    quantity: number,
    amount_usd: number,
    rewards: { wealth: number; xp: number }
  ): Promise<boolean> {
    return this.postAdminAlert({
      title: `${getPlatformEmoji(platform)} New ${event_type}!`,
      description: `**${username}** ${formatEventType(event_type)}`,
      color: DISCORD_FEED_CONFIG.COLORS.PURPLE,
      fields: [
        { name: 'Platform', value: platform, inline: true },
        { name: 'Amount', value: quantity > 1 ? `${quantity}x` : 'x1', inline: true },
        { name: 'USD Value', value: `$${amount_usd.toFixed(2)}`, inline: true },
        { name: 'Rewards', value: `$${rewards.wealth.toLocaleString()} + ${rewards.xp} XP`, inline: true },
      ],
    })
  },

  /**
   * Post Juicernaut crown change to admin
   */
  async postCrownChange(
    newHolderName: string,
    previousHolderName: string | null,
    totalUsd: number
  ): Promise<boolean> {
    const description = previousHolderName
      ? `**${newHolderName}** has overthrown **${previousHolderName}** to become the Juicernaut!`
      : `**${newHolderName}** has claimed the Juicernaut crown!`

    return this.postAdminAlert({
      title: '👑 Crown Change!',
      description,
      color: DISCORD_FEED_CONFIG.COLORS.GOLD,
      fields: [
        { name: 'Total Contributed', value: `$${totalUsd.toFixed(2)}`, inline: true },
      ],
    })
  },

  /**
   * Post session start to admin
   */
  async postSessionStart(
    session_id: number,
    platform: string,
    title?: string
  ): Promise<boolean> {
    return this.postAdminAlert({
      title: '🎬 Stream Session Started',
      description: title ?? 'New streaming session has begun!',
      color: DISCORD_FEED_CONFIG.COLORS.GREEN,
      fields: [
        { name: 'Session ID', value: session_id.toString(), inline: true },
        { name: 'Platform', value: platform, inline: true },
      ],
    })
  },

  /**
   * Post session end summary to admin
   */
  async postSessionSummary(
    session_id: number,
    stats: {
      total_contributions_usd: number
      totalContributors: number
      winnerName?: string
      winnerContributionUsd?: number
      totalHeists: number
      durationMinutes: number
    }
  ): Promise<boolean> {
    const fields = [
      { name: 'Session ID', value: session_id.toString(), inline: true },
      { name: 'Duration', value: `${stats.durationMinutes} min`, inline: true },
      { name: 'Total Contributions', value: `$${stats.total_contributions_usd.toFixed(2)}`, inline: true },
      { name: 'Contributors', value: stats.totalContributors.toString(), inline: true },
      { name: 'Heists', value: stats.totalHeists.toString(), inline: true },
    ]

    if (stats.winnerName) {
      fields.push({
        name: 'Juicernaut Winner',
        value: `${stats.winnerName} ($${stats.winnerContributionUsd?.toFixed(2) ?? '0.00'})`,
        inline: true,
      })
    }

    return this.postAdminAlert({
      title: '🎬 Stream Session Ended',
      description: 'Session summary:',
      color: DISCORD_FEED_CONFIG.COLORS.BLUE,
      fields,
    })
  },

  /**
   * Post system alert to admin
   */
  async postSystemAlert(
    level: 'info' | 'warning' | 'error',
    message: string,
    details?: string
  ): Promise<boolean> {
    const colors = {
      info: DISCORD_FEED_CONFIG.COLORS.BLUE,
      warning: 0xFFAA00,
      error: DISCORD_FEED_CONFIG.COLORS.RED,
    }

    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '🚨',
    }

    return this.postAdminAlert({
      title: `${emojis[level]} System ${level.charAt(0).toUpperCase() + level.slice(1)}`,
      description: message,
      color: colors[level],
      fields: details ? [{ name: 'Details', value: details }] : undefined,
    })
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getTierEmoji(tier: Tier): string {
  const emojis: Record<Tier, string> = {
    [TIERS.PUNK]: '🔰',
    [TIERS.ASSOCIATE]: '⭐',
    [TIERS.SOLDIER]: '🎖️',
    [TIERS.CAPTAIN]: '🏅',
    [TIERS.UNDERBOSS]: '👔',
    [TIERS.KINGPIN]: '👑',
  }
  return emojis[tier] ?? '⭐'
}

function getAchievementEmoji(tier: AchievementTier): string {
  const emojis: Record<AchievementTier, string> = {
    [ACHIEVEMENT_TIERS.BRONZE]: '🥉',
    [ACHIEVEMENT_TIERS.SILVER]: '🥈',
    [ACHIEVEMENT_TIERS.GOLD]: '🥇',
    [ACHIEVEMENT_TIERS.PLATINUM]: '💎',
    [ACHIEVEMENT_TIERS.LEGENDARY]: '🌟',
  }
  return emojis[tier] ?? '🏅'
}

function getCrateEmoji(tier: CrateTier): string {
  const emojis: Record<CrateTier, string> = {
    [CRATE_TIERS.COMMON]: '📦',
    [CRATE_TIERS.UNCOMMON]: '📦',
    [CRATE_TIERS.RARE]: '🎁',
    [CRATE_TIERS.LEGENDARY]: '✨',
  }
  return emojis[tier] ?? '📦'
}

function getPlatformEmoji(platform: string): string {
  const emojis: Record<string, string> = {
    kick: '💚',
    twitch: '💜',
    stripe: '💰',
  }
  return emojis[platform.toLowerCase()] ?? '💰'
}

function formatEventType(event_type: string): string {
  const formats: Record<string, string> = {
    subscription: 'subscribed!',
    gift_sub: 'gifted subs!',
    bits: 'sent bits!',
    kick: 'sent kicks!',
    raid: 'raided the stream!',
    donation: 'donated!',
  }
  return formats[event_type] ?? event_type
}

export default DiscordService
