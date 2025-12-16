import { prisma } from '../db'
import { MAX_INVENTORY_SIZE, MAX_ITEM_ESCROW, ITEM_ESCROW_HOURS, ITEM_TYPES, DURABILITY_CONFIG } from '../game'
import type { ItemType, EquipmentSlot } from '../game/constants'
import type { PrismaClient } from '@prisma/client'

// Transaction client type for passing prisma transactions to methods
export type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// =============================================================================
// INVENTORY SERVICE TYPES
// =============================================================================

export interface InventoryItem {
  id: number
  item_id: number
  itemName: string
  type: string
  tier: string
  durability: number
  maxDurability: number | null
  is_equipped: boolean | null
  slot: string | null
  is_escrowed: boolean | null
  escrow_expires_at: Date | null
  acquired_at: Date | null
  equipped_at: Date | null
  // Item stats
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
  sell_price: number | null
  description: string | null
  flavor_text: string | null
}

export interface EquippedItems {
  weapon: InventoryItem | null
  armor: InventoryItem | null
  business: InventoryItem | null
  housing: InventoryItem | null
}

export interface InventoryStats {
  totalSlots: number
  usedSlots: number
  availableSlots: number
  escrowedCount: number
}

// =============================================================================
// INVENTORY SERVICE
// =============================================================================

