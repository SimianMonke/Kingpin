import { prisma } from '../db'
import { safeVoid } from '../utils'
import {
  CRATE_TIERS,
  CRATE_DROP_TABLES,
  CRATE_TITLE_DUPLICATE_VALUES,
  MAX_CRATES,
  MAX_CRATE_ESCROW,
  CRATE_ESCROW_HOURS,
  ITEM_TIERS,
  ITEM_TYPES,
  MAX_INVENTORY_SIZE,
  ACHIEVEMENT_REQUIREMENT_TYPES,
} from '../game'
import type { CrateTier, CrateSource, ItemTier } from '../game/constants'
import { InventoryService, type PrismaTransactionClient } from './inventory.service'
import { TitleService } from './title.service'
import { LeaderboardService } from './leaderboard.service'
import { AchievementService } from './achievement.service'

// =============================================================================
// CRATE SERVICE TYPES
// =============================================================================

export interface CrateInfo {
  id: number
  tier: string
  source: string | null
  acquiredAt: Date
  isEscrowed: boolean
  escrowExpiresAt: Date | null
}

export interface CrateStats {
  total: number
  maxCrates: number
  escrowedCount: number
  maxEscrow: number
  byTier: Record<string, number>
}

export interface CrateInventory {
  crates: CrateInfo[]
  stats: CrateStats
  canOpen: boolean
  canOpenReason?: string
}

export interface AwardCrateResult {
  success: boolean
  crateId?: number
  toEscrow: boolean
  lost: boolean
  reason?: string
}

export interface ItemReward {
  id: number
  name: string
  type: string
  tier: string
  inventoryId: number
  toEscrow: boolean
}

export interface WealthReward {
  amount: number
}

export interface TitleReward {
  title: string
  isDuplicate: boolean
  duplicateValue?: number
}

export interface CrateOpenResult {
  success: boolean
  error?: string
  crateId: number
  crateTier: string
  dropType: 'weapon' | 'armor' | 'wealth' | 'title'
  reward: {
    item?: ItemReward
    wealth?: WealthReward
    title?: TitleReward
  }
}

export interface BatchOpenResult {
  success: boolean
  results: CrateOpenResult[]
  stats: {
    requested: number
    opened: number
    stoppedEarly: boolean
    stopReason?: string
  }
}

export interface CrateOpenHistory {
  id: number
  crateTier: string
  dropType: string
  itemName?: string
  itemTier?: string
  wealthAmount?: number
  titleName?: string
  titleWasDuplicate?: boolean
  duplicateConversion?: number
  openedAt: Date
}

// =============================================================================
// CRATE SERVICE
// =============================================================================

