import { apiClient } from '../api-client'
import { formatTimeRemaining, formatProgressBar } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// MISSION & ACHIEVEMENT COMMANDS
// =============================================================================

export const missionCommands = {
  /**
   * !missions - View your active missions
   * Usage: !missions, !missions daily, !missions weekly
   */
  async missions(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.getMissions(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load missions`)
      return
    }

    const { daily, weekly, dailyExpiresAt, weeklyExpiresAt } = response.data
    const filter = ctx.args[0]?.toLowerCase()

    // Calculate time remaining
    const dailyTimeLeft = new Date(dailyExpiresAt).getTime() - Date.now()
    const weeklyTimeLeft = new Date(weeklyExpiresAt).getTime() - Date.now()

    // Format missions
    const formatMission = (m: { name: string; progress: number; target: number; isComplete: boolean }) => {
      const status = m.isComplete ? '✅' : '○'
      return `${status} ${m.name} (${m.progress}/${m.target})`
    }

    if (filter === 'daily' || !filter) {
      const dailyStr = daily.length > 0
        ? daily.map(formatMission).join(' | ')
        : 'No daily missions'
      const timeStr = dailyTimeLeft > 0 ? formatTimeRemaining(dailyTimeLeft) : 'Expired'

      if (filter === 'daily') {
        await ctx.reply(`📅 Daily Missions (${timeStr}): ${dailyStr}`)
        return
      }
    }

    if (filter === 'weekly' || !filter) {
      const weeklyStr = weekly.length > 0
        ? weekly.map(formatMission).join(' | ')
        : 'No weekly missions'
      const timeStr = weeklyTimeLeft > 0 ? formatTimeRemaining(weeklyTimeLeft) : 'Expired'

      if (filter === 'weekly') {
        await ctx.reply(`📆 Weekly Missions (${timeStr}): ${weeklyStr}`)
        return
      }
    }

    // Show both if no filter
    const dailyComplete = daily.filter((m) => m.isComplete).length
    const weeklyComplete = weekly.filter((m) => m.isComplete).length

    await ctx.reply(
      `📋 Missions | Daily: ${dailyComplete}/${daily.length} (${formatTimeRemaining(dailyTimeLeft)}) | ` +
      `Weekly: ${weeklyComplete}/${weekly.length} (${formatTimeRemaining(weeklyTimeLeft)})`
    )
  },

  /**
   * !achievements - View your achievement progress
   * Usage: !achievements, !achievements @user
   */
  async achievements(ctx: CommandContext): Promise<void> {
    const targetUsername = ctx.args[0]?.replace('@', '') || ctx.message.username

    const profileResponse = await apiClient.getProfileByUsername(targetUsername)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find player "${targetUsername}"`)
      return
    }

    const response = await apiClient.getAchievements(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load achievements`)
      return
    }

    const { categories, stats } = response.data
    const displayName = profileResponse.data.kingpinName || profileResponse.data.username

    // Count by tier
    const tierCounts: Record<string, { total: number; complete: number }> = {}

    for (const [_, achievements] of Object.entries(categories)) {
      for (const ach of achievements) {
        if (!tierCounts[ach.tier]) {
          tierCounts[ach.tier] = { total: 0, complete: 0 }
        }
        tierCounts[ach.tier].total++
        if (ach.isComplete) {
          tierCounts[ach.tier].complete++
        }
      }
    }

    const tierStr = Object.entries(tierCounts)
      .map(([tier, counts]) => `${tier}: ${counts.complete}/${counts.total}`)
      .join(' | ')

    const progress = Math.round((stats.completed / stats.total) * 100)

    await ctx.reply(
      `🏆 ${displayName}'s Achievements: ${stats.completed}/${stats.total} (${progress}%) | ${tierStr}`
    )
  },
}

export default missionCommands
