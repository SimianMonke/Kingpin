import { apiClient } from '../api-client'
import { formatWealth } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// TOKEN COMMANDS (Phase 3 - Play Gating Currency)
// =============================================================================

export const tokensCommands = {
  /**
   * !tokens - View your token balance and status
   * Usage: !tokens
   */
  async tokens(ctx: CommandContext): Promise<void> {
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
    const response = await apiClient.getTokenStatus(userId)

    if (!response.success || !response.data) {
      await ctx.reply('Could not fetch token status. Try again later.')
      return
    }

    const status = response.data
    const capStatus = status.atHardCap
      ? '(AT CAP)'
      : status.aboveSoftCap
        ? '(above soft cap - decay active)'
        : ''

    await ctx.reply(
      `🪙 Tokens: ${status.tokens}/${status.hardCap} ${capStatus} | Next purchase: ${formatWealth(status.nextConversionCost)} | Today: ${status.tokensEarnedToday}/50`
    )
  },

  /**
   * !buytoken - Convert credits to tokens
   * Usage: !buytoken
   * Cost scales with daily purchases: $1,000 * 1.15^(purchases today)
   */
  async buytoken(ctx: CommandContext): Promise<void> {
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
    const response = await apiClient.convertCreditsToTokens(userId)

    if (!response.success || !response.data) {
      const errorMsg = (response as { error?: string }).error || 'Purchase failed'
      await ctx.reply(`❌ ${errorMsg}`)
      return
    }

    const result = response.data
    await ctx.reply(
      `🪙 ${result.message} | Balance: ${result.newBalance} tokens`
    )
  },

  /**
   * !tokenboost - Info about using tokens for play bonus
   * Usage: !tokenboost
   */
  async tokenboost(ctx: CommandContext): Promise<void> {
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
    const response = await apiClient.getTokenStatus(userId)

    if (!response.success || !response.data) {
      await ctx.reply('Could not fetch token status. Try again later.')
      return
    }

    const status = response.data

    if (status.tokens < 1) {
      await ctx.reply(
        `🪙 You have 0 tokens. Use !buytoken to purchase (costs ${formatWealth(status.nextConversionCost)})`
      )
      return
    }

    await ctx.reply(
      `🪙 You have ${status.tokens} tokens. Redeem channel points with token boost enabled for +25% wealth/XP! (1 token per play)`
    )
  },
}

export default tokensCommands
