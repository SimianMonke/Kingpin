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
  item_id: number
  itemName: string
  type: string
  tier: string
  price: number
  original_price: number | null
  discount_percent: number | null
  stock_quantity: number | null
  original_stock: number | null
  is_featured: boolean | null
  // Item stats
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
  description: string | null
  flavor_text: string | null
}

export interface BlackMarketInventory {
  items: BlackMarketItem[]
  rotation_id: number
  available_from: Date
  available_until: Date
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
    const marketItems = await prisma.black_market_inventory.findMany({
      where: {
        available_from: { lte: now },
        available_until: { gt: now },
        stock_quantity: { gt: 0 },
      },
      include: {
        items: true,
      },
      orderBy: [
        { is_featured: 'desc' },
        { items: { tier: 'desc' } },
        { price: 'desc' },
      ],
    })

    if (marketItems.length === 0) {
      // No active rotation - need to generate one
      await this.rotateMarket()
      return this.getMarketInventory() // Recursive call
    }

    const rotation_id = marketItems[0].rotation_id
    const available_from = marketItems[0].available_from
    const available_until = marketItems[0].available_until

    const items: BlackMarketItem[] = marketItems.map((mi) => ({
      marketId: mi.id,
      item_id: mi.items.id,
      itemName: mi.items.name,
      type: mi.items.type,
      tier: mi.items.tier,
      price: mi.price,
      original_price: mi.items.purchase_price,
      discount_percent: mi.discount_percent,
      stock_quantity: mi.stock_quantity,
      original_stock: mi.original_stock,
      is_featured: mi.is_featured,
      rob_bonus: mi.items.rob_bonus ? Number(mi.items.rob_bonus) : null,
      defense_bonus: mi.items.defense_bonus ? Number(mi.items.defense_bonus) : null,
      revenue_min: mi.items.revenue_min,
      revenue_max: mi.items.revenue_max,
      insurance_percent: mi.items.insurance_percent ? Number(mi.items.insurance_percent) : null,
      description: mi.items.description,
      flavor_text: mi.items.flavor_text,
    }))

    const featuredItem = items.find((i) => i.is_featured) ?? null

