import { apiClient } from '../api-client'
import { formatWealth, formatLeaderboardEntry } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// LEADERBOARD COMMANDS
// =============================================================================

const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'annual', 'lifetime']
const VALID_METRICS = ['wealth', 'xp', 'plays', 'robs', 'donations', 'chatters']

export const leaderboardCommands = {
  /**
   * !lb - View leaderboard
   * Usage: !lb [period] [metric]
   * Examples: !lb daily, !lb weekly wealth, !lb donations
   */
  async leaderboard(ctx: CommandContext): Promise<void> {
    let period = 'daily'
    let metric = 'wealth'

    // Parse arguments
    for (const arg of ctx.args) {
      const lowerArg = arg.toLowerCase()
      if (VALID_PERIODS.includes(lowerArg)) {
        period = lowerArg
      } else if (VALID_METRICS.includes(lowerArg)) {
        metric = lowerArg
      }
    }

    const response = await apiClient.getLeaderboard(metric, period, 5)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load leaderboard`)
      return
    }

    const { entries } = response.data

    if (entries.length === 0) {
      await ctx.reply(`No leaderboard data for ${period} ${metric}`)
      return
    }

    // Format leaderboard
    const title = `🏆 ${capitalize(period)} ${capitalize(metric)} Leaderboard:`
    const lines = entries.slice(0, 5).map((entry) => {
      const value = metric === 'wealth' || metric === 'donations'
        ? formatWealth(entry.value)
        : entry.value.toLocaleString()
      return formatLeaderboardEntry(entry.rank, entry.displayName || entry.username, value)
    })

    await ctx.reply(`${title} ${lines.join(' | ')}`)
  },

  /**
   * !rank - View your rank across periods
   * Usage: !rank [metric]
   */
  async rank(ctx: CommandContext): Promise<void> {
    const metric = ctx.args[0]?.toLowerCase() || 'wealth'

    // Need to get user ID first
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.getUserRank(profileResponse.data.id, metric)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load your rank`)
      return
    }

    const { ranks } = response.data
    const displayName = profileResponse.data.kingpinName || profileResponse.data.username

    const rankParts = Object.entries(ranks)
      .filter(([_, rank]) => rank > 0)
      .map(([period, rank]) => `${capitalize(period)}: #${rank}`)

    if (rankParts.length === 0) {
      await ctx.reply(`${displayName} is not ranked yet for ${metric}`)
      return
    }

    await ctx.reply(`📊 ${displayName}'s ${capitalize(metric)} Ranks: ${rankParts.join(' | ')}`)
  },
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default leaderboardCommands
