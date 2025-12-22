import { apiClient } from '../api-client'
import { formatWealth } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// JUICERNAUT COMMANDS
// =============================================================================

export const juicernautCommands = {
  /**
   * !juice - View current Juicernaut session standings
   * Also triggers Lumia Stream leaderboard effect
   */
  async juice(ctx: CommandContext): Promise<void> {
    // Pass announce=true to trigger Lumia effect when posting to chat
    const response = await apiClient.getJuicernautSession(true)

    if (!response.success || !response.data) {
      await ctx.reply(`No active Juicernaut session`)
      return
    }

    const session = response.data

    if (!session || !session.isActive) {
      await ctx.reply(`No active Juicernaut session`)
      return
    }

    // Format leaderboard
    const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

    const leaderboardLines = session.leaderboard.slice(0, 5).map((entry) => {
      const crown = entry.isJuicernaut ? '👑 ' : ''
      const rankStr = rankEmojis[entry.rank] || `${entry.rank}.`
      return `${crown}${rankStr} ${entry.username} - $${entry.totalUsd.toFixed(2)}`
    })

    const currentHolder = session.currentJuicernaut
      ? `Current: ${session.currentJuicernaut.username} ($${session.currentJuicernaut.totalUsd.toFixed(2)})`
      : 'No crown holder yet'

    await ctx.reply(
      `👑 JUICERNAUT | ${currentHolder} | Top 5: ${leaderboardLines.join(' | ')}`
    )
  },

  /**
   * !juicehall - View all-time Juicernaut hall of fame
   */
  async juiceHall(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getJuicernautHallOfFame()

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load Juicernaut Hall of Fame`)
      return
    }

    const { hallOfFame } = response.data

    if (hallOfFame.length === 0) {
      await ctx.reply(`No Juicernaut winners yet!`)
      return
    }

    const lines = hallOfFame.slice(0, 5).map((entry) => {
      const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
      const rankStr = rankEmojis[entry.rank] || `${entry.rank}.`
      return `${rankStr} ${entry.username} - ${entry.wins} wins ($${entry.totalContributed.toFixed(2)} total)`
    })

    await ctx.reply(`🏆 Juicernaut Hall of Fame: ${lines.join(' | ')}`)
  },
}

export default juicernautCommands
