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
  itemId: number
  itemName: string
  itemType: string
  tier: string
  durability: number
  maxDurability: number
  isEquipped: boolean
  slot: string | null
  isEscrowed: boolean
  escrowExpiresAt: Date | null
  acquiredAt: Date
  equippedAt: Date | null
  // Item stats
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
  sellPrice: number | null
  description: string | null
  flavorText: string | null
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
  async getInventory(userId: number): Promise<InventoryItem[]> {
    const items = await prisma.userInventory.findMany({
      where: {
        userId,
        isEscrowed: false,
      },
      include: {
        item: true,
      },
      orderBy: [
        { isEquipped: 'desc' },
        { slot: 'asc' },
        { acquiredAt: 'desc' },
      ],
    })

    return items.map((inv) => ({
      id: inv.id,
      itemId: inv.item.id,
      itemName: inv.item.itemName,
      itemType: inv.item.itemType,
      tier: inv.item.tier,
      durability: inv.durability,
      maxDurability: inv.item.baseDurability,
      isEquipped: inv.isEquipped,
      slot: inv.slot,
      isEscrowed: inv.isEscrowed,
      escrowExpiresAt: inv.escrowExpiresAt,
      acquiredAt: inv.acquiredAt,
      equippedAt: inv.equippedAt,
      robBonus: inv.item.robBonus ? Number(inv.item.robBonus) : null,
      defenseBonus: inv.item.defenseBonus ? Number(inv.item.defenseBonus) : null,
      revenueMin: inv.item.revenueMin,
      revenueMax: inv.item.revenueMax,
      insurancePercent: inv.item.insurancePercent ? Number(inv.item.insurancePercent) : null,
      sellPrice: inv.item.sellPrice,
      description: inv.item.description,
      flavorText: inv.item.flavorText,
    }))
  },

  /**
   * Get user's equipped items
   */
  async getEquippedItems(userId: number): Promise<EquippedItems> {
    const equipped = await prisma.userInventory.findMany({
      where: {
        userId,
        isEquipped: true,
      },
      include: {
        item: true,
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
        itemId: inv.item.id,
        itemName: inv.item.itemName,
        itemType: inv.item.itemType,
        tier: inv.item.tier,
        durability: inv.durability,
        maxDurability: inv.item.baseDurability,
        isEquipped: inv.isEquipped,
        slot: inv.slot,
        isEscrowed: inv.isEscrowed,
        escrowExpiresAt: inv.escrowExpiresAt,
        acquiredAt: inv.acquiredAt,
        equippedAt: inv.equippedAt,
        robBonus: inv.item.robBonus ? Number(inv.item.robBonus) : null,
        defenseBonus: inv.item.defenseBonus ? Number(inv.item.defenseBonus) : null,
        revenueMin: inv.item.revenueMin,
        revenueMax: inv.item.revenueMax,
        insurancePercent: inv.item.insurancePercent ? Number(inv.item.insurancePercent) : null,
        sellPrice: inv.item.sellPrice,
        description: inv.item.description,
        flavorText: inv.item.flavorText,
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
  async getInventoryStats(userId: number): Promise<InventoryStats> {
    const [regularCount, escrowedCount] = await Promise.all([
      prisma.userInventory.count({
        where: { userId, isEscrowed: false },
      }),
      prisma.userInventory.count({
        where: { userId, isEscrowed: true },
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
  async hasSpace(userId: number): Promise<boolean> {
    const count = await prisma.userInventory.count({
      where: { userId, isEscrowed: false },
    })
    return count < MAX_INVENTORY_SIZE
  },

  /**
   * Check if inventory has space (with transaction client)
   * @internal Used by addItem when inside a transaction
   */
  async hasSpaceWithClient(userId: number, db: PrismaTransactionClient | typeof prisma): Promise<boolean> {
    const count = await db.userInventory.count({
      where: { userId, isEscrowed: false },
    })
    return count < MAX_INVENTORY_SIZE
  },

  /**
   * Add item to user's inventory
   * @param tx - Optional transaction client for atomic operations
   * CRIT-05 fix: Enforces 3-item escrow limit
   */
  async addItem(
    userId: number,
    itemId: number,
    options: { durability?: number; toEscrow?: boolean } = {},
    tx?: PrismaTransactionClient
  ): Promise<{ success: boolean; inventoryId?: number; toEscrow: boolean; reason?: string }> {
    const db = tx || prisma

    // Check both inventory and escrow counts
    const [inventoryCount, escrowCount] = await Promise.all([
      db.userInventory.count({ where: { userId, isEscrowed: false } }),
      db.userInventory.count({ where: { userId, isEscrowed: true } }),
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
    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { baseDurability: true },
    })

    if (!item) {
      throw new Error('Item not found')
    }

    const durability = options.durability ?? item.baseDurability

    // Calculate escrow expiry using constant
    const escrowExpiresAt = toEscrow
      ? new Date(Date.now() + ITEM_ESCROW_HOURS * 60 * 60 * 1000)
      : null

    const inventoryItem = await db.userInventory.create({
      data: {
        userId,
        itemId,
        durability,
        isEscrowed: toEscrow,
        escrowExpiresAt,
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
  async removeItem(userId: number, inventoryId: number): Promise<boolean> {
    // Check ownership
    const item = await prisma.userInventory.findFirst({
      where: { id: inventoryId, userId },
    })

    if (!item) {
      return false
    }

    // Can't remove equipped items
    if (item.isEquipped) {
      throw new Error('Cannot remove equipped item. Unequip first.')
    }

    await prisma.userInventory.delete({
      where: { id: inventoryId },
    })

    return true
  },

  /**
   * Equip an item
   */
  async equipItem(userId: number, inventoryId: number): Promise<{ success: boolean; previousItem?: InventoryItem }> {
    // Get the item to equip
    const itemToEquip = await prisma.userInventory.findFirst({
      where: { id: inventoryId, userId, isEscrowed: false },
      include: { item: true },
    })

    if (!itemToEquip) {
      throw new Error('Item not found in inventory')
    }

    if (itemToEquip.isEquipped) {
      return { success: true } // Already equipped
    }

    const slot = itemToEquip.item.itemType as EquipmentSlot

    // Get currently equipped item in that slot
    const currentlyEquipped = await prisma.userInventory.findFirst({
      where: {
        userId,
        isEquipped: true,
        slot,
      },
      include: { item: true },
    })

    // Transaction to swap equipment
    await prisma.$transaction(async (tx) => {
      // Unequip current item if any
      if (currentlyEquipped) {
        await tx.userInventory.update({
          where: { id: currentlyEquipped.id },
          data: {
            isEquipped: false,
            slot: null,
            equippedAt: null,
          },
        })
      }

      // Equip new item
      await tx.userInventory.update({
        where: { id: inventoryId },
        data: {
          isEquipped: true,
          slot,
          equippedAt: new Date(),
        },
      })
    })

    const previousItem = currentlyEquipped
      ? {
          id: currentlyEquipped.id,
          itemId: currentlyEquipped.item.id,
          itemName: currentlyEquipped.item.itemName,
          itemType: currentlyEquipped.item.itemType,
          tier: currentlyEquipped.item.tier,
          durability: currentlyEquipped.durability,
          maxDurability: currentlyEquipped.item.baseDurability,
          isEquipped: false,
          slot: null,
          isEscrowed: currentlyEquipped.isEscrowed,
          escrowExpiresAt: currentlyEquipped.escrowExpiresAt,
          acquiredAt: currentlyEquipped.acquiredAt,
          equippedAt: null,
          robBonus: currentlyEquipped.item.robBonus ? Number(currentlyEquipped.item.robBonus) : null,
          defenseBonus: currentlyEquipped.item.defenseBonus ? Number(currentlyEquipped.item.defenseBonus) : null,
          revenueMin: currentlyEquipped.item.revenueMin,
          revenueMax: currentlyEquipped.item.revenueMax,
          insurancePercent: currentlyEquipped.item.insurancePercent ? Number(currentlyEquipped.item.insurancePercent) : null,
          sellPrice: currentlyEquipped.item.sellPrice,
          description: currentlyEquipped.item.description,
          flavorText: currentlyEquipped.item.flavorText,
        }
      : undefined

    return { success: true, previousItem }
  },

  /**
   * Unequip an item by slot
   */
  async unequipSlot(userId: number, slot: EquipmentSlot): Promise<{ success: boolean; unequippedItem?: InventoryItem }> {
    const equipped = await prisma.userInventory.findFirst({
      where: {
        userId,
        isEquipped: true,
        slot,
      },
      include: { item: true },
    })

    if (!equipped) {
      return { success: false }
    }

    await prisma.userInventory.update({
      where: { id: equipped.id },
      data: {
        isEquipped: false,
        slot: null,
        equippedAt: null,
      },
    })

    return {
      success: true,
      unequippedItem: {
        id: equipped.id,
        itemId: equipped.item.id,
        itemName: equipped.item.itemName,
        itemType: equipped.item.itemType,
        tier: equipped.item.tier,
        durability: equipped.durability,
        maxDurability: equipped.item.baseDurability,
        isEquipped: false,
        slot: null,
        isEscrowed: equipped.isEscrowed,
        escrowExpiresAt: equipped.escrowExpiresAt,
        acquiredAt: equipped.acquiredAt,
        equippedAt: null,
        robBonus: equipped.item.robBonus ? Number(equipped.item.robBonus) : null,
        defenseBonus: equipped.item.defenseBonus ? Number(equipped.item.defenseBonus) : null,
        revenueMin: equipped.item.revenueMin,
        revenueMax: equipped.item.revenueMax,
        insurancePercent: equipped.item.insurancePercent ? Number(equipped.item.insurancePercent) : null,
        sellPrice: equipped.item.sellPrice,
        description: equipped.item.description,
        flavorText: equipped.item.flavorText,
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

    const item = await db.userInventory.findUnique({
      where: { id: inventoryId },
      include: { item: true },
    })

    if (!item) {
      throw new Error('Item not found')
    }

    const newDurability = Math.max(0, item.durability - amount)
    const destroyed = newDurability <= DURABILITY_CONFIG.BREAK_THRESHOLD

    if (destroyed) {
      // Delete the item
      await db.userInventory.delete({
        where: { id: inventoryId },
      })
    } else {
      // Update durability
      await db.userInventory.update({
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
  async degradeAttackerWeapon(userId: number, tx?: PrismaTransactionClient): Promise<{ degraded: boolean; destroyed: boolean; itemName?: string }> {
    const db = tx || prisma

    const weapon = await db.userInventory.findFirst({
      where: {
        userId,
        isEquipped: true,
        slot: ITEM_TYPES.WEAPON,
      },
      include: { item: true },
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
      itemName: result.destroyed ? weapon.item.itemName : undefined,
    }
  },

  /**
   * Degrade defender's equipped armor (for robbery action)
   * HIGH-01 fix: Now uses random range (-2 to -3) per game design spec
   * @param tx - Optional transaction client for atomic operations
   */
  async degradeDefenderArmor(userId: number, tx?: PrismaTransactionClient): Promise<{ degraded: boolean; destroyed: boolean; itemName?: string }> {
    const db = tx || prisma

    const armor = await db.userInventory.findFirst({
      where: {
        userId,
        isEquipped: true,
        slot: ITEM_TYPES.ARMOR,
      },
      include: { item: true },
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
      itemName: result.destroyed ? armor.item.itemName : undefined,
    }
  },

  /**
   * Claim item from escrow
   */
  async claimFromEscrow(userId: number, inventoryId: number): Promise<{ success: boolean; reason?: string }> {
    const hasSpace = await this.hasSpace(userId)

    if (!hasSpace) {
      return { success: false, reason: 'Inventory is full' }
    }

    const item = await prisma.userInventory.findFirst({
      where: {
        id: inventoryId,
        userId,
        isEscrowed: true,
      },
    })

    if (!item) {
      return { success: false, reason: 'Item not found in escrow' }
    }

    // Check if escrow expired
    if (item.escrowExpiresAt && item.escrowExpiresAt < new Date()) {
      // Delete expired item
      await prisma.userInventory.delete({
        where: { id: inventoryId },
      })
      return { success: false, reason: 'Escrow expired' }
    }

    // Move from escrow to inventory
    await prisma.userInventory.update({
      where: { id: inventoryId },
      data: {
        isEscrowed: false,
        escrowExpiresAt: null,
      },
    })

    return { success: true }
  },

  /**
   * Get escrowed items
   */
  async getEscrowedItems(userId: number): Promise<InventoryItem[]> {
    const items = await prisma.userInventory.findMany({
      where: {
        userId,
        isEscrowed: true,
      },
      include: {
        item: true,
      },
      orderBy: { escrowExpiresAt: 'asc' },
    })

    return items.map((inv) => ({
      id: inv.id,
      itemId: inv.item.id,
      itemName: inv.item.itemName,
      itemType: inv.item.itemType,
      tier: inv.item.tier,
      durability: inv.durability,
      maxDurability: inv.item.baseDurability,
      isEquipped: inv.isEquipped,
      slot: inv.slot,
      isEscrowed: inv.isEscrowed,
      escrowExpiresAt: inv.escrowExpiresAt,
      acquiredAt: inv.acquiredAt,
      equippedAt: inv.equippedAt,
      robBonus: inv.item.robBonus ? Number(inv.item.robBonus) : null,
      defenseBonus: inv.item.defenseBonus ? Number(inv.item.defenseBonus) : null,
      revenueMin: inv.item.revenueMin,
      revenueMax: inv.item.revenueMax,
      insurancePercent: inv.item.insurancePercent ? Number(inv.item.insurancePercent) : null,
      sellPrice: inv.item.sellPrice,
      description: inv.item.description,
      flavorText: inv.item.flavorText,
    }))
  },

  /**
   * Clean up expired escrow items (for scheduled job)
   */
  async cleanupExpiredEscrow(): Promise<number> {
    const result = await prisma.userInventory.deleteMany({
      where: {
        isEscrowed: true,
        escrowExpiresAt: { lt: new Date() },
      },
    })

    return result.count
  },

  /**
   * Sell an item
   */
  async sellItem(userId: number, inventoryId: number): Promise<{ success: boolean; wealthGained: number; itemName: string }> {
    const item = await prisma.userInventory.findFirst({
      where: { id: inventoryId, userId, isEscrowed: false },
      include: { item: true },
    })

    if (!item) {
      throw new Error('Item not found in inventory')
    }

    if (item.isEquipped) {
      throw new Error('Cannot sell equipped item. Unequip first.')
    }

    const sellPrice = item.item.sellPrice ?? Math.floor(item.item.purchasePrice / 2)

    await prisma.$transaction(async (tx) => {
      // Add wealth to user
      await tx.user.update({
        where: { id: userId },
        data: { wealth: { increment: sellPrice } },
      })

      // Remove item from inventory
      await tx.userInventory.delete({
        where: { id: inventoryId },
      })

      // Record sale event
      await tx.gameEvent.create({
        data: {
          userId,
          eventType: 'item_sell',
          wealthChange: sellPrice,
          xpChange: 0,
          eventDescription: `Sold ${item.item.itemName} for $${sellPrice.toLocaleString()}`,
          success: true,
        },
      })
    })

    return {
      success: true,
      wealthGained: sellPrice,
      itemName: item.item.itemName,
    }
  },
}

export default InventoryService
