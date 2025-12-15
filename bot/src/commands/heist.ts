import { apiClient } from '../api-client'
import { formatCrateTier } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// HEIST COMMANDS
// =============================================================================

export const heistCommands = {
  /**
   * !grab <phrase> - Quick grab heist answer
   * This is the command users type during Quick Grab heist events
   */
  async grab(ctx: CommandContext): Promise<void> {
    // The full answer includes "!grab PHRASE"
    const answer = `!grab ${ctx.args.join(' ')}`

    // Get user profile
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      // Silently fail for heist - don't spam chat
      return
    }

    const response = await apiClient.submitHeistAnswer(
      profileResponse.data.id,
      answer,
      ctx.message.platform
    )

    if (!response.success) {
      // Silently fail - API error
      return
    }

    const result = response.data
    if (!result) return

    // Only respond if user won
    if (result.winner && result.correct) {
      const responseTime = result.responseTimeMs
        ? `${(result.responseTimeMs / 1000).toFixed(2)}s`
        : ''
      const crateStr = result.crateTier ? formatCrateTier(result.crateTier) : ''

      await ctx.reply(
        `🎉 ${ctx.message.displayName} won the heist! ${crateStr} crate earned ${responseTime ? `in ${responseTime}` : ''}`
      )
    }
    // Don't respond for wrong answers or already won - reduces spam
  },
}

export default heistCommands
