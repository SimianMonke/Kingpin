import { apiClient } from '../api-client'
import { formatWealth, formatXp, formatCrateTier } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// ADMIN COMMANDS
// =============================================================================

export const adminCommands = {
  /**
   * !startsession [title] - Start a new streaming session
   * Mod/Broadcaster only
   */
  async startSession(ctx: CommandContext): Promise<void> {
    const title = ctx.args.join(' ') || undefined
    const platform = ctx.message.platform

    const response = await apiClient.startSession(platform, title)

    if (!response.success || !response.data) {
      await ctx.reply(`❌ Failed to start session: ${response.error}`)
      return
    }

    await ctx.reply(
      `🎬 Session started! "${response.data.title}" on ${response.data.platform} (ID: ${response.data.id})`
    )
  },

  /**
   * !endsession - End the current streaming session
   * Mod/Broadcaster only
   */
  async endSession(ctx: CommandContext): Promise<void> {
    // Get active session first
    const sessionResponse = await apiClient.getJuicernautSession()

    if (!sessionResponse.success || !sessionResponse.data || !sessionResponse.data.isActive) {
      await ctx.reply(`No active session to end`)
      return
    }

    const response = await apiClient.endSession(sessionResponse.data.id)

    if (!response.success) {
      await ctx.reply(`❌ Failed to end session: ${response.error}`)
      return
    }

    await ctx.reply(`🎬 Session ended! Thanks for watching!`)
  },

  /**
   * !givewealth <user> <amount> - Give wealth to a player
   * Broadcaster only
   */
  async giveWealth(ctx: CommandContext): Promise<void> {
    const username = ctx.args[0]?.replace('@', '')
    const amount = parseInt(ctx.args[1], 10)

    if (!username || isNaN(amount) || amount <= 0) {
      await ctx.reply(`Usage: !givewealth <username> <amount>`)
      return
    }

    // Get user ID
    const profileResponse = await apiClient.getProfileByUsername(username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find player "${username}"`)
      return
    }

    const response = await apiClient.giveWealth(profileResponse.data.id, amount)

    if (!response.success) {
      await ctx.reply(`❌ Failed to give wealth: ${response.error}`)
      return
    }

    await ctx.reply(
      `✅ Gave ${formatWealth(amount)} to ${username}. New balance: ${formatWealth(response.data?.newWealth || 0)}`
    )
  },

  /**
   * !givexp <user> <amount> - Give XP to a player
   * Broadcaster only
   */
  async giveXp(ctx: CommandContext): Promise<void> {
    const username = ctx.args[0]?.replace('@', '')
    const amount = parseInt(ctx.args[1], 10)

    if (!username || isNaN(amount) || amount <= 0) {
      await ctx.reply(`Usage: !givexp <username> <amount>`)
      return
    }

    // Get user ID
    const profileResponse = await apiClient.getProfileByUsername(username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find player "${username}"`)
      return
    }

    const response = await apiClient.giveXp(profileResponse.data.id, amount)

    if (!response.success) {
      await ctx.reply(`❌ Failed to give XP: ${response.error}`)
      return
    }

    await ctx.reply(
      `✅ Gave ${formatXp(amount)} XP to ${username}. Now level ${response.data?.newLevel || '?'}`
    )
  },

  /**
   * !givecrate <user> <tier> - Give a crate to a player
   * Broadcaster only
   */
  async giveCrate(ctx: CommandContext): Promise<void> {
    const username = ctx.args[0]?.replace('@', '')
    const tier = ctx.args[1]?.toLowerCase()

    const validTiers = ['common', 'uncommon', 'rare', 'legendary']

    if (!username || !tier || !validTiers.includes(tier)) {
      await ctx.reply(`Usage: !givecrate <username> <common|uncommon|rare|legendary>`)
      return
    }

    // Get user ID
    const profileResponse = await apiClient.getProfileByUsername(username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find player "${username}"`)
      return
    }

    const response = await apiClient.giveCrate(profileResponse.data.id, tier)

    if (!response.success) {
      await ctx.reply(`❌ Failed to give crate: ${response.error}`)
      return
    }

    await ctx.reply(`✅ Gave ${formatCrateTier(tier)} crate to ${username}`)
  },

  /**
   * HIGH-04: !giveitem <user> <itemId> - Give an item to a player
   * Broadcaster only
   */
  async giveItem(ctx: CommandContext): Promise<void> {
    const username = ctx.args[0]?.replace('@', '')
    const itemId = parseInt(ctx.args[1], 10)

    if (!username || isNaN(itemId) || itemId <= 0) {
      await ctx.reply(`Usage: !giveitem <username> <itemId>`)
      return
    }

    // Get user ID
    const profileResponse = await apiClient.getProfileByUsername(username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find player "${username}"`)
      return
    }

    const response = await apiClient.giveItem(profileResponse.data.id, itemId)

    if (!response.success) {
      await ctx.reply(`❌ Failed to give item: ${response.error}`)
      return
    }

    await ctx.reply(`✅ Gave ${response.data?.item?.name || 'item'} to ${username}`)
  },

  /**
   * HIGH-04: !rotatemarket - Force rotate the Black Market
   * Broadcaster only
   */
  async rotateMarket(ctx: CommandContext): Promise<void> {
    const response = await apiClient.rotateMarket()

    if (!response.success) {
      await ctx.reply(`❌ Failed to rotate market: ${response.error}`)
      return
    }

    await ctx.reply(`✅ Black Market rotated! ${response.data?.newItems || 0} new items available.`)
  },
}

export default adminCommands