    return {
      items,
      rotation_id,
      available_from,
      available_until,
      timeRemaining: formatTimeRemaining(available_until),
      featuredItem,
    }
  },

  /**
   * Rotate the Black Market with new items
   */
  async rotateMarket(): Promise<{ rotation_id: number; itemCount: number }> {
    // Get max rotation ID
    const lastRotation = await prisma.black_market_inventory.aggregate({
      _max: { rotation_id: true },
    })
    const rotation_id = (lastRotation._max.rotation_id ?? 0) + 1

    // Calculate time window
    const available_from = new Date()
    const available_until = new Date()
    available_until.setHours(available_until.getHours() + BLACK_MARKET_CONFIG.ROTATION_HOURS)

    // Get items by tier
    const [legendaryItems, rareItems, uncommonItems, commonItems] = await Promise.all([
      prisma.items.findMany({ where: { tier: ITEM_TIERS.LEGENDARY } }),
      prisma.items.findMany({ where: { tier: ITEM_TIERS.RARE } }),
      prisma.items.findMany({ where: { tier: ITEM_TIERS.UNCOMMON } }),
      prisma.items.findMany({ where: { tier: ITEM_TIERS.COMMON } }),
    ])

    const itemsToAdd: Array<{
      item_id: number
      price: number
      stock: number
      tier: ItemTier
      is_featured: boolean
      discount_percent: number
    }> = []

    // Legendary item (30% chance)
    if (Math.random() < BLACK_MARKET_CONFIG.LEGENDARY_CHANCE && legendaryItems.length > 0) {
      const item = legendaryItems[Math.floor(Math.random() * legendaryItems.length)]
      const stock = randomInt(
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.LEGENDARY].min,
        BLACK_MARKET_CONFIG.STOCK_RANGES[ITEM_TIERS.LEGENDARY].max
      )
      itemsToAdd.push({
        item_id: item.id,
        price: item.purchase_price,
        stock,
        tier: ITEM_TIERS.LEGENDARY,
        is_featured: false,
        discount_percent: 0,
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
        item_id: item.id,
        price: item.purchase_price,
        stock,
        tier: ITEM_TIERS.RARE,
        is_featured: false,
        discount_percent: 0,
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
        item_id: item.id,
        price: item.purchase_price,
        stock,
        tier: ITEM_TIERS.UNCOMMON,
        is_featured: false,
        discount_percent: 0,
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
        item_id: item.id,
        price: item.purchase_price,
        stock,
        tier: ITEM_TIERS.COMMON,
        is_featured: false,
        discount_percent: 0,
      })
    }

    // Select one featured item with discount
    if (itemsToAdd.length > 0) {
      const featuredIndex = Math.floor(Math.random() * itemsToAdd.length)
      itemsToAdd[featuredIndex].is_featured = true
      itemsToAdd[featuredIndex].discount_percent = Math.floor(BLACK_MARKET_CONFIG.FEATURED_DISCOUNT * 100)
      itemsToAdd[featuredIndex].price = Math.floor(
        itemsToAdd[featuredIndex].price * (1 - BLACK_MARKET_CONFIG.FEATURED_DISCOUNT)
      )
    }

    // Create market inventory
    await prisma.black_market_inventory.createMany({
      data: itemsToAdd.map((item) => ({
        item_id: item.item_id,
        stock_quantity: item.stock,
        original_stock: item.stock,
        price: item.price,
        rotation_id,
        available_from,
        available_until,
        is_featured: item.is_featured,
        discount_percent: item.discount_percent,
      })),
    })

    return { rotation_id, itemCount: itemsToAdd.length }
  },

  /**
   * Purchase item from Black Market
   */
  async purchaseItem(user_id: number, marketId: number): Promise<MarketPurchaseResult> {
    const now = new Date()

    // Get market item
    const marketItem = await prisma.black_market_inventory.findFirst({
      where: {
        id: marketId,
        available_from: { lte: now },
        available_until: { gt: now },
        stock_quantity: { gt: 0 },
      },
      include: {
        items: true,
      },
    })

    if (!marketItem) {
      return { success: false, reason: 'Item not available or sold out' }
    }

    // Check user's wealth
    const user = await prisma.users.findUnique({
      where: { id: user_id },
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
    const hasSpace = await InventoryService.hasSpace(user_id)
    if (!hasSpace) {
      return { success: false, reason: 'Your inventory is full (10/10)' }
    }

    // Check business ownership limit (Design Drift Remediation)
    if (marketItem.items.type === 'business') {
      const businessCheck = await BusinessService.canPurchaseBusiness(user_id, MAX_BUSINESSES_OWNED)
      if (!businessCheck.canPurchase) {
        return { success: false, reason: businessCheck.error }
      }
    }

    // Process purchase in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Decrement stock (with optimistic locking check)
      const updated = await tx.black_market_inventory.updateMany({
        where: {
          id: marketId,
          stock_quantity: { gt: 0 },
        },
        data: {
          stock_quantity: { decrement: 1 },
        },
      })

      if (updated.count === 0) {
        throw new Error('Item sold out')
      }

      // Deduct wealth
      const updatedUser = await tx.users.update({
        where: { id: user_id },
        data: { wealth: { decrement: marketItem.price } },
        select: { wealth: true },
      })

      // Add item to inventory
      const inventoryItem = await tx.user_inventory.create({
        data: {
          user_id,
          item_id: marketItem.item_id,
          durability: marketItem.items.base_durability ?? 100,
          is_equipped: false,
        },
      })

      // Record game event (purchase record)
      await tx.game_events.create({
        data: {
          user_id,
          event_type: 'market_purchase',
          wealth_change: -marketItem.price,
          xp_change: 0,
          event_description: `Purchased ${marketItem.items.name} from Black Market for $${marketItem.price.toLocaleString()}`,
          success: true,
        },
      })

      // Get updated stock
      const updatedMarket = await tx.black_market_inventory.findUnique({
        where: { id: marketId },
        select: { stock_quantity: true },
      })

      return {
        newWealth: updatedUser.wealth,
        inventoryId: inventoryItem.id,
        stockRemaining: updatedMarket?.stock_quantity ?? 0,
      }
    })

    return {
      success: true,
      itemName: marketItem.items.name,
      pricePaid: marketItem.price,
      newWealth: result.newWealth ?? BigInt(0),
      inventoryId: result.inventoryId,
      stockRemaining: result.stockRemaining,
    }
  },

  /**
   * Get time until next rotation
   */
  async getNextRotationTime(): Promise<{ nextRotation: Date | null; timeRemaining: string | null }> {
    const now = new Date()

    const currentRotation = await prisma.black_market_inventory.findFirst({
      where: {
        available_from: { lte: now },
        available_until: { gt: now },
      },
      select: { available_until: true },
    })

    if (!currentRotation) {
      return { nextRotation: null, timeRemaining: null }
    }

    return {
      nextRotation: currentRotation.available_until,
      timeRemaining: formatTimeRemaining(currentRotation.available_until),
    }
  },

  /**
   * Force market rotation (admin only)
   */
  async forceRotation(): Promise<{ success: boolean; rotation_id: number; itemCount: number }> {
    // Expire current rotation
    const now = new Date()
    await prisma.black_market_inventory.updateMany({
      where: {
        available_until: { gt: now },
      },
      data: {
        available_until: now,
      },
    })

    // Generate new rotation
    const result = await this.rotateMarket()

    return { success: true, ...result }
  },

  /**
   * Get Black Market purchase history for a user (from game_events)
   */
  async getUserPurchaseHistory(user_id: number, limit: number = 10) {
    const purchases = await prisma.game_events.findMany({
      where: {
        user_id,
        event_type: 'market_purchase',
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })

    return purchases.map((p) => ({
      event_description: p.event_description,
      wealth_change: p.wealth_change,
      created_at: p.created_at,
    }))
  },

  /**
   * Check if market needs rotation (for scheduled job)
   */
  async needsRotation(): Promise<boolean> {
    const now = new Date()

    const activeMarket = await prisma.black_market_inventory.findFirst({
      where: {
        available_from: { lte: now },
        available_until: { gt: now },
      },
    })

    return !activeMarket
  },
}

export default BlackMarketService
