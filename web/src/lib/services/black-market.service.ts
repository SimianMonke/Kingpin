import { prisma } from '../db'
import { BLACK_MARKET_CONFIG, ITEM_TIERS, MAX_BUSINESSES_OWNED, type ItemTier } from '../game'
import { randomInt, formatTimeRemaining } from '../game/formulas'
import { InventoryService } from './inventory.service'
import { BusinessService } from './business.service'

// =============================================================================
// BLACK MARKET SERVICE TYPES
// =============================================================================

export interface BlackMarketItem {
  marketId: number
  itemId: number
  itemName: string
  itemType: string
  tier: string
  price: number
  originalPrice: number
  discountPercent: number
  stockQuantity: number
  originalStock: number
  isFeatured: boolean
  // Item stats
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
  description: string | null
  flavorText: string | null
}

export interface BlackMarketInventory {
  items: BlackMarketItem[]
  rotationId: number
  availableFrom: Date
  availableUntil: Date
  timeRemaining: string
  featuredItem: BlackMarketItem | null
}

export interface MarketPurchaseResult {
  success: boolean
  reason?: string
  itemName?: string
  pricePaid?: number
  newWealth?: bigint
  inventoryId?: number
  stockRemaining?: number
}

// =============================================================================
// BLACK MARKET SERVICE
// =============================================================================

