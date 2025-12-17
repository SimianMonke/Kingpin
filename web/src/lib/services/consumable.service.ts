import { prisma } from '../db'
import { BuffService, type BuffCategory, type BuffSource } from './buff.service'

// =============================================================================
// CONSUMABLE SERVICE TYPES
// =============================================================================

export interface ConsumableType {
  id: string
  name: string
  category: string
  cost: number
  isDurationBuff: boolean
  durationHours: number | null
  buffKey: string | null
  buffValue: number | null
  isSingleUse: boolean
  maxOwned: number | null
  description: string | null
  flavorText: string | null
  icon: string | null
  sortOrder: number
}

export interface UserConsumableInventory {
  consumableId: string
  name: string
  category: string
  quantity: number
  maxOwned: number | null
  description: string | null
  icon: string | null
}

export interface ConsumablePurchaseResult {
  success: boolean
  reason?: string
  consumableName?: string
  pricePaid?: number
  newWealth?: bigint
  buffApplied?: boolean
  wasExtension?: boolean
  wasUpgrade?: boolean
  wasDowngrade?: boolean  // User tried to buy lower tier - no buff applied
  quantityNow?: number    // For single-use items
}

export interface UseConsumableResult {
  success: boolean
  reason?: string
  consumableName?: string
  quantityRemaining?: number
}

export interface CanPurchaseResult {
  canPurchase: boolean
  reason?: string
  cost?: number
  currentWealth?: bigint
  currentQuantity?: number  // For single-use items
  maxOwned?: number | null
}

// =============================================================================
// CONSUMABLE SERVICE
// =============================================================================

