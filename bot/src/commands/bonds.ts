import { apiClient } from '../api-client'
import { formatWealth } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// BOND COMMANDS (Phase 4 - Premium Currency)
// =============================================================================

export const bondsCommands = {
  /**
   * !bonds - View your bond balance and conversion status
   * Usage: !bonds
   */
  async bonds(ctx: CommandContext): Promise<void> {
    // Get user ID from platform
    const lookupResult = await apiClient.getUserByPlatform(
      ctx.message.platform as 'kick' | 'twitch' | 'discord',
      ctx.message.userId
    )

    if (!lookupResult.success || !lookupResult.data) {
      await ctx.reply('You need to play first to create an account!')
      return
    }

    const userId = lookupResult.data.userId
    const response = await apiClient.getBondStatus(userId)

    if (!response.success || !response.data) {
      await ctx.reply('Could not fetch bond status. Try again later.')
      return
    }

    const status = response.data
    const conversionInfo = status.canConvert
      ? `Ready to convert!`
      : status.daysUntilNextConversion > 0
        ? `${status.daysUntilNextConversion}d until next conversion`
        : `Requires level ${status.requiredLevel}+`

    await ctx.reply(
      `💎 Bonds: ${status.bonds} | Convert: ${formatWealth(status.conversionCost)} → ${status.conversionReward} bonds | ${conversionInfo}`
    )
  },

  /**
   * !convertbonds - Convert $2.5M credits to 100 bonds
   * Usage: !convertbonds
   * Requirements: Captain tier (level 60+), 7-day cooldown
   */
  async convertbonds(ctx: CommandContext): Promise<void> {
    // Get user ID from platform
    const lookupResult = await apiClient.getUserByPlatform(
      ctx.message.platform as 'kick' | 'twitch' | 'discord',
      ctx.message.userId
    )

    if (!lookupResult.success || !lookupResult.data) {
      await ctx.reply('You need to play first to create an account!')
      return
    }

    const userId = lookupResult.data.userId
    const response = await apiClient.convertCreditsToBonds(userId)

    if (!response.success || !response.data) {
      const errorMsg = (response as { error?: string }).error || 'Conversion failed'
      await ctx.reply(`❌ ${errorMsg}`)
      return
    }

    const result = response.data
    await ctx.reply(
      `💎 ${result.message} New balance: ${result.newBalance} bonds`
    )
  },

  /**
   * !bondshop - View items purchasable with bonds
   * Usage: !bondshop
   */
  async bondshop(ctx: CommandContext): Promise<void> {
    // Get user ID from platform
    const lookupResult = await apiClient.getUserByPlatform(
      ctx.message.platform as 'kick' | 'twitch' | 'discord',
      ctx.message.userId
    )

    if (!lookupResult.success || !lookupResult.data) {
      await ctx.reply('You need to play first to create an account!')
      return
    }

    const userId = lookupResult.data.userId
    const response = await apiClient.getBondPurchaseOptions(userId)

    if (!response.success || !response.data) {
      await ctx.reply('Could not fetch bond shop. Try again later.')
      return
    }

    const data = response.data
    const cosmeticList = data.cosmetics
      .map(c => `${c.type.replace('_', ' ')}: ${c.cost}`)
      .join(' | ')

    await ctx.reply(
      `💎 You have ${data.currentBonds} bonds | ${cosmeticList} | Season Pass: ${data.seasonPass.cost} (${data.seasonPass.durationDays}d)`
    )
  },

  /**
   * !buybond - Purchase a cosmetic or season pass with bonds
   * Usage: !buybond <type> [custom_name]
   * Types: title, frame, color, badge, pass
   */
  async buybond(ctx: CommandContext): Promise<void> {
    const typeArg = ctx.args[0]?.toLowerCase()
    const customName = ctx.args.slice(1).join(' ') || undefined

    if (!typeArg) {
      await ctx.reply('Usage: !buybond <title|frame|color|badge|pass> [custom_name]')
      return
    }

    // Map short names to API types
    const typeMap: Record<string, { type: 'cosmetic' | 'season_pass'; cosmetic?: string }> = {
      title: { type: 'cosmetic', cosmetic: 'CUSTOM_TITLE' },
      frame: { type: 'cosmetic', cosmetic: 'PROFILE_FRAME' },
      color: { type: 'cosmetic', cosmetic: 'NAME_COLOR' },
      badge: { type: 'cosmetic', cosmetic: 'CHAT_BADGE' },
      pass: { type: 'season_pass' },
      seasonpass: { type: 'season_pass' },
    }

    const purchaseType = typeMap[typeArg]
    if (!purchaseType) {
      await ctx.reply('Invalid type. Use: title, frame, color, badge, or pass')
      return
    }

    // Get user ID from platform
    const lookupResult = await apiClient.getUserByPlatform(
      ctx.message.platform as 'kick' | 'twitch' | 'discord',
      ctx.message.userId
    )

    if (!lookupResult.success || !lookupResult.data) {
      await ctx.reply('You need to play first to create an account!')
      return
    }

    const userId = lookupResult.data.userId
    const response = await apiClient.purchaseWithBonds(
      userId,
      purchaseType.type,
      purchaseType.cosmetic,
      customName
    )

    if (!response.success || !response.data) {
      const errorMsg = (response as { error?: string }).error || 'Purchase failed'
      await ctx.reply(`❌ ${errorMsg}`)
      return
    }

    const result = response.data
    await ctx.reply(`💎 ${result.message} Remaining bonds: ${result.remainingBonds}`)
  },

  /**
   * !bondhistory - View your recent bond transactions
   * Usage: !bondhistory
   */
  async bondhistory(ctx: CommandContext): Promise<void> {
    // Get user ID from platform
    const lookupResult = await apiClient.getUserByPlatform(
      ctx.message.platform as 'kick' | 'twitch' | 'discord',
      ctx.message.userId
    )

    if (!lookupResult.success || !lookupResult.data) {
      await ctx.reply('You need to play first to create an account!')
      return
    }

    const userId = lookupResult.data.userId
    const response = await apiClient.getBondHistory(userId, 5)

    if (!response.success || !response.data) {
      await ctx.reply('Could not fetch bond history. Try again later.')
      return
    }

    const data = response.data

    if (data.transactions.length === 0) {
      await ctx.reply(`💎 You have ${data.currentBonds} bonds. No transactions yet.`)
      return
    }

    const recentTx = data.transactions
      .slice(0, 3)
      .map(t => `${t.isCredit ? '+' : ''}${t.amount} (${t.type})`)
      .join(' | ')

    await ctx.reply(`💎 Bonds: ${data.currentBonds} | Recent: ${recentTx}`)
  },
}

export default bondsCommands
