import { config } from '../config'
import { apiClient } from '../api-client'
import { logger } from '../utils/logger'
import { platformManager } from '../platforms'
import {
  formatPlayResult,
  formatRobResult,
  formatBailResult,
  formatWealth,
} from '../utils/formatter'
import type { ChannelPointRedemption, RedemptionContext } from '../types'

// =============================================================================
// REDEMPTION HANDLER
// =============================================================================

type RedemptionType = 'play' | 'rob' | 'bail' | 'reroll'

interface RewardConfig {
  kick: string
  twitch: string
}

// Map reward IDs to redemption types
const rewardMappings: Record<RedemptionType, RewardConfig> = {
  play: {
    kick: config.kick.rewards.play,
    twitch: config.twitch.rewards.play,
  },
  rob: {
    kick: config.kick.rewards.rob,
    twitch: config.twitch.rewards.rob,
  },
  bail: {
    kick: config.kick.rewards.bail,
    twitch: config.twitch.rewards.bail,
  },
  reroll: {
    kick: config.kick.rewards.reroll,
    twitch: config.twitch.rewards.reroll,
  },
}

/**
 * Get redemption type from reward ID
 */
function getRedemptionType(platform: string, rewardId: string): RedemptionType | null {
  for (const [type, rewards] of Object.entries(rewardMappings)) {
    const platformReward = rewards[platform as keyof RewardConfig]
    if (platformReward && platformReward === rewardId) {
      return type as RedemptionType
    }
  }

  // Also check by reward title (fallback)
  return null
}

/**
 * Get redemption type from reward title (fallback matching)
 */
function getRedemptionTypeByTitle(title: string): RedemptionType | null {
  const lowerTitle = title.toLowerCase()

  if (lowerTitle.includes('play') || lowerTitle.includes('kingpin')) {
    return 'play'
  }
  if (lowerTitle.includes('rob')) {
    return 'rob'
  }
  if (lowerTitle.includes('bail')) {
    return 'bail'
  }
  if (lowerTitle.includes('reroll') || lowerTitle.includes('refresh') || lowerTitle.includes('shop')) {
    return 'reroll'
  }

  return null
}

/**
 * Handle a channel point redemption
 */
export async function handleRedemption(redemption: ChannelPointRedemption): Promise<void> {
  // Determine redemption type
  let redemptionType = getRedemptionType(redemption.platform, redemption.rewardId)

  // Fallback to title matching if reward ID not configured
  if (!redemptionType) {
    redemptionType = getRedemptionTypeByTitle(redemption.rewardTitle)
  }

  if (!redemptionType) {
    logger.debug('Unknown redemption type:', {
      rewardId: redemption.rewardId,
      rewardTitle: redemption.rewardTitle,
    })
    return
  }

  // Create reply function
  const reply = async (text: string) => {
    await platformManager.sendMessage(redemption.platform, redemption.channelId, text)
  }

  const ctx: RedemptionContext = { redemption, reply }

  logger.info(`Processing ${redemptionType} redemption from ${redemption.username} on ${redemption.platform}`)

  try {
    switch (redemptionType) {
      case 'play':
        await handlePlay(ctx)
        break
      case 'rob':
        await handleRob(ctx)
        break
      case 'bail':
        await handleBail(ctx)
        break
      case 'reroll':
        await handleReroll(ctx)
        break
    }
  } catch (error) {
    logger.error(`Error handling ${redemptionType} redemption:`, error)
    await reply(`@${redemption.username} Error processing your redemption. Please try again.`)
  }
}

/**
 * Handle Play redemption
 */
async function handlePlay(ctx: RedemptionContext): Promise<void> {
  const { redemption, reply } = ctx

  // Get user ID from platform
  const profileResponse = await apiClient.getProfileByUsername(redemption.username)

  if (!profileResponse.success || !profileResponse.data) {
    await reply(`@${redemption.username} You need to create an account first at kingpin.simianmonke.com`)
    return
  }

  const profile = profileResponse.data

  // Execute play
  const response = await apiClient.play(profile.id)

  if (!response.success || !response.data) {
    await reply(`@${redemption.username} ${response.error || 'Failed to play'}`)
    return
  }

  // Format and send result with title
  const displayName = profile.kingpinName || profile.username
  const equippedTitle = profile.equippedTitle || null
  const message = formatPlayResult(displayName, equippedTitle, response.data)
  await reply(message)
}

/**
 * Handle Rob redemption
 */
async function handleRob(ctx: RedemptionContext): Promise<void> {
  const { redemption, reply } = ctx

  // Rob requires a target in user input
  const targetUsername = redemption.userInput?.replace('@', '').trim()

  if (!targetUsername) {
    await reply(`@${redemption.username} You need to specify a target! Enter a username when redeeming.`)
    return
  }

  // Get attacker profile
  const attackerResponse = await apiClient.getProfileByUsername(redemption.username)

  if (!attackerResponse.success || !attackerResponse.data) {
    await reply(`@${redemption.username} You need to create an account first at kingpin.simianmonke.com`)
    return
  }

  const attacker = attackerResponse.data

  // Execute rob
  const response = await apiClient.rob(attacker.id, targetUsername)

  if (!response.success || !response.data) {
    await reply(`@${redemption.username} ${response.error || 'Failed to rob'}`)
    return
  }

  // Format and send result with attacker's title
  const displayName = attacker.kingpinName || attacker.username
  const equippedTitle = attacker.equippedTitle || null
  const message = formatRobResult(displayName, equippedTitle, response.data)
  await reply(message)
}

/**
 * Handle Bail redemption
 */
async function handleBail(ctx: RedemptionContext): Promise<void> {
  const { redemption, reply } = ctx

  // Get user profile
  const profileResponse = await apiClient.getProfileByUsername(redemption.username)

  if (!profileResponse.success || !profileResponse.data) {
    await reply(`@${redemption.username} You need to create an account first at kingpin.simianmonke.com`)
    return
  }

  const profile = profileResponse.data

  // Execute bail
  const response = await apiClient.bail(profile.id)

  if (!response.success || !response.data) {
    await reply(`@${redemption.username} ${response.error || 'Failed to bail'}`)
    return
  }

  // Format and send result with title
  const displayName = profile.kingpinName || profile.username
  const equippedTitle = profile.equippedTitle || null
  const message = formatBailResult(displayName, equippedTitle, response.data.paid)
  await reply(message)
}

/**
 * Handle Shop Reroll redemption
 */
async function handleReroll(ctx: RedemptionContext): Promise<void> {
  const { redemption, reply } = ctx

  // Get user ID
  const profileResponse = await apiClient.getProfileByUsername(redemption.username)

  if (!profileResponse.success || !profileResponse.data) {
    await reply(`@${redemption.username} You need to create an account first at kingpin.simianmonke.com`)
    return
  }

  // Execute reroll
  const response = await apiClient.rerollShop(profileResponse.data.id)

  if (!response.success) {
    await reply(`@${redemption.username} ${response.error || 'Failed to reroll shop'}`)
    return
  }

  await reply(`@${redemption.username} 🛒 Your shop has been refreshed! Check your new items.`)
}

export default handleRedemption