export const CrateService = {
  /**
   * Get user's crate inventory
   */
  async getCrates(userId: number): Promise<CrateInventory> {
    const crates = await prisma.userCrate.findMany({
      where: { userId },
      orderBy: [
        { isEscrowed: 'asc' },
        { acquiredAt: 'asc' },
      ],
    })

    // Count by tier
    const byTier: Record<string, number> = {
      [CRATE_TIERS.COMMON]: 0,
      [CRATE_TIERS.UNCOMMON]: 0,
      [CRATE_TIERS.RARE]: 0,
      [CRATE_TIERS.LEGENDARY]: 0,
    }

    let escrowedCount = 0
    let regularCount = 0

    for (const crate of crates) {
      byTier[crate.crateTier] = (byTier[crate.crateTier] || 0) + 1
      if (crate.isEscrowed) {
        escrowedCount++
      } else {
        regularCount++
      }
    }

    // Check if can open
    const { canOpen, reason } = await this.canOpenCrate(userId)

    return {
      crates: crates.map((c) => ({
        id: c.id,
        tier: c.crateTier,
        source: c.source,
        acquiredAt: c.acquiredAt,
        isEscrowed: c.isEscrowed,
        escrowExpiresAt: c.escrowExpiresAt,
      })),
      stats: {
        total: regularCount,
        maxCrates: MAX_CRATES,
        escrowedCount,
        maxEscrow: MAX_CRATE_ESCROW,
        byTier,
      },
      canOpen,
      canOpenReason: reason,
    }
  },

  /**
   * Award a crate to user (handles inventory/escrow limits)
   * HIGH-03 fix: Uses row locking to prevent race conditions
   * @param tx - Optional transaction client for atomic operations
   */
  async awardCrate(
    userId: number,
    tier: CrateTier,
    source: CrateSource,
    tx?: PrismaTransactionClient
  ): Promise<AwardCrateResult> {
    // If called outside a transaction, wrap in one for locking
    if (!tx) {
      return prisma.$transaction(async (innerTx) => {
        return this.awardCrateInternal(userId, tier, source, innerTx)
      })
    }
    return this.awardCrateInternal(userId, tier, source, tx)
  },

  /**
   * Internal crate award with locking (must be called within transaction)
   * @internal
   */
  async awardCrateInternal(
    userId: number,
    tier: CrateTier,
    source: CrateSource,
    tx: PrismaTransactionClient
  ): Promise<AwardCrateResult> {
    // HIGH-03 fix: Lock user row to prevent concurrent crate allocation race
    // This ensures only one request can check counts and add crate at a time
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`

    // Count current crates (now safe from race conditions)
    const [regularCount, escrowCount] = await Promise.all([
      tx.userCrate.count({
        where: { userId, isEscrowed: false },
      }),
      tx.userCrate.count({
        where: { userId, isEscrowed: true },
      }),
    ])

    // Determine where crate goes
    if (regularCount < MAX_CRATES) {
      // Goes to regular inventory
      const crate = await tx.userCrate.create({
        data: {
          userId,
          crateTier: tier,
          source,
          isEscrowed: false,
        },
      })

      return {
        success: true,
        crateId: crate.id,
        toEscrow: false,
        lost: false,
      }
    }

    if (escrowCount < MAX_CRATE_ESCROW) {
      // Goes to escrow
      const escrowExpiresAt = new Date(Date.now() + CRATE_ESCROW_HOURS * 60 * 60 * 1000)

      const crate = await tx.userCrate.create({
        data: {
          userId,
          crateTier: tier,
          source,
          isEscrowed: true,
          escrowExpiresAt,
        },
      })

      return {
        success: true,
        crateId: crate.id,
        toEscrow: true,
        lost: false,
        reason: `Crate inventory full. Crate sent to escrow (expires in ${CRATE_ESCROW_HOURS} hour).`,
      }
    }

    // Both full - crate is lost
    return {
      success: false,
      toEscrow: false,
      lost: true,
      reason: 'Crate inventory and escrow are both full. Crate was lost!',
    }
  },

  /**
   * Claim crate from escrow to main inventory
   */
  async claimFromEscrow(userId: number, crateId: number): Promise<{ success: boolean; reason?: string }> {
    // Check regular inventory space
    const regularCount = await prisma.userCrate.count({
      where: { userId, isEscrowed: false },
    })

    if (regularCount >= MAX_CRATES) {
      return { success: false, reason: 'Crate inventory is full' }
    }

    // Find the escrowed crate
    const crate = await prisma.userCrate.findFirst({
      where: { id: crateId, userId, isEscrowed: true },
    })

    if (!crate) {
      return { success: false, reason: 'Crate not found in escrow' }
    }

    // Check if expired
    if (crate.escrowExpiresAt && crate.escrowExpiresAt < new Date()) {
      await prisma.userCrate.delete({ where: { id: crateId } })
      return { success: false, reason: 'Crate has expired' }
    }

    // Move to regular inventory
    await prisma.userCrate.update({
      where: { id: crateId },
      data: {
        isEscrowed: false,
        escrowExpiresAt: null,
      },
    })

    return { success: true }
  },

  /**
   * Check if user can open a crate
   */
  async canOpenCrate(userId: number): Promise<{ canOpen: boolean; reason?: string }> {
    // Check if user has any crates
    const crateCount = await prisma.userCrate.count({
      where: { userId, isEscrowed: false },
    })

    if (crateCount === 0) {
      return { canOpen: false, reason: 'No crates to open' }
    }

    // Check inventory space (items might drop)
    const inventoryCount = await prisma.userInventory.count({
      where: { userId, isEscrowed: false },
    })

    if (inventoryCount >= MAX_INVENTORY_SIZE) {
      return { canOpen: false, reason: 'Inventory is full. Sell or escrow items first.' }
    }

    return { canOpen: true }
  },

  /**
   * Get the oldest unopened crate (for chat command)
   */
  async getOldestCrate(userId: number) {
    return prisma.userCrate.findFirst({
      where: { userId, isEscrowed: false },
      orderBy: { acquiredAt: 'asc' },
    })
  },

  /**
   * Open a specific crate (or oldest if not specified)
   * CRIT-06 fix: All operations now wrapped in single transaction for atomicity
   */
  async openCrate(userId: number, crateId?: number): Promise<CrateOpenResult> {
    // Get crate (pre-check outside transaction is safe - just reading)
    const crate = crateId
      ? await prisma.userCrate.findFirst({
          where: { id: crateId, userId, isEscrowed: false },
        })
      : await this.getOldestCrate(userId)

    if (!crate) {
      return {
        success: false,
        error: 'No crate found',
        crateId: 0,
        crateTier: '',
        dropType: 'wealth',
        reward: {},
      }
    }

    // Check if can open (pre-check outside transaction)
    const { canOpen, reason } = await this.canOpenCrate(userId)
    if (!canOpen) {
      return {
        success: false,
        error: reason,
        crateId: crate.id,
        crateTier: crate.crateTier,
        dropType: 'wealth',
        reward: {},
      }
    }

    // Roll drop type (pure function, safe outside transaction)
    const dropType = this.rollDropType(crate.crateTier as CrateTier)
    const result: CrateOpenResult = {
      success: true,
      crateId: crate.id,
      crateTier: crate.crateTier,
      dropType,
      reward: {},
    }

    // CRIT-06 fix: Execute ALL reward processing in single atomic transaction
    await prisma.$transaction(async (tx) => {
      // Re-verify crate exists and belongs to user (prevents race condition)
      const verifiedCrate = await tx.userCrate.findFirst({
        where: { id: crate.id, userId, isEscrowed: false },
      })
      if (!verifiedCrate) {
        throw new Error('Crate no longer available')
      }

      // Process reward based on drop type
      if (dropType === 'weapon' || dropType === 'armor') {
        const itemTier = this.rollItemTier(crate.crateTier as CrateTier)
        const itemType = dropType === 'weapon' ? ITEM_TYPES.WEAPON : ITEM_TYPES.ARMOR

        // Get random item of that type and tier
        const items = await tx.item.findMany({
          where: { itemType, tier: itemTier },
        })

        if (items.length === 0) {
          // Fallback to wealth if no items available
          const wealthAmount = this.rollWealthAmount(crate.crateTier as CrateTier)
          await tx.user.update({
            where: { id: userId },
            data: { wealth: { increment: wealthAmount } },
          })
          result.dropType = 'wealth'
          result.reward.wealth = { amount: wealthAmount }
        } else {
          const item = items[Math.floor(Math.random() * items.length)]
          const addResult = await InventoryService.addItem(userId, item.id, {}, tx)

          result.reward.item = {
            id: item.id,
            name: item.itemName,
            type: item.itemType,
            tier: item.tier,
            inventoryId: addResult.inventoryId!,
            toEscrow: addResult.toEscrow,
          }
        }
      } else if (dropType === 'wealth') {
        const wealthAmount = this.rollWealthAmount(crate.crateTier as CrateTier)
        await tx.user.update({
          where: { id: userId },
          data: { wealth: { increment: wealthAmount } },
        })
        result.reward.wealth = { amount: wealthAmount }
      } else if (dropType === 'title') {
        const titleResult = await this.rollTitle(userId, crate.crateTier as CrateTier, tx)
        result.reward.title = titleResult
      }

      // Record the crate open
      await tx.crateOpen.create({
        data: {
          userId,
          crateTier: crate.crateTier,
          dropType: result.dropType,
          itemId: result.reward.item?.id ?? null,
          itemTier: result.reward.item?.tier ?? null,
          wealthAmount: result.reward.wealth?.amount ?? null,
          titleName: result.reward.title?.title ?? null,
          titleWasDuplicate: result.reward.title?.isDuplicate ?? null,
          duplicateConversion: result.reward.title?.duplicateValue ?? null,
        },
      })

      // Delete the crate
      await tx.userCrate.delete({ where: { id: crate.id } })
    })

    // MED-01 fix: Wrap non-critical external calls
    // Update leaderboard (secondary operation, safe outside transaction)
    await safeVoid(
      () => LeaderboardService.updateSnapshot(userId, { cratesOpened: 1 }),
      'crate.service:leaderboard'
    )

    // Track legendary item achievement (secondary operation)
    if (result.reward.item?.tier === ITEM_TIERS.LEGENDARY) {
      await safeVoid(
        () => AchievementService.incrementProgress(
          userId,
          ACHIEVEMENT_REQUIREMENT_TYPES.LEGENDARY_CRATE_ITEM,
          1
        ),
        'crate.service:achievement:legendaryItem'
      )
    }

    return result
  },

  /**
   * Batch open multiple crates
   */
  async batchOpen(userId: number, count: number): Promise<BatchOpenResult> {
    const results: CrateOpenResult[] = []
    let stoppedEarly = false
    let stopReason: string | undefined

    for (let i = 0; i < count; i++) {
      // Check if can continue
      const { canOpen, reason } = await this.canOpenCrate(userId)
      if (!canOpen) {
        stoppedEarly = true
        stopReason = reason
        break
      }

      const result = await this.openCrate(userId)
      if (!result.success) {
        stoppedEarly = true
        stopReason = result.error
        break
      }

      results.push(result)
    }

    return {
      success: results.length > 0,
      results,
      stats: {
        requested: count,
        opened: results.length,
        stoppedEarly,
        stopReason,
      },
    }
  },

  /**
   * Roll drop type from crate tier
   */
  rollDropType(crateTier: CrateTier): 'weapon' | 'armor' | 'wealth' | 'title' {
    const table = CRATE_DROP_TABLES[crateTier]
    const roll = Math.random()

    let cumulative = 0
    cumulative += table.weapon
    if (roll < cumulative) return 'weapon'

    cumulative += table.armor
    if (roll < cumulative) return 'armor'

    cumulative += table.wealth
    if (roll < cumulative) return 'wealth'

    return 'title'
  },

  /**
   * Roll item tier based on crate tier
   */
  rollItemTier(crateTier: CrateTier): ItemTier {
    const weights = CRATE_DROP_TABLES[crateTier].itemTierWeights
    const roll = Math.random()

    let cumulative = 0
    for (const [tier, weight] of Object.entries(weights)) {
      cumulative += weight
      if (roll < cumulative) {
        return tier as ItemTier
      }
    }

    return ITEM_TIERS.COMMON // Fallback
  },

  /**
   * Roll wealth amount within crate tier range
   */
  rollWealthAmount(crateTier: CrateTier): number {
    const range = CRATE_DROP_TABLES[crateTier].wealthRange
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
  },

  /**
   * Roll title from crate tier, check for duplicates
   * @param tx - Optional transaction client for atomic operations
   */
  async rollTitle(userId: number, crateTier: CrateTier, tx?: PrismaTransactionClient): Promise<TitleReward> {
    const db = tx || prisma

    // Get all titles for this crate tier
    const titles = await db.crateTitle.findMany({
      where: { crateTier },
    })

    if (titles.length === 0) {
      // No titles for this tier, give wealth instead
      const duplicateValue = CRATE_TITLE_DUPLICATE_VALUES[crateTier]
      await db.user.update({
        where: { id: userId },
        data: { wealth: { increment: duplicateValue } },
      })
      return {
        title: 'Unknown Title',
        isDuplicate: true,
        duplicateValue,
      }
    }

    // Pick random title
    const title = titles[Math.floor(Math.random() * titles.length)]

    // Check if user already has this title (uses db client if in transaction)
    const existingTitle = await db.userTitle.findFirst({
      where: { userId, title: title.titleName },
    })

    if (existingTitle) {
      // Duplicate - give wealth instead
      const duplicateValue = title.duplicateValue
      await db.user.update({
        where: { id: userId },
        data: { wealth: { increment: duplicateValue } },
      })
      return {
        title: title.titleName,
        isDuplicate: true,
        duplicateValue,
      }
    }

    // New title - unlock it (inline to use transaction)
    await db.userTitle.create({
      data: { userId, title: title.titleName },
    })

    return {
      title: title.titleName,
      isDuplicate: false,
    }
  },

  /**
   * Clean up expired escrow crates
   */
  async cleanupExpiredEscrow(): Promise<number> {
    const result = await prisma.userCrate.deleteMany({
      where: {
        isEscrowed: true,
        escrowExpiresAt: { lt: new Date() },
      },
    })

    return result.count
  },

  /**
   * Get crate open history
   */
  async getOpenHistory(userId: number, limit: number = 20): Promise<CrateOpenHistory[]> {
    const history = await prisma.crateOpen.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { openedAt: 'desc' },
      take: limit,
    })

    return history.map((h) => ({
      id: h.id,
      crateTier: h.crateTier,
      dropType: h.dropType,
      itemName: h.item?.itemName ?? undefined,
      itemTier: h.itemTier ?? undefined,
      wealthAmount: h.wealthAmount ?? undefined,
      titleName: h.titleName ?? undefined,
      titleWasDuplicate: h.titleWasDuplicate ?? undefined,
      duplicateConversion: h.duplicateConversion ?? undefined,
      openedAt: h.openedAt,
    }))
  },

  /**
   * Get crate count by tier for a user
   */
  async getCrateCounts(userId: number): Promise<Record<string, number>> {
    const crates = await prisma.userCrate.groupBy({
      by: ['crateTier'],
      where: { userId, isEscrowed: false },
      _count: { id: true },
    })

    const counts: Record<string, number> = {
      [CRATE_TIERS.COMMON]: 0,
      [CRATE_TIERS.UNCOMMON]: 0,
      [CRATE_TIERS.RARE]: 0,
      [CRATE_TIERS.LEGENDARY]: 0,
    }

    for (const c of crates) {
      counts[c.crateTier] = c._count.id
    }

    return counts
  },
}

export default CrateService
