import { apiClient } from '../api-client'
import type { CommandContext } from '../types'

// =============================================================================
// FACTION COMMANDS
// =============================================================================

export const factionCommands = {
  /**
   * !factions - List all factions
   */
  async listFactions(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getFactions()

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load factions`)
      return
    }

    const { factions } = response.data

    const lines = factions.map((f) =>
      `${f.name} (${f.memberCount} members, ${f.territoriesControlled} territories)`
    )

    await ctx.reply(`⚔️ Factions: ${lines.join(' | ')}`)
  },

  /**
   * !faction - View your faction or join/leave
   * Usage: !faction, !faction join <name>, !faction leave
   */
  async faction(ctx: CommandContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase()

    // Get user profile first
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const userId = profileResponse.data.id

    // Handle join
    if (action === 'join') {
      const factionName = ctx.args.slice(1).join(' ')
      if (!factionName) {
        await ctx.reply(`Usage: !faction join <faction name>`)
        return
      }

      const joinResponse = await apiClient.joinFaction(userId, factionName)

      if (!joinResponse.success || !joinResponse.data?.success) {
        await ctx.reply(`❌ ${joinResponse.data?.error || joinResponse.error || 'Failed to join faction'}`)
        return
      }

      await ctx.reply(`✅ Welcome to ${joinResponse.data.faction?.name}! Assigned to ${joinResponse.data.assignedTerritory}`)
      return
    }

    // Handle leave
    if (action === 'leave') {
      const leaveResponse = await apiClient.leaveFaction(userId)

      if (!leaveResponse.success || !leaveResponse.data?.success) {
        await ctx.reply(`❌ ${leaveResponse.data?.error || leaveResponse.error || 'Failed to leave faction'}`)
        return
      }

      await ctx.reply(`✅ You have left your faction. 7-day cooldown before joining another.`)
      return
    }

    // Default: show user's faction
    const response = await apiClient.getUserFaction(userId)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load faction info`)
      return
    }

    const { faction, userRank } = response.data

    if (!faction) {
      await ctx.reply(`You're not in a faction. Use !faction join <name> to join one (Level 20+ required)`)
      return
    }

    const buffList = faction.buffs.length > 0
      ? faction.buffs.map((b) => `+${b.value}% ${b.type}`).join(', ')
      : 'None'

    const rankStr = userRank
      ? `Rank #${userRank.rank}/${userRank.totalMembers} (${userRank.weeklyScore} pts)`
      : ''

    await ctx.reply(
      `⚔️ ${faction.name} | ${faction.memberCount} members | ` +
      `${faction.territories.length} territories | Buffs: ${buffList} | ${rankStr}`
    )
  },

  /**
   * !territories - View territory control map
   */
  async territories(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getTerritories()

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load territories`)
      return
    }

    const { territories } = response.data

    // Group by controlling faction
    const byFaction: Record<string, string[]> = {}
    let unclaimed: string[] = []

    for (const t of territories) {
      if (t.controllingFaction) {
        const fName = t.controllingFaction.name
        if (!byFaction[fName]) byFaction[fName] = []
        byFaction[fName].push(t.name)
      } else {
        unclaimed.push(t.name)
      }
    }

    const parts: string[] = []
    for (const [faction, terrs] of Object.entries(byFaction)) {
      parts.push(`${faction}: ${terrs.join(', ')}`)
    }
    if (unclaimed.length > 0) {
      parts.push(`Unclaimed: ${unclaimed.join(', ')}`)
    }

    await ctx.reply(`🗺️ Territory Map: ${parts.join(' | ')}`)
  },
}

export default factionCommands