export const ConsumableService = {
  // ===========================================================================
  // CATALOG METHODS
  // ===========================================================================

  /**
   * Get all active consumable types (catalog)
   */
  async getCatalog(): Promise<ConsumableType[]> {
    const consumables = await prisma.consumable_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    })

    return consumables.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      cost: c.cost,
      isDurationBuff: c.is_duration_buff ?? true,
      durationHours: c.duration_hours,
      buffKey: c.buff_key,
      buffValue: c.buff_value ? Number(c.buff_value) : null,
      isSingleUse: c.is_single_use ?? false,
      maxOwned: c.max_owned,
      description: c.description,
      flavorText: c.flavor_text,
      icon: c.icon,
      sortOrder: c.sort_order ?? 0,
    }))
  },

  /**
   * Get a single consumable type by ID
   */
  async getConsumableType(consumableId: string): Promise<ConsumableType | null> {
    const c = await prisma.consumable_types.findUnique({
      where: { id: consumableId },
    })

    if (!c || !c.is_active) return null

    return {
      id: c.id,
      name: c.name,
      category: c.category,
      cost: c.cost,
      isDurationBuff: c.is_duration_buff ?? true,
      durationHours: c.duration_hours,
      buffKey: c.buff_key,
      buffValue: c.buff_value ? Number(c.buff_value) : null,
      isSingleUse: c.is_single_use ?? false,
      maxOwned: c.max_owned,
      description: c.description,
      flavorText: c.flavor_text,
      icon: c.icon,
      sortOrder: c.sort_order ?? 0,
    }
  },

  // ===========================================================================
  // USER INVENTORY METHODS
  // ===========================================================================

  /**
   * Get user's single-use consumable inventory
   */
  async getUserInventory(userId: number): Promise<UserConsumableInventory[]> {
    const inventory = await prisma.user_consumables.findMany({
      where: {
        user_id: userId,
        quantity: { gt: 0 },
      },
      include: {
        consumable_type: true,
      },
      orderBy: { consumable_type: { sort_order: 'asc' } },
    })

    return inventory.map((item) => ({
      consumableId: item.consumable_id,
      name: item.consumable_type.name,
      category: item.consumable_type.category,
      quantity: item.quantity ?? 0,
      maxOwned: item.consumable_type.max_owned,
      description: item.consumable_type.description,
      icon: item.consumable_type.icon,
    }))
  },

  /**
   * Check if user owns a specific single-use consumable
   */
  async hasConsumable(userId: number, consumableId: string): Promise<boolean> {
    const item = await prisma.user_consumables.findUnique({
      where: {
        user_id_consumable_id: {
          user_id: userId,
          consumable_id: consumableId,
        },
      },
    })

    return !!item && (item.quantity ?? 0) > 0
  },

  /**
   * Get count of specific consumable owned
   */
  async getConsumableCount(userId: number, consumableId: string): Promise<number> {
    const item = await prisma.user_consumables.findUnique({
      where: {
        user_id_consumable_id: {
          user_id: userId,
          consumable_id: consumableId,
        },
      },
    })

    return item?.quantity ?? 0
  },

  // ===========================================================================
  // PURCHASE METHODS
  // ===========================================================================

  /**
   * Check if user can purchase a consumable (pre-check for UI)
   */
  async canPurchase(userId: number, consumableId: string): Promise<CanPurchaseResult> {
    // Get consumable type
    const consumable = await prisma.consumable_types.findUnique({
      where: { id: consumableId },
    })

    if (!consumable || !consumable.is_active) {
      return { canPurchase: false, reason: 'Consumable not found or unavailable' }
    }

    // Get user's wealth
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { wealth: true },
    })

    if (!user) {
      return { canPurchase: false, reason: 'User not found' }
    }

    const currentWealth = user.wealth ?? BigInt(0)

    if (Number(currentWealth) < consumable.cost) {
      return {
        canPurchase: false,
        reason: `Not enough wealth. Need $${consumable.cost.toLocaleString()}, have $${Number(currentWealth).toLocaleString()}`,
        cost: consumable.cost,
        currentWealth,
      }
    }

    // For single-use items, check max owned
    if (consumable.is_single_use && consumable.max_owned !== null) {
      const currentQuantity = await this.getConsumableCount(userId, consumableId)
      if (currentQuantity >= consumable.max_owned) {
        return {
          canPurchase: false,
          reason: `You already own the maximum (${consumable.max_owned}) of this item`,
          cost: consumable.cost,
          currentWealth,
          currentQuantity,
          maxOwned: consumable.max_owned,
        }
      }
      return {
        canPurchase: true,
        cost: consumable.cost,
        currentWealth,
        currentQuantity,
        maxOwned: consumable.max_owned,
      }
    }

    return {
      canPurchase: true,
      cost: consumable.cost,
      currentWealth,
    }
  },

  /**
   * Purchase a consumable
   * - Duration buffs: Applies buff via BuffService
   * - Single-use items: Adds to user_consumables inventory
   */
  async purchase(userId: number, consumableId: string): Promise<ConsumablePurchaseResult> {
    // Get consumable type
    const consumable = await prisma.consumable_types.findUnique({
      where: { id: consumableId },
    })

    if (!consumable || !consumable.is_active) {
      return { success: false, reason: 'Consumable not found or unavailable' }
    }

    // Pre-check
    const canBuy = await this.canPurchase(userId, consumableId)
    if (!canBuy.canPurchase) {
      return { success: false, reason: canBuy.reason }
    }

    // Process purchase in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct wealth
      const updatedUser = await tx.users.update({
        where: { id: userId },
        data: { wealth: { decrement: consumable.cost } },
        select: { wealth: true },
      })

      let buffApplied = false
      let wasExtension = false
      let wasUpgrade = false
      let wasDowngrade = false
      let quantityNow: number | undefined

      if (consumable.is_single_use) {
        // Add to user_consumables inventory
        const existingItem = await tx.user_consumables.findUnique({
          where: {
            user_id_consumable_id: {
              user_id: userId,
              consumable_id: consumableId,
            },
          },
        })

        if (existingItem) {
          const updated = await tx.user_consumables.update({
            where: { id: existingItem.id },
            data: {
              quantity: { increment: 1 },
              updated_at: new Date(),
            },
          })
          quantityNow = updated.quantity ?? 1
        } else {
          await tx.user_consumables.create({
            data: {
              user_id: userId,
              consumable_id: consumableId,
              quantity: 1,
            },
          })
          quantityNow = 1
        }
      } else if (consumable.is_duration_buff && consumable.buff_key && consumable.buff_value) {
        // This is handled outside transaction since BuffService has its own transaction
        // We'll mark it for processing after
        buffApplied = true
      }

      // Log purchase
      await tx.consumable_purchases.create({
        data: {
          user_id: userId,
          consumable_id: consumableId,
          cost: consumable.cost,
          was_extension: false,  // Will be updated after buff application
          was_upgrade: false,
        },
      })

      // Record game event
      await tx.game_events.create({
        data: {
          user_id: userId,
          event_type: 'consumable_purchase',
          wealth_change: BigInt(-consumable.cost),
          xp_change: 0,
          event_description: `Purchased ${consumable.name} for $${consumable.cost.toLocaleString()}`,
          success: true,
        },
      })

      return {
        newWealth: updatedUser.wealth ?? BigInt(0),
        buffApplied,
        wasExtension,
        wasUpgrade,
        wasDowngrade,
        quantityNow,
      }
    })

    // Apply buff outside transaction if needed
    if (result.buffApplied && consumable.buff_key && consumable.buff_value && consumable.duration_hours) {
      const buffResult = await BuffService.applyBuff(
        userId,
        consumable.buff_key,
        this.mapCategoryToBuffCategory(consumable.category),
        Number(consumable.buff_value),
        consumable.duration_hours,
        'consumable' as BuffSource,
        consumable.description ?? undefined
      )

      result.wasExtension = buffResult.wasExtension
      result.wasUpgrade = buffResult.wasUpgrade

      // Check if this was a downgrade attempt (no change applied)
      if (!buffResult.wasExtension && !buffResult.wasUpgrade) {
        // Check if there's an existing higher buff
        const existingBuff = await BuffService.getBuffInfo(userId, consumable.buff_key)
        if (existingBuff && existingBuff.multiplier > Number(consumable.buff_value)) {
          result.wasDowngrade = true
        }
      }

      // Update purchase record with buff interaction info
      const lastPurchase = await prisma.consumable_purchases.findFirst({
        where: { user_id: userId, consumable_id: consumableId },
        orderBy: { purchased_at: 'desc' },
      })
      if (lastPurchase) {
        await prisma.consumable_purchases.update({
          where: { id: lastPurchase.id },
          data: {
            was_extension: buffResult.wasExtension,
            was_upgrade: buffResult.wasUpgrade,
            previous_buff_remaining_mins: buffResult.previousRemainingMinutes,
          },
        })
      }
    }

    return {
      success: true,
      consumableName: consumable.name,
      pricePaid: consumable.cost,
      newWealth: result.newWealth,
      buffApplied: result.buffApplied,
      wasExtension: result.wasExtension,
      wasUpgrade: result.wasUpgrade,
      wasDowngrade: result.wasDowngrade,
      quantityNow: result.quantityNow,
    }
  },

  // ===========================================================================
  // USE CONSUMABLE METHODS
  // ===========================================================================

  /**
   * Use a single-use consumable (decrement quantity)
   * Returns the consumable info for the caller to apply the effect
   */
  async useConsumable(userId: number, consumableId: string): Promise<UseConsumableResult> {
    // Get consumable type
    const consumable = await prisma.consumable_types.findUnique({
      where: { id: consumableId },
    })

    if (!consumable || !consumable.is_active) {
      return { success: false, reason: 'Consumable not found or unavailable' }
    }

    if (!consumable.is_single_use) {
      return { success: false, reason: 'This consumable is not a single-use item' }
    }

    // Check if user has the item
    const userItem = await prisma.user_consumables.findUnique({
      where: {
        user_id_consumable_id: {
          user_id: userId,
          consumable_id: consumableId,
        },
      },
    })

    if (!userItem || (userItem.quantity ?? 0) <= 0) {
      return { success: false, reason: `You don't own any ${consumable.name}` }
    }

    // Decrement quantity
    const updated = await prisma.user_consumables.update({
      where: { id: userItem.id },
      data: {
        quantity: { decrement: 1 },
        updated_at: new Date(),
      },
    })

    // Record game event
    await prisma.game_events.create({
      data: {
        user_id: userId,
        event_type: 'consumable_use',
        wealth_change: 0,
        xp_change: 0,
        event_description: `Used ${consumable.name}`,
        success: true,
      },
    })

    return {
      success: true,
      consumableName: consumable.name,
      quantityRemaining: updated.quantity ?? 0,
    }
  },

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get user's consumable purchase history
   */
  async getPurchaseHistory(userId: number, limit: number = 20) {
    const purchases = await prisma.consumable_purchases.findMany({
      where: { user_id: userId },
      include: {
        consumable_type: true,
      },
      orderBy: { purchased_at: 'desc' },
      take: limit,
    })

    return purchases.map((p) => ({
      consumableId: p.consumable_id,
      name: p.consumable_type.name,
      cost: p.cost,
      wasExtension: p.was_extension ?? false,
      wasUpgrade: p.was_upgrade ?? false,
      purchasedAt: p.purchased_at,
    }))
  },

  /**
   * Get total spent on consumables
   */
  async getTotalSpent(userId: number): Promise<number> {
    const result = await prisma.consumable_purchases.aggregate({
      where: { user_id: userId },
      _sum: { cost: true },
    })

    return result._sum.cost ?? 0
  },

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Map consumable category to BuffCategory
   */
  mapCategoryToBuffCategory(category: string): BuffCategory {
    const mapping: Record<string, BuffCategory> = {
      xp: 'xp',
      combat: 'rob_attack',  // Combat items affect rob_attack by default
      economy: 'business',   // Economy items affect business by default
      utility: 'wealth',     // Utility mapped to wealth as fallback
    }
    return mapping[category] ?? 'xp'
  },

  /**
   * Get buff category from buff_key
   */
  getBuffCategoryFromKey(buffKey: string): BuffCategory {
    const mapping: Record<string, BuffCategory> = {
      xp_multiplier: 'xp',
      rob_attack: 'rob_attack',
      rob_defense: 'rob_defense',
      business_revenue: 'business',
      crate_drop: 'crate',
      wealth_gain: 'wealth',
    }
    return mapping[buffKey] ?? 'xp'
  },
}

export default ConsumableService
