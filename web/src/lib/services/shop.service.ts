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

// =============================================================================
// SHOP SERVICE TYPES
// =============================================================================

export interface ShopItem {
  shopItemId: number
  itemId: number
  itemName: string
  itemType: string
  tier: string
  price: number
  originalPrice: number
  isPurchased: boolean
  // Item stats
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
  description: string | null
  flavorText: string | null
}

export interface ShopInventory {
  items: ShopItem[]
  generatedAt: Date | null
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
  async getShopInventory(userId: number): Promise<ShopInventory> {
    // Get user's tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { statusTier: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const playerTier = user.statusTier as Tier
    const accessibleTiers = PLAYER_SHOP_CONFIG.TIER_ACCESS[playerTier] as ItemTier[]

    // Get current shop items
    const shopItems = await prisma.playerShopInventory.findMany({
      where: {
        userId,
        isPurchased: false,
      },
      include: {
        item: true,
      },
      orderBy: { generatedAt: 'desc' },
    })

    // If no shop exists or empty, generate one
    if (shopItems.length === 0) {
      await this.generateShop(userId)
      return this.getShopInventory(userId) // Recursive call to get fresh shop
    }

    const generatedAt = shopItems[0]?.generatedAt ?? null

    return {
      items: shopItems.map((si) => ({
        shopItemId: si.id,
        itemId: si.item.id,
        itemName: si.item.itemName,
        itemType: si.item.itemType,
        tier: si.item.tier,
        price: si.price,
        originalPrice: si.item.purchasePrice,
        isPurchased: si.isPurchased,
        robBonus: si.item.robBonus ? Number(si.item.robBonus) : null,
        defenseBonus: si.item.defenseBonus ? Number(si.item.defenseBonus) : null,
        revenueMin: si.item.revenueMin,
        revenueMax: si.item.revenueMax,
        insurancePercent: si.item.insurancePercent ? Number(si.item.insurancePercent) : null,
        description: si.item.description,
        flavorText: si.item.flavorText,
      })),
      generatedAt,
      playerTier,
      accessibleTiers,
    }
  },

