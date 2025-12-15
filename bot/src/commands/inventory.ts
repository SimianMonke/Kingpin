import { apiClient } from '../api-client'
import { formatWealth, formatItemTier, formatCrateTier, formatTimeRemaining } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// INVENTORY COMMANDS
// =============================================================================

export const inventoryCommands = {
  /**
   * !inventory - View your inventory and equipped items
   */
  async inventory(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.getInventory(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load inventory`)
      return
    }

    const { items, equipped } = response.data

    // Format equipped items
    const equippedParts: string[] = []
    if (equipped.weapon) {
      equippedParts.push(`⚔️ ${equipped.weapon.name} (${equipped.weapon.durability}%)`)
    }
    if (equipped.armor) {
      equippedParts.push(`🛡️ ${equipped.armor.name} (${equipped.armor.durability}%)`)
    }
    if (equipped.business) {
      equippedParts.push(`🏢 ${equipped.business.name}`)
    }
    if (equipped.housing) {
      equippedParts.push(`🏠 ${equipped.housing.name}`)
    }

    const equippedStr = equippedParts.length > 0
      ? equippedParts.join(' | ')
      : 'None equipped'

    await ctx.reply(`📦 Inventory (${items.length}/10) | Equipped: ${equippedStr}`)
  },

  /**
   * !crates - View your crate inventory
   */
  async crates(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.getCrates(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load crates`)
      return
    }

    const { stats } = response.data

    if (stats.total === 0) {
      await ctx.reply(`📦 You have no crates. Earn them from playing, missions, and events!`)
      return
    }

    const tierCounts = Object.entries(stats.byTier)
      .filter(([_, count]) => count > 0)
      .map(([tier, count]) => `${formatCrateTier(tier)}: ${count}`)

    await ctx.reply(`📦 Crates (${stats.total}/${stats.maxCrates}): ${tierCounts.join(' | ')}`)
  },

  /**
   * !shop - View your personal shop
   */
  async shop(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.getShop(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load shop`)
      return
    }

    const { items, refreshesAt } = response.data

    if (items.length === 0) {
      await ctx.reply(`Your shop is empty. It will refresh soon!`)
      return
    }

    const itemList = items.slice(0, 5).map((item) =>
      `${formatItemTier(item.tier)} ${item.name} (${formatWealth(item.price)})`
    )

    const refreshTime = new Date(refreshesAt).getTime() - Date.now()
    const refreshStr = refreshTime > 0 ? `Refreshes in ${formatTimeRemaining(refreshTime)}` : 'Refreshing...'

    await ctx.reply(`🛒 Shop: ${itemList.join(' | ')} | ${refreshStr}`)
  },

  /**
   * !market - View Black Market
   */
  async market(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getMarket()

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load Black Market`)
      return
    }

    const { items, rotatesAt } = response.data

    if (items.length === 0) {
      await ctx.reply(`Black Market is empty. Check back soon!`)
      return
    }

    // Show featured items first
    const featured = items.filter((i) => i.isFeatured)
    const regular = items.filter((i) => !i.isFeatured).slice(0, 3)

    const featuredStr = featured.length > 0
      ? `⭐ Featured: ${featured.map((i) => `${i.name} (${formatWealth(i.price)})`).join(', ')}`
      : ''

    const regularStr = regular.length > 0
      ? `Items: ${regular.map((i) => `${i.name} (${formatWealth(i.price)}, ${i.stock}/${i.maxStock})`).join(', ')}`
      : ''

    const rotateTime = new Date(rotatesAt).getTime() - Date.now()
    const rotateStr = rotateTime > 0 ? `Rotates in ${formatTimeRemaining(rotateTime)}` : 'Rotating...'

    await ctx.reply(`🏴 Black Market | ${featuredStr} ${regularStr} | ${rotateStr}`)
  },

  /**
   * HIGH-04: !equip <item> - Equip an item from inventory
   * Usage: !equip knife, !equip 1 (by inventory slot)
   */
  async equip(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const userId = profileResponse.data.id
    const itemArg = ctx.args.join(' ')

    if (!itemArg) {
      await ctx.reply(`Usage: !equip <item name> or !equip <slot number>`)
      return
    }

    // Get inventory to find the item
    const invResponse = await apiClient.getInventory(userId)
    if (!invResponse.success || !invResponse.data) {
      await ctx.reply(`Failed to load inventory`)
      return
    }

    // Find item by name or slot number
    const slotNum = parseInt(itemArg, 10)
    let inventoryId: number | undefined

    if (!isNaN(slotNum) && slotNum > 0 && slotNum <= invResponse.data.items.length) {
      inventoryId = invResponse.data.items[slotNum - 1].id
    } else {
      const item = invResponse.data.items.find((i) =>
        i.name.toLowerCase().includes(itemArg.toLowerCase())
      )
      inventoryId = item?.id
    }

    if (!inventoryId) {
      await ctx.reply(`Item "${itemArg}" not found in inventory`)
      return
    }

    const response = await apiClient.equipItem(userId, inventoryId)

    if (!response.success) {
      await ctx.reply(`❌ ${response.error || 'Failed to equip item'}`)
      return
    }

    const msg = response.data?.previousItem
      ? `✅ Equipped ${response.data.item?.name}, unequipped ${response.data.previousItem.name}`
      : `✅ Equipped ${response.data?.item?.name || 'item'}`

    await ctx.reply(msg)
  },

  /**
   * HIGH-04: !unequip <slot> - Unequip an item
   * Usage: !unequip weapon, !unequip armor
   */
  async unequip(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const slot = ctx.args[0]?.toLowerCase()
    const validSlots = ['weapon', 'armor', 'business', 'housing']

    if (!slot || !validSlots.includes(slot)) {
      await ctx.reply(`Usage: !unequip <weapon|armor|business|housing>`)
      return
    }

    const response = await apiClient.unequipItem(profileResponse.data.id, slot)

    if (!response.success) {
      await ctx.reply(`❌ ${response.error || 'Failed to unequip item'}`)
      return
    }

    await ctx.reply(`✅ Unequipped ${response.data?.item?.name || slot}`)
  },

  /**
   * HIGH-04: !open [count] - Open crates
   * Usage: !open, !open 5
   */
  async open(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const response = await apiClient.openCrate(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply(`❌ ${response.error || 'Failed to open crate'}`)
      return
    }

    const { crateTier, dropType, reward } = response.data

    let rewardStr = ''
    if (dropType === 'item' && reward.item) {
      rewardStr = `${formatItemTier(reward.item.tier)} ${reward.item.name}`
    } else if (dropType === 'wealth' && reward.wealth) {
      rewardStr = `${formatWealth(reward.wealth.amount)}`
    } else if (dropType === 'title' && reward.title) {
      rewardStr = reward.title.isDuplicate
        ? `"${reward.title.title}" (duplicate - ${formatWealth(reward.title.duplicateValue || 0)})`
        : `"${reward.title.title}"`
    }

    await ctx.reply(`📦 Opened ${formatCrateTier(crateTier)} crate → ${rewardStr}`)
  },

  /**
   * HIGH-04: !buy <item> - Buy an item from your shop
   * Usage: !buy knife, !buy 1
   */
  async buy(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const userId = profileResponse.data.id
    const itemArg = ctx.args.join(' ')

    if (!itemArg) {
      await ctx.reply(`Usage: !buy <item name> or !buy <slot number>`)
      return
    }

    // Get shop to find the item
    const shopResponse = await apiClient.getShop(userId)
    if (!shopResponse.success || !shopResponse.data) {
      await ctx.reply(`Failed to load shop`)
      return
    }

    // Find item by name or slot number
    const slotNum = parseInt(itemArg, 10)
    let itemId: number | undefined

    if (!isNaN(slotNum) && slotNum > 0 && slotNum <= shopResponse.data.items.length) {
      itemId = shopResponse.data.items[slotNum - 1].id
    } else {
      const item = shopResponse.data.items.find((i) =>
        i.name.toLowerCase().includes(itemArg.toLowerCase())
      )
      itemId = item?.id
    }

    if (!itemId) {
      await ctx.reply(`Item "${itemArg}" not found in shop`)
      return
    }

    const response = await apiClient.buyItem(userId, itemId)

    if (!response.success) {
      await ctx.reply(`❌ ${response.error || 'Failed to buy item'}`)
      return
    }

    await ctx.reply(`✅ Purchased ${formatItemTier(response.data?.item?.tier || '')} ${response.data?.item?.name || 'item'} | New balance: ${formatWealth(response.data?.newWealth || 0)}`)
  },

  /**
   * !titles - View your titles or equip one
   * Usage: !titles, !title <name>, !title none
   */
  async titles(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply(`Could not find your profile`)
      return
    }

    const userId = profileResponse.data.id
    const titleArg = ctx.args.join(' ')

    // If argument provided, try to equip title
    if (titleArg) {
      const titleToEquip = titleArg.toLowerCase() === 'none' ? null : titleArg
      const equipResponse = await apiClient.equipTitle(userId, titleToEquip)

      if (!equipResponse.success) {
        await ctx.reply(`Failed to equip title: ${equipResponse.error}`)
        return
      }

      if (titleToEquip === null) {
        await ctx.reply(`✅ Title removed`)
      } else {
        await ctx.reply(`✅ Now wearing: "${titleToEquip}"`)
      }
      return
    }

    // Default: show titles
    const response = await apiClient.getTitles(userId)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to load titles`)
      return
    }

    const { titles, equipped } = response.data

    if (titles.length === 0) {
      await ctx.reply(`🏷️ You have no titles. Unlock them from achievements and crates!`)
      return
    }

    const equippedStr = equipped ? `Wearing: "${equipped}"` : 'None equipped'
    const titleList = titles.slice(0, 5).join(', ')
    const moreStr = titles.length > 5 ? ` (+${titles.length - 5} more)` : ''

    await ctx.reply(`🏷️ Titles (${titles.length}): ${titleList}${moreStr} | ${equippedStr}`)
  },
}

export default inventoryCommands