export const BlackMarketService = {
  /**
   * Get current Black Market inventory
   */
  async getMarketInventory(): Promise<BlackMarketInventory | null> {
    const now = new Date()

    // Get current rotation
    const marketItems = await prisma.blackMarketInventory.findMany({
      where: {
        availableFrom: { lte: now },
        availableUntil: { gt: now },
        stockQuantity: { gt: 0 },
      },
      include: {
        item: true,
      },
      orderBy: [
        { isFeatured: 'desc' },
        { item: { tier: 'desc' } },
        { price: 'desc' },
      ],
    })

    if (marketItems.length === 0) {
      // No active rotation - need to generate one
      await this.rotateMarket()
      return this.getMarketInventory() // Recursive call
    }

    const rotationId = marketItems[0].rotationId
    const availableFrom = marketItems[0].availableFrom
    const availableUntil = marketItems[0].availableUntil

    const items: BlackMarketItem[] = marketItems.map((mi) => ({
      marketId: mi.id,
      itemId: mi.item.id,
      itemName: mi.item.itemName,
      itemType: mi.item.itemType,
      tier: mi.item.tier,
      price: mi.price,
      originalPrice: mi.item.purchasePrice,
      discountPercent: mi.discountPercent,
      stockQuantity: mi.stockQuantity,
      originalStock: mi.originalStock,
      isFeatured: mi.isFeatured,
      robBonus: mi.item.robBonus ? Number(mi.item.robBonus) : null,
      defenseBonus: mi.item.defenseBonus ? Number(mi.item.defenseBonus) : null,
      revenueMin: mi.item.revenueMin,
      revenueMax: mi.item.revenueMax,
      insurancePercent: mi.item.insurancePercent ? Number(mi.item.insurancePercent) : null,
      description: mi.item.description,
      flavorText: mi.item.flavorText,
    }))

    const featuredItem = items.find((i) => i.isFeatured) ?? null

    return {
      items,
      rotationId,
      availableFrom,
      availableUntil,
      timeRemaining: formatTimeRemaining(availableUntil),
      featuredItem,
    }
  },

  /**
   * Rotate the Black Market with new items
   */
  async rotateMarket(): Promise<{ rotationId: number; itemCount: number }> {
    // Get max rotation ID
    const lastRotation = await prisma.blackMarketInventory.aggregate({
      _max: { rotationId: true },
    })
    const rotationId = (lastRotation._max.rotationId ?? 0) + 1

    // Calculate time window
    const availableFrom = new Date()
    const availableUntil = new Date()
    availableUntil.setHours(availableUntil.getHours() + BLACK_MARKET_CONFIG.ROTATION_HOURS)

    // Get items by tier
    const [legendaryItems, rareItems, uncommonItems, commonItems] = await Promise.all([
      prisma.item.findMany({ where: { tier: ITEM_TIERS.LEGENDARY } }),
      prisma.item.findMany({ where: { tier: ITEM_TIERS.RARE } }),
      prisma.item.findMany({ where: { tier: ITEM_TIERS.UNCOMMON } }),
      prisma.item.findMany({ where: { tier: ITEM_TIERS.COMMON } }),
    ])

    const itemsToAdd: Array<{
      itemId: number
      price: number
      stock: number
      tier: ItemTier
      isFeatured: boolean
      discountPercent: number
    }> = []

    // Legendary item (30% chance)
    if (Math.random() < BLACK_MARKET_CONFIG.LEGENDARY_CHANCE && legendaryItems.length > 0) {
      const item = legendaryItems[Math.floor(Math.random() * legendaryItems.length)]
      const stock = randomInt(
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.LEGENDARY].min,
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.LEGENDARY].max
      )
      itemsToAdd.push({
        itemId: item.id,
        price: item.purchasePrice,
        stock,
        tier: ITEM_TIERS.LEGENDARY,
        isFeatured: false,
        discountPercent: 0,
      })
    }

    // Rare items
    const rareCount = randomInt(BLACK_MARKET_CONFIG.RARE_COUNT.min, BLACK_MARKET_CONFIG.RARE_COUNT.max)
    const shuffledRare = rareItems.sort(() => Math.random() - 0.5).slice(0, rareCount)
    for (const item of shuffledRare) {
      const stock = randomInt(
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.RARE].min,
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.RARE].max
      )
      itemsToAdd.push({
        itemId: item.id,
        price: item.purchasePrice,
        stock,
        tier: ITEM_TIERS.RARE,
        isFeatured: false,
        discountPercent: 0,
      })
    }

    // Uncommon items
    const uncommonCount = randomInt(BLACK_MARKET_CONFIG.UNCOMMON_COUNT.min, BLACK_MARKET_CONFIG.UNCOMMON_COUNT.max)
    const shuffledUncommon = uncommonItems.sort(() => Math.random() - 0.5).slice(0, uncommonCount)
    for (const item of shuffledUncommon) {
      const stock = randomInt(
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.UNCOMMON].min,
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.UNCOMMON].max
      )
      itemsToAdd.push({
        itemId: item.id,
        price: item.purchasePrice,
        stock,
        tier: ITEM_TIERS.UNCOMMON,
        isFeatured: false,
        discountPercent: 0,
      })
    }

    // Common items
    const commonCount = randomInt(BLACK_MARKET_CONFIG.COMMON_COUNT.min, BLACK_MARKET_CONFIG.COMMON_COUNT.max)
    const shuffledCommon = commonItems.sort(() => Math.random() - 0.5).slice(0, commonCount)
    for (const item of shuffledCommon) {
      const stock = randomInt(
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.COMMON].min,
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.COMMON].max
      )
      itemsToAdd.push({
        itemId: item.id,
        price: item.purchasePrice,
        stock,
        tier: ITEM_TIERS.COMMON,
        isFeatured: false,
        discountPercent: 0,
      })
    }

    // Select one featured item with discount
    if (itemsToAdd.length > 0) {
      const featuredIndex = Math.floor(Math.random() * itemsToAdd.length)
      itemsToAdd[featuredIndex].isFeatured = true
      itemsToAdd[featuredIndex].discountPercent = Math.floor(BLACK_MARKET_CONFIG.FEATURED_DISCOUNT * 100)
      itemsToAdd[featuredIndex].price = Math.floor(
        itemsToAdd[featuredIndex].price * (1 - BLACK_MARKET_CONFIG.FEATURED_DISCOUNT)
      )
    }

    // Create market inventory
    await prisma.blackMarketInventory.createMany({
      data: itemsToAdd.map((item) => ({
        itemId: item.itemId,
        stockQuantity: item.stock,
        originalStock: item.stock,
        price: item.price,
        rotationId,
        availableFrom,
        availableUntil,
        isFeatured: item.isFeatured,
        discountPercent: item.discountPercent,
      })),
    })

    return { rotationId, itemCount: itemsToAdd.length }
  },

  /**
   * Purchase item from Black Market
   */
  async purchaseItem(userId: number, marketId: number): Promise<MarketPurchaseResult> {
    const now = new Date()

    // Get market item
    const marketItem = await prisma.blackMarketInventory.findFirst({
      where: {
        id: marketId,
        availableFrom: { lte: now },
        availableUntil: { gt: now },
        stockQuantity: { gt: 0 },
      },
      include: {
        item: true,
      },
    })

    if (!marketItem) {
      return { success: false, reason: 'Item not available or sold out' }
    }

    // Check user's wealth
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { wealth: true },
    })

    if (!user) {
      return { success: false, reason: 'User not found' }
    }

    if (Number(user.wealth) < marketItem.price) {
      return {
        success: false,
        reason: `Not enough wealth. You need $${marketItem.price.toLocaleString()} but have $${Number(user.wealth).toLocaleString()}`,
      }
    }

    // Check inventory space
    const hasSpace = await InventoryService.hasSpace(userId)
    if (!hasSpace) {
      return { success: false, reason: 'Your inventory is full (10/10)' }
    }

    // Check business ownership limit (Design Drift Remediation)
    if (marketItem.item.itemType === 'business') {
      const businessCheck = await BusinessService.canPurchaseBusiness(userId, MAX_BUSINESSES_OWNED)
      if (!businessCheck.canPurchase) {
        return { success: false, reason: businessCheck.error }
      }
    }

    // Process purchase in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Decrement stock (with optimistic locking check)
      const updated = await tx.blackMarketInventory.updateMany({
        where: {
          id: marketId,
          stockQuantity: { gt: 0 },
        },
        data: {
          stockQuantity: { decrement: 1 },
        },
      })

      if (updated.count === 0) {
        throw new Error('Item sold out')
      }

      // Deduct wealth
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { wealth: { decrement: marketItem.price } },
        select: { wealth: true },
      })

      // Add item to inventory
      const inventoryItem = await tx.userInventory.create({
        data: {
          userId,
          itemId: marketItem.itemId,
          durability: marketItem.item.baseDurability,
          isEquipped: false,
        },
      })

      // Record purchase
      await tx.blackMarketPurchase.create({
        data: {
          userId,
          marketId,
          itemId: marketItem.itemId,
          pricePaid: marketItem.price,
        },
      })

      // Record game event
      await tx.gameEvent.create({
        data: {
          userId,
          eventType: 'market_purchase',
          wealthChange: -marketItem.price,
          xpChange: 0,
          eventDescription: `Purchased ${marketItem.item.itemName} from Black Market for $${marketItem.price.toLocaleString()}`,
          success: true,
        },
      })

      // Get updated stock
      const updatedMarket = await tx.blackMarketInventory.findUnique({
        where: { id: marketId },
        select: { stockQuantity: true },
      })

      return {
        newWealth: updatedUser.wealth,
        inventoryId: inventoryItem.id,
        stockRemaining: updatedMarket?.stockQuantity ?? 0,
      }
    })

    return {
      success: true,
      itemName: marketItem.item.itemName,
      pricePaid: marketItem.price,
      newWealth: result.newWealth,
      inventoryId: result.inventoryId,
      stockRemaining: result.stockRemaining,
    }
  },

  /**
   * Get time until next rotation
   */
  async getNextRotationTime(): Promise<{ nextRotation: Date | null; timeRemaining: string | null }> {
    const now = new Date()

    const currentRotation = await prisma.blackMarketInventory.findFirst({
      where: {
        availableFrom: { lte: now },
        availableUntil: { gt: now },
      },
      select: { availableUntil: true },
    })

    if (!currentRotation) {
      return { nextRotation: null, timeRemaining: null }
    }

    return {
      nextRotation: currentRotation.availableUntil,
      timeRemaining: formatTimeRemaining(currentRotation.availableUntil),
    }
  },

  /**
   * Force market rotation (admin only)
   */
  async forceRotation(): Promise<{ success: boolean; rotationId: number; itemCount: number }> {
    // Expire current rotation
    const now = new Date()
    await prisma.blackMarketInventory.updateMany({
      where: {
        availableUntil: { gt: now },
      },
      data: {
        availableUntil: now,
      },
    })

    // Generate new rotation
    const result = await this.rotateMarket()

    return { success: true, ...result }
  },

  /**
   * Get Black Market purchase history for a user
   */
  async getUserPurchaseHistory(userId: number, limit: number = 10) {
    const purchases = await prisma.blackMarketPurchase.findMany({
      where: { userId },
      include: {
        item: true,
      },
      orderBy: { purchasedAt: 'desc' },
      take: limit,
    })

    return purchases.map((p) => ({
      itemName: p.item.itemName,
      itemType: p.item.itemType,
      tier: p.item.tier,
      pricePaid: p.pricePaid,
      purchasedAt: p.purchasedAt,
    }))
  },

  /**
   * Check if market needs rotation (for scheduled job)
   */
  async needsRotation(): Promise<boolean> {
    const now = new Date()

    const activeMarket = await prisma.blackMarketInventory.findFirst({
      where: {
        availableFrom: { lte: now },
        availableUntil: { gt: now },
      },
    })

    return !activeMarket
  },
}

export default BlackMarketService