  /**
   * Generate new shop inventory for a player
   */
  async generateShop(userId: number): Promise<void> {
    // Get user's tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { statusTier: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const playerTier = user.statusTier as Tier
    const accessibleTiers = PLAYER_SHOP_CONFIG.TIER_ACCESS[playerTier] as ItemTier[]

    // Determine number of items
    const itemCount = randomInt(
      PLAYER_SHOP_CONFIG.ITEMS_COUNT.min,
      PLAYER_SHOP_CONFIG.ITEMS_COUNT.max
    )

    // Get available items for player's tier (excluding legendary - Black Market only)
    const availableItems = await prisma.item.findMany({
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
    await prisma.playerShopInventory.deleteMany({
      where: { userId },
    })

    // Create new shop inventory
    const now = new Date()
    await prisma.playerShopInventory.createMany({
      data: selectedItems.map((item) => ({
        userId,
        itemId: item.id,
        price: item.purchasePrice, // Standard price
        generatedAt: now,
        isPurchased: false,
      })),
    })
  },

  /**
   * Reroll/refresh player's shop
   */
  async rerollShop(userId: number): Promise<{ success: boolean; itemCount: number }> {
    await this.generateShop(userId)

    const newCount = await prisma.playerShopInventory.count({
      where: { userId, isPurchased: false },
    })

    // Record the reroll event
    await prisma.gameEvent.create({
      data: {
        userId,
        eventType: 'shop_reroll',
        wealthChange: 0,
        xpChange: 0,
        eventDescription: 'Rerolled shop inventory',
        success: true,
      },
    })

    return { success: true, itemCount: newCount }
  },

  /**
   * Purchase item from player's shop
   */
  async purchaseItem(userId: number, shopItemId: number): Promise<PurchaseResult> {
    // Get shop item
    const shopItem = await prisma.playerShopInventory.findFirst({
      where: {
        id: shopItemId,
        userId,
        isPurchased: false,
      },
      include: {
        item: true,
      },
    })

    if (!shopItem) {
      return { success: false, reason: 'Item not found in your shop or already purchased' }
    }

    // Check user's wealth
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    const hasSpace = await InventoryService.hasSpace(userId)
    if (!hasSpace) {
      return { success: false, reason: 'Your inventory is full (10/10)' }
    }

    // Check business ownership limit (Design Drift Remediation)
    if (shopItem.item.itemType === 'business') {
      const businessCheck = await BusinessService.canPurchaseBusiness(userId, MAX_BUSINESSES_OWNED)
      if (!businessCheck.canPurchase) {
        return { success: false, reason: businessCheck.error }
      }
    }

    // Process purchase in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct wealth
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { wealth: { decrement: shopItem.price } },
        select: { wealth: true },
      })

      // Mark shop item as purchased
      await tx.playerShopInventory.update({
        where: { id: shopItemId },
        data: {
          isPurchased: true,
          purchasedAt: new Date(),
        },
      })

      // Add item to inventory
      const inventoryItem = await tx.userInventory.create({
        data: {
          userId,
          itemId: shopItem.itemId,
          durability: shopItem.item.baseDurability,
          isEquipped: false,
        },
      })

      // Record purchase event
      await tx.gameEvent.create({
        data: {
          userId,
          eventType: 'shop_purchase',
          wealthChange: -shopItem.price,
          xpChange: 0,
          eventDescription: `Purchased ${shopItem.item.itemName} for $${shopItem.price.toLocaleString()}`,
          success: true,
        },
      })

      return { newWealth: updatedUser.wealth, inventoryId: inventoryItem.id }
    })

    return {
      success: true,
      itemName: shopItem.item.itemName,
      pricePaid: shopItem.price,
      newWealth: result.newWealth,
      inventoryId: result.inventoryId,
    }
  },

  /**
   * Get item by name from player's shop
   */
  async findShopItemByName(userId: number, itemName: string): Promise<ShopItem | null> {
    const shopItem = await prisma.playerShopInventory.findFirst({
      where: {
        userId,
        isPurchased: false,
        item: {
          itemName: { equals: itemName, mode: 'insensitive' },
        },
      },
      include: {
        item: true,
      },
    })

    if (!shopItem) return null

    return {
      shopItemId: shopItem.id,
      itemId: shopItem.item.id,
      itemName: shopItem.item.itemName,
      itemType: shopItem.item.itemType,
      tier: shopItem.item.tier,
      price: shopItem.price,
      originalPrice: shopItem.item.purchasePrice,
      isPurchased: shopItem.isPurchased,
      robBonus: shopItem.item.robBonus ? Number(shopItem.item.robBonus) : null,
      defenseBonus: shopItem.item.defenseBonus ? Number(shopItem.item.defenseBonus) : null,
      revenueMin: shopItem.item.revenueMin,
      revenueMax: shopItem.item.revenueMax,
      insurancePercent: shopItem.item.insurancePercent ? Number(shopItem.item.insurancePercent) : null,
      description: shopItem.item.description,
      flavorText: shopItem.item.flavorText,
    }
  },

  /**
   * Check if user's shop needs generation (for auto-gen on first visit)
   */
  async hasShop(userId: number): Promise<boolean> {
    const count = await prisma.playerShopInventory.count({
      where: { userId, isPurchased: false },
    })
    return count > 0
  },

  /**
   * Get shop statistics for display
   */
  async getShopStats(userId: number) {
    const [totalPurchases, totalSpent] = await Promise.all([
      prisma.playerShopInventory.count({
        where: { userId, isPurchased: true },
      }),
      prisma.gameEvent.aggregate({
        where: { userId, eventType: 'shop_purchase' },
        _sum: { wealthChange: true },
      }),
    ])

    return {
      totalPurchases,
      totalSpent: totalSpent._sum.wealthChange
        ? Math.abs(Number(totalSpent._sum.wealthChange))
        : 0,
    }
  },
}

export default ShopService
