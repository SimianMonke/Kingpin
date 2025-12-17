import { apiClient } from '../api-client'
import { formatWealth, formatTimeRemaining } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// SUPPLY DEPOT & BUFF COMMANDS
// =============================================================================

// Buff type display names
const BUFF_DISPLAY_NAMES: Record<string, string> = {
  xp_multiplier: 'XP Boost',
  wealth_gain: 'Wealth Boost',
  crate_drop: 'Crate Drop',
  rob_attack: 'Rob Attack',
  rob_defense: 'Rob Defense',
  business_revenue: 'Business Revenue',
}

// Category display names and emojis
const CATEGORY_INFO: Record<string, { name: string; emoji: string }> = {
  xp: { name: 'XP Boosters', emoji: '⭐' },
  combat: { name: 'Combat Enhancers', emoji: '⚔️' },
  economy: { name: 'Economy Boosters', emoji: '💰' },
  utility: { name: 'Utilities', emoji: '🔧' },
}

/**
 * Format remaining time in human-readable format
 */
function formatBuffTime(minutes: number | null): string {
  if (minutes === null) return 'permanent'
  if (minutes <= 0) return 'expired'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Get buff display name
 */
function getBuffDisplayName(buffType: string): string {
  return BUFF_DISPLAY_NAMES[buffType] || buffType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Format multiplier as percentage bonus
 */
function formatMultiplier(multiplier: number): string {
  const bonus = Math.round((multiplier - 1) * 100)
  return bonus >= 0 ? `+${bonus}%` : `${bonus}%`
}

export const suppliesCommands = {
  /**
   * !buffs - View your active buffs with remaining time
   * Usage: !buffs
   */
  async buffs(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const userId = profileResponse.data.id
    const response = await apiClient.getUserBuffs(userId)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load buffs`)
      return
    }

    const { buffs, expiringBuffs, totalActive } = response.data

    if (totalActive === 0) {
      await ctx.reply(`🔥 No active buffs. Use !supplies to browse boosters!`)
      return
    }

    // Format active buffs
    const buffLines = buffs
      .slice(0, 5) // Limit display to 5 buffs
      .map((b) => {
        const name = getBuffDisplayName(b.buffType)
        const bonus = formatMultiplier(b.multiplier)
        const time = formatBuffTime(b.remainingMinutes)
        return `${name} ${bonus} (${time})`
      })

    let message = `🔥 Active Buffs (${totalActive}): ${buffLines.join(' | ')}`

    // Add expiring warning if applicable
    if (expiringBuffs.length > 0) {
      const expiringNames = expiringBuffs
        .slice(0, 2)
        .map((b) => getBuffDisplayName(b.buffType))
        .join(', ')
      message += ` ⚠️ Expiring soon: ${expiringNames}`
    }

    await ctx.reply(message)
  },

  /**
   * !supplies [category] - View purchasable consumables
   * Usage: !supplies, !supplies xp, !supplies combat
   */
  async supplies(ctx: CommandContext): Promise<void> {
    const category = ctx.args[0]?.toLowerCase()

    const response = await apiClient.getSupplyCatalog()

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load Supply Depot`)
      return
    }

    const { consumables } = response.data

    if (consumables.length === 0) {
      await ctx.reply(`📦 Supply Depot is empty. Check back soon!`)
      return
    }

    // Filter by category if specified
    let filtered = consumables
    if (category) {
      filtered = consumables.filter((c) => c.category.toLowerCase() === category)
      if (filtered.length === 0) {
        const validCategories = [...new Set(consumables.map((c) => c.category.toLowerCase()))]
        await ctx.reply(`Unknown category "${category}". Available: ${validCategories.join(', ')}`)
        return
      }
    }

    // Group by category for display
    if (!category) {
      // Show summary of all categories
      const categories = [...new Set(consumables.map((c) => c.category))]
      const categoryInfo = categories.map((cat) => {
        const items = consumables.filter((c) => c.category === cat)
        const info = CATEGORY_INFO[cat] || { name: cat, emoji: '📦' }
        return `${info.emoji} ${info.name} (${items.length})`
      })

      await ctx.reply(`📦 Supply Depot: ${categoryInfo.join(' | ')} | Use !supplies <category> to browse`)
      return
    }

    // Show items in category
    const catInfo = CATEGORY_INFO[category] || { name: category, emoji: '📦' }
    const itemList = filtered.slice(0, 4).map((c) => {
      const bonus = c.buffValue ? formatMultiplier(c.buffValue) : ''
      return `${c.name}${bonus ? ` (${bonus})` : ''} - ${formatWealth(c.cost)}`
    })

    const moreCount = filtered.length - 4
    const moreStr = moreCount > 0 ? ` (+${moreCount} more)` : ''

    await ctx.reply(`${catInfo.emoji} ${catInfo.name}: ${itemList.join(' | ')}${moreStr} | !buysupply <id>`)
  },

  /**
   * !buysupply <id> - Purchase a consumable
   * Usage: !buysupply xp_25
   */
  async buysupply(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const consumableId = ctx.args[0]?.toLowerCase()
    if (!consumableId) {
      await ctx.reply(`Usage: !buysupply <item_id> (e.g., !buysupply xp_25)`)
      return
    }

    const response = await apiClient.purchaseConsumable(profileResponse.data.id, consumableId)

    if (!response.success || !response.data?.success) {
      const reason = response.data?.reason || response.error || 'Purchase failed'
      await ctx.reply(`❌ ${reason}`)
      return
    }

    const { consumableName, pricePaid, newWealth, buffApplied, wasExtension, wasUpgrade, wasDowngrade, quantityNow } = response.data

    let message = `✅ Purchased ${consumableName} for ${formatWealth(pricePaid || 0)}`

    if (buffApplied) {
      if (wasUpgrade) {
        message += ' (UPGRADED existing buff!)'
      } else if (wasExtension) {
        message += ' (Extended existing buff!)'
      } else if (wasDowngrade) {
        message += ' (Already have better buff active)'
      } else {
        message += ' (Buff activated!)'
      }
    } else if (quantityNow !== undefined) {
      message += ` (Now own: ${quantityNow})`
    }

    if (newWealth !== undefined) {
      message += ` | Balance: ${formatWealth(Number(newWealth))}`
    }

    await ctx.reply(message)
  },

  /**
   * !myitems - View your single-use consumable inventory
   * Usage: !myitems
   */
  async myitems(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.getUserSupplyInventory(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load inventory`)
      return
    }

    const { inventory } = response.data

    if (!inventory || inventory.length === 0) {
      await ctx.reply(`🎒 No consumable items. Buy some from the Supply Depot with !supplies`)
      return
    }

    const itemList = inventory.slice(0, 5).map((item) => {
      const maxStr = item.maxOwned ? `/${item.maxOwned}` : ''
      return `${item.name} (${item.quantity}${maxStr})`
    })

    const moreCount = inventory.length - 5
    const moreStr = moreCount > 0 ? ` (+${moreCount} more)` : ''

    await ctx.reply(`🎒 Consumables: ${itemList.join(' | ')}${moreStr}`)
  },
}

export default suppliesCommands
