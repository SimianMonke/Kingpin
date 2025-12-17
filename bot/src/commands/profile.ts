import { apiClient } from '../api-client'
import { formatProfile, formatWealth, formatXp, formatJailStatus, formatBuffSummary } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// PROFILE COMMANDS
// =============================================================================

export const profileCommands = {
  /**
   * !profile - View your or another player's profile
   * Usage: !profile or !profile @username
   */
  async profile(ctx: CommandContext): Promise<void> {
    const targetUsername = ctx.args[0]?.replace('@', '') || ctx.message.username
    const isOwnProfile = targetUsername.toLowerCase() === ctx.message.username.toLowerCase()

    // Try to get profile by username
    const response = await apiClient.getProfileByUsername(targetUsername)

    if (!response.success || !response.data) {
      await ctx.reply(`Could not find player "${targetUsername}"`)
      return
    }

    const profile = response.data

    // Check if jailed
    if (profile.isJailed && profile.jailReleaseAt) {
      const jailMsg = formatJailStatus(profile.kingpinName || profile.username, profile.jailReleaseAt)
      await ctx.reply(jailMsg)
      return
    }

    let message = formatProfile(profile)

    // Add buff summary for own profile
    if (isOwnProfile) {
      const buffResponse = await apiClient.getUserBuffs(profile.id)
      if (buffResponse.success && buffResponse.data && buffResponse.data.totalActive > 0) {
        const buffSummary = formatBuffSummary(buffResponse.data.buffs)
        message += ` | ${buffSummary}`
      }
    }

    await ctx.reply(message)
  },

  /**
   * !balance - View current wealth
   * Usage: !balance or !bal
   */
  async balance(ctx: CommandContext): Promise<void> {
    const targetUsername = ctx.args[0]?.replace('@', '') || ctx.message.username

    const response = await apiClient.getProfileByUsername(targetUsername)

    if (!response.success || !response.data) {
      await ctx.reply(`Could not find player "${targetUsername}"`)
      return
    }

    const profile = response.data
    const displayName = profile.kingpinName || profile.username

    await ctx.reply(`💰 ${displayName}: ${formatWealth(profile.wealth)}`)
  },

  /**
   * !level - View level and XP progress
   * Usage: !level or !lvl
   */
  async level(ctx: CommandContext): Promise<void> {
    const targetUsername = ctx.args[0]?.replace('@', '') || ctx.message.username

    const response = await apiClient.getProfileByUsername(targetUsername)

    if (!response.success || !response.data) {
      await ctx.reply(`Could not find player "${targetUsername}"`)
      return
    }

    const profile = response.data
    const displayName = profile.kingpinName || profile.username
    const progress = Math.round((profile.xp / profile.xpToNextLevel) * 100)

    await ctx.reply(
      `⭐ ${displayName}: Level ${profile.level} (${formatXp(profile.xp)}/${formatXp(profile.xpToNextLevel)} XP - ${progress}%)`
    )
  },
}

export default profileCommands