export const InventoryService = {
  /**
   * Get user's full inventory
   */
  async getInventory(user_id: number): Promise<InventoryItem[]> {
    const items = await prisma.user_inventory.findMany({
      where: {
        user_id,
        is_escrowed: false,
      },
      include: {
        items: true,
      },
      orderBy: [
        { is_equipped: 'desc' },
        { slot: 'asc' },
        { acquired_at: 'desc' },
      ],
    })

    return items.map((inv) => ({
      id: inv.id,
      item_id: inv.items.id,
      itemName: inv.items.name,
      type: inv.items.type,
      tier: inv.items.tier,
      durability: inv.durability,
      maxDurability: inv.items.base_durability,
      is_equipped: inv.is_equipped,
      slot: inv.slot,
      is_escrowed: inv.is_escrowed,
      escrow_expires_at: inv.escrow_expires_at,
      acquired_at: inv.acquired_at,
      equipped_at: inv.equipped_at,
      rob_bonus: inv.items.rob_bonus ? Number(inv.items.rob_bonus) : null,
      defense_bonus: inv.items.defense_bonus ? Number(inv.items.defense_bonus) : null,
      revenue_min: inv.items.revenue_min,
      revenue_max: inv.items.revenue_max,
      insurance_percent: inv.items.insurance_percent ? Number(inv.items.insurance_percent) : null,
      sell_price: inv.items.sell_price,
      description: inv.items.description,
      flavor_text: inv.items.flavor_text,
    }))
  },

  /**
   * Get user's equipped items
   */
  async getEquippedItems(user_id: number): Promise<EquippedItems> {
    const equipped = await prisma.user_inventory.findMany({
      where: {
        user_id,
        is_equipped: true,
      },
      include: {
        items: true,
      },
    })

    const result: EquippedItems = {
      weapon: null,
      armor: null,
      business: null,
      housing: null,
    }

    for (const inv of equipped) {
      const item: InventoryItem = {
        id: inv.id,
        item_id: inv.items.id,
        itemName: inv.items.name,
        type: inv.items.type,
        tier: inv.items.tier,
        durability: inv.durability,
        maxDurability: inv.items.base_durability,
        is_equipped: inv.is_equipped,
        slot: inv.slot,
        is_escrowed: inv.is_escrowed,
        escrow_expires_at: inv.escrow_expires_at,
        acquired_at: inv.acquired_at,
        equipped_at: inv.equipped_at,
        rob_bonus: inv.items.rob_bonus ? Number(inv.items.rob_bonus) : null,
        defense_bonus: inv.items.defense_bonus ? Number(inv.items.defense_bonus) : null,
        revenue_min: inv.items.revenue_min,
        revenue_max: inv.items.revenue_max,
        insurance_percent: inv.items.insurance_percent ? Number(inv.items.insurance_percent) : null,
        sell_price: inv.items.sell_price,
        description: inv.items.description,
        flavor_text: inv.items.flavor_text,
      }

      if (inv.slot === ITEM_TYPES.WEAPON) result.weapon = item
      else if (inv.slot === ITEM_TYPES.ARMOR) result.armor = item
      else if (inv.slot === ITEM_TYPES.BUSINESS) result.business = item
      else if (inv.slot === ITEM_TYPES.HOUSING) result.housing = item
    }

    return result
  },

  /**
   * Get inventory stats
   */
  async getInventoryStats(user_id: number): Promise<InventoryStats> {
    const [regularCount, escrowedCount] = await Promise.all([
      prisma.user_inventory.count({
        where: { user_id, is_escrowed: false },
      }),
      prisma.user_inventory.count({
        where: { user_id, is_escrowed: true },
      }),
    ])

    return {
      totalSlots: MAX_INVENTORY_SIZE,
      usedSlots: regularCount,
      availableSlots: MAX_INVENTORY_SIZE - regularCount,
      escrowedCount,
    }
  },

  /**
   * Check if inventory has space
   */
  async hasSpace(user_id: number): Promise<boolean> {
    const count = await prisma.user_inventory.count({
      where: { user_id, is_escrowed: false },
    })
    return count < MAX_INVENTORY_SIZE
  },

  /**
   * Check if inventory has space (with transaction client)
   * @internal Used by addItem when inside a transaction
   */
  async hasSpaceWithClient(user_id: number, db: PrismaTransactionClient | typeof prisma): Promise<boolean> {
    const count = await db.user_inventory.count({
      where: { user_id, is_escrowed: false },
    })
    return count < MAX_INVENTORY_SIZE
  },

  /**
   * Add item to user's inventory
   * @param tx - Optional transaction client for atomic operations
   * CRIT-05 fix: Enforces 3-item escrow limit
   */
  async addItem(
    user_id: number,
    item_id: number,
    options: { durability?: number; toEscrow?: boolean } = {},
    tx?: PrismaTransactionClient
  ): Promise<{ success: boolean; inventoryId?: number; toEscrow: boolean; reason?: string }> {
    const db = tx || prisma

    // Check both inventory and escrow counts
    const [inventoryCount, escrowCount] = await Promise.all([
      db.user_inventory.count({ where: { user_id, is_escrowed: false } }),
      db.user_inventory.count({ where: { user_id, is_escrowed: true } }),
    ])

    const hasSpace = inventoryCount < MAX_INVENTORY_SIZE
    let toEscrow = options.toEscrow || !hasSpace

    // CRIT-05: Check escrow limit BEFORE creating
    if (toEscrow && escrowCount >= MAX_ITEM_ESCROW) {
      // If we wanted escrow but it's full, check if inventory has space
      if (hasSpace) {
        toEscrow = false // Fall back to inventory
      } else {
        // Both inventory and escrow are full
        return {
          success: false,
          toEscrow: true,
          reason: 'Both inventory and escrow are full',
        }
      }
    }

    // Get item's base durability
    const item = await db.items.findUnique({
      where: { id: item_id },
      select: { base_durability: true },
    })

    if (!item) {
      throw new Error('Item not found')
    }

    const durability = options.durability ?? item.base_durability ?? 100

    // Calculate escrow expiry using constant
    const escrow_expires_at = toEscrow
      ? new Date(Date.now() + ITEM_ESCROW_HOURS * 60 * 60 * 1000)
      : null

    const inventoryItem = await db.user_inventory.create({
      data: {
        user_id,
        item_id,
        durability,
        is_escrowed: toEscrow,
        escrow_expires_at,
      },
    })

    return {
      success: true,
      inventoryId: inventoryItem.id,
      toEscrow,
    }
  },

  /**
   * Remove item from inventory
   */
  async removeItem(user_id: number, inventoryId: number): Promise<boolean> {
    // Check ownership
    const item = await prisma.user_inventory.findFirst({
      where: { id: inventoryId, user_id },
    })

    if (!item) {
      return false
    }

    // Can't remove equipped items
    if (item.is_equipped) {
      throw new Error('Cannot remove equipped item. Unequip first.')
    }

    await prisma.user_inventory.delete({
      where: { id: inventoryId },
    })

    return true
  },

  /**
   * Equip an item
   */
  async equipItem(user_id: number, inventoryId: number): Promise<{ success: boolean; previousItem?: InventoryItem }> {
    // Get the item to equip
    const itemToEquip = await prisma.user_inventory.findFirst({
      where: { id: inventoryId, user_id, is_escrowed: false },
      include: { items: true },
    })

    if (!itemToEquip) {
      throw new Error('Item not found in inventory')
    }

    if (itemToEquip.is_equipped) {
      return { success: true } // Already equipped
    }

    const slot = itemToEquip.items.type as EquipmentSlot

    // Get currently equipped item in that slot
    const currentlyEquipped = await prisma.user_inventory.findFirst({
      where: {
        user_id,
        is_equipped: true,
        slot,
      },
      include: { items: true },
    })

    // Transaction to swap equipment
    await prisma.$transaction(async (tx) => {
      // Unequip current item if any
      if (currentlyEquipped) {
        await tx.user_inventory.update({
          where: { id: currentlyEquipped.id },
          data: {
            is_equipped: false,
            slot: null,
            equipped_at: null,
          },
        })
      }

      // Equip new item
      await tx.user_inventory.update({
        where: { id: inventoryId },
        data: {
          is_equipped: true,
          slot,
          equipped_at: new Date(),
        },
      })
    })

    const previousItem = currentlyEquipped
      ? {
          id: currentlyEquipped.id,
          item_id: currentlyEquipped.items.id,
          itemName: currentlyEquipped.items.name,
          type: currentlyEquipped.items.type,
          tier: currentlyEquipped.items.tier,
          durability: currentlyEquipped.durability,
          maxDurability: currentlyEquipped.items.base_durability,
          is_equipped: false,
          slot: null,
          is_escrowed: currentlyEquipped.is_escrowed,
          escrow_expires_at: currentlyEquipped.escrow_expires_at,
          acquired_at: currentlyEquipped.acquired_at,
          equipped_at: null,
          rob_bonus: currentlyEquipped.items.rob_bonus ? Number(currentlyEquipped.items.rob_bonus) : null,
          defense_bonus: currentlyEquipped.items.defense_bonus ? Number(currentlyEquipped.items.defense_bonus) : null,
          revenue_min: currentlyEquipped.items.revenue_min,
          revenue_max: currentlyEquipped.items.revenue_max,
          insurance_percent: currentlyEquipped.items.insurance_percent ? Number(currentlyEquipped.items.insurance_percent) : null,
          sell_price: currentlyEquipped.items.sell_price,
          description: currentlyEquipped.items.description,
          flavor_text: currentlyEquipped.items.flavor_text,
        }
      : undefined

    return { success: true, previousItem }
  },

  /**
   * Unequip an item by slot
   */
  async unequipSlot(user_id: number, slot: EquipmentSlot): Promise<{ success: boolean; unequippedItem?: InventoryItem }> {
    const equipped = await prisma.user_inventory.findFirst({
      where: {
        user_id,
        is_equipped: true,
        slot,
      },
      include: { items: true },
    })

    if (!equipped) {
      return { success: false }
    }

    await prisma.user_inventory.update({
      where: { id: equipped.id },
      data: {
        is_equipped: false,
        slot: null,
        equipped_at: null,
      },
    })

    return {
      success: true,
      unequippedItem: {
        id: equipped.id,
        item_id: equipped.items.id,
        itemName: equipped.items.name,
        type: equipped.items.type,
        tier: equipped.items.tier,
        durability: equipped.durability,
        maxDurability: equipped.items.base_durability,
        is_equipped: false,
        slot: null,
        is_escrowed: equipped.is_escrowed,
        escrow_expires_at: equipped.escrow_expires_at,
        acquired_at: equipped.acquired_at,
        equipped_at: null,
        rob_bonus: equipped.items.rob_bonus ? Number(equipped.items.rob_bonus) : null,
        defense_bonus: equipped.items.defense_bonus ? Number(equipped.items.defense_bonus) : null,
        revenue_min: equipped.items.revenue_min,
        revenue_max: equipped.items.revenue_max,
        insurance_percent: equipped.items.insurance_percent ? Number(equipped.items.insurance_percent) : null,
        sell_price: equipped.items.sell_price,
        description: equipped.items.description,
        flavor_text: equipped.items.flavor_text,
      },
    }
  },

  /**
   * Degrade item durability
   * @param tx - Optional transaction client for atomic operations
   */
  async degradeItem(
    inventoryId: number,
    amount: number,
    tx?: PrismaTransactionClient
  ): Promise<{ newDurability: number; destroyed: boolean }> {
    const db = tx || prisma

    const item = await db.user_inventory.findUnique({
      where: { id: inventoryId },
      include: { items: true },
    })

    if (!item) {
      throw new Error('Item not found')
    }

    const newDurability = Math.max(0, item.durability - amount)
    const destroyed = newDurability <= DURABILITY_CONFIG.BREAK_THRESHOLD

    if (destroyed) {
      // Delete the item
      await db.user_inventory.delete({
        where: { id: inventoryId },
      })
    } else {
      // Update durability
      await db.user_inventory.update({
        where: { id: inventoryId },
        data: { durability: newDurability },
      })
    }

    return { newDurability, destroyed }
  },

  /**
   * Degrade attacker's equipped weapon (for robbery action)
   * HIGH-01 fix: Now uses random range (-2 to -3) per game design spec
   * @param tx - Optional transaction client for atomic operations
   */
  async degradeAttackerWeapon(user_id: number, tx?: PrismaTransactionClient): Promise<{ degraded: boolean; destroyed: boolean; itemName?: string }> {
    const db = tx || prisma

    const weapon = await db.user_inventory.findFirst({
      where: {
        user_id,
        is_equipped: true,
        slot: ITEM_TYPES.WEAPON,
      },
      include: { items: true },
    })

    if (!weapon) {
      return { degraded: false, destroyed: false }
    }

    // HIGH-01: Random decay within configured range
    const decayRange = DURABILITY_CONFIG.DECAY_PER_ROB_ATTACKER
    const decay = Math.floor(Math.random() * (decayRange.max - decayRange.min + 1)) + decayRange.min
    const result = await this.degradeItem(weapon.id, decay, tx)

    return {
      degraded: true,
      destroyed: result.destroyed,
      itemName: result.destroyed ? weapon.items.name : undefined,
    }
  },

  /**
   * Degrade defender's equipped armor (for robbery action)
   * HIGH-01 fix: Now uses random range (-2 to -3) per game design spec
   * @param tx - Optional transaction client for atomic operations
   */
  async degradeDefenderArmor(user_id: number, tx?: PrismaTransactionClient): Promise<{ degraded: boolean; destroyed: boolean; itemName?: string }> {
    const db = tx || prisma

    const armor = await db.user_inventory.findFirst({
      where: {
        user_id,
        is_equipped: true,
        slot: ITEM_TYPES.ARMOR,
      },
      include: { items: true },
    })

    if (!armor) {
      return { degraded: false, destroyed: false }
    }

    // HIGH-01: Random decay within configured range
    const decayRange = DURABILITY_CONFIG.DECAY_PER_ROB_DEFENDER
    const decay = Math.floor(Math.random() * (decayRange.max - decayRange.min + 1)) + decayRange.min
    const result = await this.degradeItem(armor.id, decay, tx)

    return {
      degraded: true,
      destroyed: result.destroyed,
      itemName: result.destroyed ? armor.items.name : undefined,
    }
  },

  /**
   * Claim item from escrow
   */
  async claimFromEscrow(user_id: number, inventoryId: number): Promise<{ success: boolean; reason?: string }> {
    const hasSpace = await this.hasSpace(user_id)

    if (!hasSpace) {
      return { success: false, reason: 'Inventory is full' }
    }

    const item = await prisma.user_inventory.findFirst({
      where: {
        id: inventoryId,
        user_id,
        is_escrowed: true,
      },
    })

    if (!item) {
      return { success: false, reason: 'Item not found in escrow' }
    }

    // Check if escrow expired
    if (item.escrow_expires_at && item.escrow_expires_at < new Date()) {
      // Delete expired item
      await prisma.user_inventory.delete({
        where: { id: inventoryId },
      })
      return { success: false, reason: 'Escrow expired' }
    }

    // Move from escrow to inventory
    await prisma.user_inventory.update({
      where: { id: inventoryId },
      data: {
        is_escrowed: false,
        escrow_expires_at: null,
      },
    })

    return { success: true }
  },

  /**
   * Get escrowed items
   */
  async getEscrowedItems(user_id: number): Promise<InventoryItem[]> {
    const items = await prisma.user_inventory.findMany({
      where: {
        user_id,
        is_escrowed: true,
      },
      include: {
        items: true,
      },
      orderBy: { escrow_expires_at: 'asc' },
    })

    return items.map((inv) => ({
      id: inv.id,
      item_id: inv.items.id,
      itemName: inv.items.name,
      type: inv.items.type,
      tier: inv.items.tier,
      durability: inv.durability,
      maxDurability: inv.items.base_durability,
      is_equipped: inv.is_equipped,
      slot: inv.slot,
      is_escrowed: inv.is_escrowed,
      escrow_expires_at: inv.escrow_expires_at,
      acquired_at: inv.acquired_at,
      equipped_at: inv.equipped_at,
      rob_bonus: inv.items.rob_bonus ? Number(inv.items.rob_bonus) : null,
      defense_bonus: inv.items.defense_bonus ? Number(inv.items.defense_bonus) : null,
      revenue_min: inv.items.revenue_min,
      revenue_max: inv.items.revenue_max,
      insurance_percent: inv.items.insurance_percent ? Number(inv.items.insurance_percent) : null,
      sell_price: inv.items.sell_price,
      description: inv.items.description,
      flavor_text: inv.items.flavor_text,
    }))
  },

  /**
   * Clean up expired escrow items (for scheduled job)
   */
  async cleanupExpiredEscrow(): Promise<number> {
    const result = await prisma.user_inventory.deleteMany({
      where: {
        is_escrowed: true,
        escrow_expires_at: { lt: new Date() },
      },
    })

    return result.count
  },

  /**
   * Sell an item
   */
  async sellItem(user_id: number, inventoryId: number): Promise<{ success: boolean; wealthGained: number; itemName: string }> {
    const item = await prisma.user_inventory.findFirst({
      where: { id: inventoryId, user_id, is_escrowed: false },
      include: { items: true },
    })

    if (!item) {
      throw new Error('Item not found in inventory')
    }

    if (item.is_equipped) {
      throw new Error('Cannot sell equipped item. Unequip first.')
    }

    const sell_price = item.items.sell_price ?? Math.floor(item.items.purchase_price / 2)

    await prisma.$transaction(async (tx) => {
      // Add wealth to user
      await tx.users.update({
        where: { id: user_id },
        data: { wealth: { increment: sell_price } },
      })

      // Remove item from inventory
      await tx.user_inventory.delete({
        where: { id: inventoryId },
      })

      // Record sale event
      await tx.game_events.create({
        data: {
          user_id,
          event_type: 'item_sell',
          wealth_change: sell_price,
          xp_change: 0,
          event_description: `Sold ${item.items.name} for $${sell_price.toLocaleString()}`,
          success: true,
        },
      })
    })

    return {
      success: true,
      wealthGained: sell_price,
      itemName: item.items.name,
    }
  },
}

export default InventoryService
