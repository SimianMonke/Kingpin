import { prisma } from '../db'
import {
  PLAYER_SHOP_CONFIG,
  ITEM_TIERS,
  MAX_BUSINESSES_OWNED,
  type Tier,
  type ItemTier,
} from '../game'
import { randomInt } from '../game/formulas'
import { InventoryService } from './inventory.service'
import { BusinessService } from './business.service'
import { ConsumableService } from './consumable.service'

// =============================================================================
// SHOP SERVICE TYPES
// =============================================================================

export interface ShopItem {
  shopItemId: number
  item_id: number
  itemName: string
  type: string
  tier: string
  price: number
  original_price: number | null
  is_purchased: boolean | null
  // Item stats
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
  description: string | null
  flavor_text: string | null
}

export interface ShopInventory {
  items: ShopItem[]
  generated_at: Date | null
  playerTier: string
  accessibleTiers: string[]
}

export interface PurchaseResult {
  success: boolean
  reason?: string
  itemName?: string
  pricePaid?: number
  newWealth?: bigint
  inventoryId?: number
}

// =============================================================================
// SHOP SERVICE
// =============================================================================

export const ShopService = {
  /**
   * Get player's shop inventory
   */
  async getShopInventory(user_id: number): Promise<ShopInventory> {
    // Get user's tier
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { status_tier: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const playerTier = user.status_tier as Tier
    const accessibleTiers = PLAYER_SHOP_CONFIG.TIER_ACCESS[playerTier] as ItemTier[]

    // Get current shop items
    const shopItems = await prisma.player_shop_inventory.findMany({
      where: {
        user_id,
        is_purchased: false,
      },
      include: {
        items: true,
      },
      orderBy: { generated_at: 'desc' },
    })

    // If no shop exists or empty, generate one
    if (shopItems.length === 0) {
      await this.generateShop(user_id)
      return this.getShopInventory(user_id) // Recursive call to get fresh shop
    }

    const generated_at = shopItems[0]?.generated_at ?? null

    return {
      items: shopItems.map((si) => ({
        shopItemId: si.id,
        item_id: si.items.id,
        itemName: si.items.name,
        type: si.items.type,
        tier: si.items.tier,
        price: si.price,
        original_price: si.items.purchase_price,
        is_purchased: si.is_purchased,
        rob_bonus: si.items.rob_bonus ? Number(si.items.rob_bonus) : null,
        defense_bonus: si.items.defense_bonus ? Number(si.items.defense_bonus) : null,
        revenue_min: si.items.revenue_min,
        revenue_max: si.items.revenue_max,
        insurance_percent: si.items.insurance_percent ? Number(si.items.insurance_percent) : null,
        description: si.items.description,
        flavor_text: si.items.flavor_text,
      })),
      generated_at,
      playerTier,
      accessibleTiers,
    }
  },

  /**
   * Generate new shop inventory for a player
   */
  async generateShop(user_id: number): Promise<void> {
    // Get user's tier
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { status_tier: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const playerTier = user.status_tier as Tier
    const accessibleTiers = PLAYER_SHOP_CONFIG.TIER_ACCESS[playerTier] as ItemTier[]

    // Determine number of items
    const itemCount = randomInt(
      PLAYER_SHOP_CONFIG.ITEMS_COUNT.min,
      PLAYER_SHOP_CONFIG.ITEMS_COUNT.max
    )

    // Get available items for player's tier (excluding legendary - Black Market only)
    const availableItems = await prisma.items.findMany({
      where: {
        tier: { in: accessibleTiers.filter(t => t !== ITEM_TIERS.LEGENDARY) },
      },
    })

    if (availableItems.length === 0) {
      return // No items available
    }

    // Shuffle and pick random items
    const shuffled = availableItems.sort(() => Math.random() - 0.5)
    const selectedItems = shuffled.slice(0, Math.min(itemCount, shuffled.length))

    // Delete old shop inventory
    await prisma.player_shop_inventory.deleteMany({
      where: { user_id },
    })

    // Create new shop inventory
    const now = new Date()
    await prisma.player_shop_inventory.createMany({
      data: selectedItems.map((item) => ({
        user_id,
        item_id: item.id,
        price: item.purchase_price, // Standard price
        generated_at: now,
        is_purchased: false,
      })),
    })
  },

  /**
   * Reroll/refresh player's shop
   * If user has a reroll_token consumable, uses it for a free reroll
   */
  async rerollShop(user_id: number): Promise<{ success: boolean; itemCount: number; usedRerollToken?: boolean }> {
    // Check for reroll_token consumable (provides free reroll)
    const hasRerollToken = await ConsumableService.hasConsumable(user_id, 'reroll_token')
    let usedRerollToken = false

    if (hasRerollToken) {
      await ConsumableService.useConsumable(user_id, 'reroll_token')
      usedRerollToken = true
    }
    // Note: When reroll costs are implemented, skip cost deduction if usedRerollToken

    await this.generateShop(user_id)

    const newCount = await prisma.player_shop_inventory.count({
      where: { user_id, is_purchased: false },
    })

    // Record the reroll event
    await prisma.game_events.create({
      data: {
        user_id,
        event_type: 'shop_reroll',
        wealth_change: 0,
        xp_change: 0,
        event_description: usedRerollToken
          ? 'Rerolled shop inventory (used Reroll Token)'
          : 'Rerolled shop inventory',
        success: true,
      },
    })

    return { success: true, itemCount: newCount, usedRerollToken }
  },

  /**
   * Purchase item from player's shop
   */
  async purchaseItem(user_id: number, shopItemId: number): Promise<PurchaseResult> {
    // Get shop item
    const shopItem = await prisma.player_shop_inventory.findFirst({
      where: {
        id: shopItemId,
        user_id,
        is_purchased: false,
      },
      include: {
        items: true,
      },
    })

    if (!shopItem) {
      return { success: false, reason: 'Item not found in your shop or already purchased' }
    }

    // Check user's wealth
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { wealth: true },
    })

    if (!user) {
      return { success: false, reason: 'User not found' }
    }

    if (Number(user.wealth) < shopItem.price) {
      return {
        success: false,
        reason: `Not enough wealth. You need $${shopItem.price.toLocaleString()} but have $${Number(user.wealth).toLocaleString()}`,
      }
    }

    // Check inventory space
    const hasSpace = await InventoryService.hasSpace(user_id)
    if (!hasSpace) {
      return { success: false, reason: 'Your inventory is full (10/10)' }
    }

    // Check business ownership limit (Design Drift Remediation)
    if (shopItem.items.type === 'business') {
      const businessCheck = await BusinessService.canPurchaseBusiness(user_id, MAX_BUSINESSES_OWNED)
      if (!businessCheck.canPurchase) {
        return { success: false, reason: businessCheck.error }
      }
    }

    // Process purchase in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct wealth
      const updatedUser = await tx.users.update({
        where: { id: user_id },
        data: { wealth: { decrement: shopItem.price } },
        select: { wealth: true },
      })

      // Mark shop item as purchased
      await tx.player_shop_inventory.update({
        where: { id: shopItemId },
        data: {
          is_purchased: true,
          purchased_at: new Date(),
        },
      })

      // Add item to inventory
      const inventoryItem = await tx.user_inventory.create({
        data: {
          user_id,
          item_id: shopItem.item_id,
          durability: shopItem.items.base_durability ?? 100,
          is_equipped: false,
        },
      })

      // Record purchase event
      await tx.game_events.create({
        data: {
          user_id,
          event_type: 'shop_purchase',
          wealth_change: -shopItem.price,
          xp_change: 0,
          event_description: `Purchased ${shopItem.items.name} for $${shopItem.price.toLocaleString()}`,
          success: true,
        },
      })

      return { newWealth: updatedUser.wealth, inventoryId: inventoryItem.id }
    })

    return {
      success: true,
      itemName: shopItem.items.name,
      pricePaid: shopItem.price,
      newWealth: result.newWealth ?? BigInt(0),
      inventoryId: result.inventoryId,
    }
  },

  /**
   * Get item by name from player's shop
   */
  async findShopItemByName(user_id: number, itemName: string): Promise<ShopItem | null> {
    const shopItem = await prisma.player_shop_inventory.findFirst({
      where: {
        user_id,
        is_purchased: false,
        items: {
          name: { equals: itemName, mode: 'insensitive' },
        },
      },
      include: {
        items: true,
      },
    })

    if (!shopItem) return null

    return {
      shopItemId: shopItem.id,
      item_id: shopItem.items.id,
      itemName: shopItem.items.name,
      type: shopItem.items.type,
      tier: shopItem.items.tier,
      price: shopItem.price,
      original_price: shopItem.items.purchase_price,
      is_purchased: shopItem.is_purchased,
      rob_bonus: shopItem.items.rob_bonus ? Number(shopItem.items.rob_bonus) : null,
      defense_bonus: shopItem.items.defense_bonus ? Number(shopItem.items.defense_bonus) : null,
      revenue_min: shopItem.items.revenue_min,
      revenue_max: shopItem.items.revenue_max,
      insurance_percent: shopItem.items.insurance_percent ? Number(shopItem.items.insurance_percent) : null,
      description: shopItem.items.description,
      flavor_text: shopItem.items.flavor_text,
    }
  },

  /**
   * Check if user's shop needs generation (for auto-gen on first visit)
   */
  async hasShop(user_id: number): Promise<boolean> {
    const count = await prisma.player_shop_inventory.count({
      where: { user_id, is_purchased: false },
    })
    return count > 0
  },

  /**
   * Get shop statistics for display
   */
  async getShopStats(user_id: number) {
    const [totalPurchases, totalSpent] = await Promise.all([
      prisma.player_shop_inventory.count({
        where: { user_id, is_purchased: true },
      }),
      prisma.game_events.aggregate({
        where: { user_id, event_type: 'shop_purchase' },
        _sum: { wealth_change: true },
      }),
    ])

    return {
      totalPurchases,
      totalSpent: totalSpent._sum.wealth_change
        ? Math.abs(Number(totalSpent._sum.wealth_change))
        : 0,
    }
  },
}

export default ShopService
