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
  acquired_at: Date | null
  is_escrowed: boolean | null
  escrow_expires_at: Date | null
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
  crate_tier: string
  drop_type: 'weapon' | 'armor' | 'wealth' | 'title'
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
  crate_tier: string
  drop_type: string
  itemName?: string
  item_tier?: string
  wealth_amount?: number
  title_name?: string
  title_was_duplicate?: boolean
  duplicate_conversion?: number
  opened_at: Date | null
}

// =============================================================================
// CRATE SERVICE
// =============================================================================

export const CrateService = {
  /**
   * Get user's crate inventory
   */
  async getCrates(user_id: number): Promise<CrateInventory> {
    const crates = await prisma.user_crates.findMany({
      where: { user_id },
      orderBy: [
        { is_escrowed: 'asc' },
        { acquired_at: 'asc' },
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
      byTier[crate.tier] = (byTier[crate.tier] || 0) + 1
      if (crate.is_escrowed) {
        escrowedCount++
      } else {
        regularCount++
      }
    }

    // Check if can open
    const { canOpen, reason } = await this.canOpenCrate(user_id)

    return {
      crates: crates.map((c) => ({
        id: c.id,
        tier: c.tier,
        source: c.source,
        acquired_at: c.acquired_at,
        is_escrowed: c.is_escrowed,
        escrow_expires_at: c.escrow_expires_at,
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
    user_id: number,
    tier: CrateTier,
    source: CrateSource,
    tx?: PrismaTransactionClient
  ): Promise<AwardCrateResult> {
    // If called outside a transaction, wrap in one for locking
    if (!tx) {
      return prisma.$transaction(async (innerTx) => {
        return this.awardCrateInternal(user_id, tier, source, innerTx)
      })
    }
    return this.awardCrateInternal(user_id, tier, source, tx)
  },

  /**
   * Internal crate award with locking (must be called within transaction)
   * @internal
   */
  async awardCrateInternal(
    user_id: number,
    tier: CrateTier,
    source: CrateSource,
    tx: PrismaTransactionClient
  ): Promise<AwardCrateResult> {
    // HIGH-03 fix: Lock user row to prevent concurrent crate allocation race
    // This ensures only one request can check counts and add crate at a time
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user_id} FOR UPDATE`

    // Count current crates (now safe from race conditions)
    const [regularCount, escrowCount] = await Promise.all([
      tx.user_crates.count({
        where: { user_id, is_escrowed: false },
      }),
      tx.user_crates.count({
        where: { user_id, is_escrowed: true },
      }),
    ])

    // Determine where crate goes
    if (regularCount < MAX_CRATES) {
      // Goes to regular inventory
      const crate = await tx.user_crates.create({
        data: {
          user_id,
          tier,
          source,
          is_escrowed: false,
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
      const escrow_expires_at = new Date(Date.now() + CRATE_ESCROW_HOURS * 60 * 60 * 1000)

      const crate = await tx.user_crates.create({
        data: {
          user_id,
          tier,
          source,
          is_escrowed: true,
          escrow_expires_at,
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
  async claimFromEscrow(user_id: number, crateId: number): Promise<{ success: boolean; reason?: string }> {
    // Check regular inventory space
    const regularCount = await prisma.user_crates.count({
      where: { user_id, is_escrowed: false },
    })

    if (regularCount >= MAX_CRATES) {
      return { success: false, reason: 'Crate inventory is full' }
    }

    // Find the escrowed crate
    const crate = await prisma.user_crates.findFirst({
      where: { id: crateId, user_id, is_escrowed: true },
    })

    if (!crate) {
      return { success: false, reason: 'Crate not found in escrow' }
    }

    // Check if expired
    if (crate.escrow_expires_at && crate.escrow_expires_at < new Date()) {
      await prisma.user_crates.delete({ where: { id: crateId } })
      return { success: false, reason: 'Crate has expired' }
    }

    // Move to regular inventory
    await prisma.user_crates.update({
      where: { id: crateId },
      data: {
        is_escrowed: false,
        escrow_expires_at: null,
      },
    })

    return { success: true }
  },

  /**
   * Check if user can open a crate
   */
  async canOpenCrate(user_id: number): Promise<{ canOpen: boolean; reason?: string }> {
    // Check if user has any crates
    const crateCount = await prisma.user_crates.count({
      where: { user_id, is_escrowed: false },
    })

    if (crateCount === 0) {
      return { canOpen: false, reason: 'No crates to open' }
    }

    // Check inventory space (items might drop)
    const inventoryCount = await prisma.user_inventory.count({
      where: { user_id, is_escrowed: false },
    })

    if (inventoryCount >= MAX_INVENTORY_SIZE) {
      return { canOpen: false, reason: 'Inventory is full. Sell or escrow items first.' }
    }

    return { canOpen: true }
  },

  /**
   * Get the oldest unopened crate (for chat command)
   */
  async getOldestCrate(user_id: number) {
    return prisma.user_crates.findFirst({
      where: { user_id, is_escrowed: false },
      orderBy: { acquired_at: 'asc' },
    })
  },

  /**
   * Open a specific crate (or oldest if not specified)
   * CRIT-06 fix: All operations now wrapped in single transaction for atomicity
   */
  async openCrate(user_id: number, crateId?: number): Promise<CrateOpenResult> {
    // Get crate (pre-check outside transaction is safe - just reading)
    const crate = crateId
      ? await prisma.user_crates.findFirst({
          where: { id: crateId, user_id, is_escrowed: false },
        })
      : await this.getOldestCrate(user_id)

    if (!crate) {
      return {
        success: false,
        error: 'No crate found',
        crateId: 0,
        crate_tier: '',
        drop_type: 'wealth',
        reward: {},
      }
    }

    // Check if can open (pre-check outside transaction)
    const { canOpen, reason } = await this.canOpenCrate(user_id)
    if (!canOpen) {
      return {
        success: false,
        error: reason,
        crateId: crate.id,
        crate_tier: crate.tier,
        drop_type: 'wealth',
        reward: {},
      }
    }

    // Roll drop type (pure function, safe outside transaction)
    const drop_type = this.rollDropType(crate.tier as CrateTier)
    const result: CrateOpenResult = {
      success: true,
      crateId: crate.id,
      crate_tier: crate.tier,
      drop_type,
      reward: {},
    }

    // CRIT-06 fix: Execute ALL reward processing in single atomic transaction
    await prisma.$transaction(async (tx) => {
      // Re-verify crate exists and belongs to user (prevents race condition)
      const verifiedCrate = await tx.user_crates.findFirst({
        where: { id: crate.id, user_id, is_escrowed: false },
      })
      if (!verifiedCrate) {
        throw new Error('Crate no longer available')
      }

      // Process reward based on drop type
      if (drop_type === 'weapon' || drop_type === 'armor') {
        const item_tier = this.rollItemTier(crate.tier as CrateTier)
        const itemType = drop_type === 'weapon' ? ITEM_TYPES.WEAPON : ITEM_TYPES.ARMOR

        // Get random item of that type and tier
        const items = await tx.items.findMany({
          where: { type: itemType, tier: item_tier },
        })

        if (items.length === 0) {
          // Fallback to wealth if no items available
          const wealth_amount = this.rollWealthAmount(crate.tier as CrateTier)
          await tx.users.update({
            where: { id: user_id },
            data: { wealth: { increment: wealth_amount } },
          })
          result.drop_type = 'wealth'
          result.reward.wealth = { amount: wealth_amount }
        } else {
          const item = items[Math.floor(Math.random() * items.length)]
          const addResult = await InventoryService.addItem(user_id, item.id, {}, tx)

          result.reward.item = {
            id: item.id,
            name: item.name,
            type: item.type,
            tier: item.tier,
            inventoryId: addResult.inventoryId!,
            toEscrow: addResult.toEscrow,
          }
        }
      } else if (drop_type === 'wealth') {
        const wealth_amount = this.rollWealthAmount(crate.tier as CrateTier)
        await tx.users.update({
          where: { id: user_id },
          data: { wealth: { increment: wealth_amount } },
        })
        result.reward.wealth = { amount: wealth_amount }
      } else if (drop_type === 'title') {
        const titleResult = await this.rollTitle(user_id, crate.tier as CrateTier, tx)
        result.reward.title = titleResult
      }

      // Record the crate open
      await tx.crate_opens.create({
        data: {
          user_id,
          crate_tier: crate.tier,
          drop_type: result.drop_type,
          item_id: result.reward.item?.id ?? null,
          item_tier: result.reward.item?.tier ?? null,
          wealth_amount: result.reward.wealth?.amount ?? null,
          title_name: result.reward.title?.title ?? null,
          title_was_duplicate: result.reward.title?.isDuplicate ?? null,
          duplicate_conversion: result.reward.title?.duplicateValue ?? null,
        },
      })

      // Delete the crate
      await tx.user_crates.delete({ where: { id: crate.id } })
    })

    // MED-01 fix: Wrap non-critical external calls
    // Update leaderboard (secondary operation, safe outside transaction)
    await safeVoid(
      () => LeaderboardService.updateSnapshot(user_id, { crates_opened: 1 }),
      'crate.service:leaderboard'
    )

    // Track legendary item achievement (secondary operation)
    if (result.reward.item?.tier === ITEM_TIERS.LEGENDARY) {
      await safeVoid(
        () => AchievementService.incrementProgress(
          user_id,
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
  async batchOpen(user_id: number, count: number): Promise<BatchOpenResult> {
    const results: CrateOpenResult[] = []
    let stoppedEarly = false
    let stopReason: string | undefined

    for (let i = 0; i < count; i++) {
      // Check if can continue
      const { canOpen, reason } = await this.canOpenCrate(user_id)
      if (!canOpen) {
        stoppedEarly = true
        stopReason = reason
        break
      }

      const result = await this.openCrate(user_id)
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
  rollDropType(crate_tier: CrateTier): 'weapon' | 'armor' | 'wealth' | 'title' {
    const table = CRATE_DROP_TABLES[crate_tier]
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
  rollItemTier(crate_tier: CrateTier): ItemTier {
    const weights = CRATE_DROP_TABLES[crate_tier].item_tierWeights
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
  rollWealthAmount(crate_tier: CrateTier): number {
    const range = CRATE_DROP_TABLES[crate_tier].wealthRange
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
  },

  /**
   * Roll title from crate tier, check for duplicates
   * @param tx - Optional transaction client for atomic operations
   */
  async rollTitle(user_id: number, crate_tier: CrateTier, tx?: PrismaTransactionClient): Promise<TitleReward> {
    const db = tx || prisma

    // Get all titles for this crate tier
    const titles = await db.crate_titles.findMany({
      where: { tier: crate_tier },
    })

    if (titles.length === 0) {
      // No titles for this tier, give wealth instead
      const duplicateValue = CRATE_TITLE_DUPLICATE_VALUES[crate_tier]
      await db.users.update({
        where: { id: user_id },
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
    const existingTitle = await db.user_titles.findFirst({
      where: { user_id, title: title.name },
    })

    if (existingTitle) {
      // Duplicate - give wealth instead
      const duplicateValue = title.duplicate_value
      await db.users.update({
        where: { id: user_id },
        data: { wealth: { increment: duplicateValue } },
      })
      return {
        title: title.name,
        isDuplicate: true,
        duplicateValue,
      }
    }

    // New title - unlock it (inline to use transaction)
    await db.user_titles.create({
      data: { user_id, title: title.name },
    })

    return {
      title: title.name,
      isDuplicate: false,
    }
  },

  /**
   * Clean up expired escrow crates
   */
  async cleanupExpiredEscrow(): Promise<number> {
    const result = await prisma.user_crates.deleteMany({
      where: {
        is_escrowed: true,
        escrow_expires_at: { lt: new Date() },
      },
    })

    return result.count
  },

  /**
   * Get crate open history
   */
  async getOpenHistory(user_id: number, limit: number = 20): Promise<CrateOpenHistory[]> {
    const history = await prisma.crate_opens.findMany({
      where: { user_id },
      include: { items: true },
      orderBy: { opened_at: 'desc' },
      take: limit,
    })

    return history.map((h) => ({
      id: h.id,
      crate_tier: h.crate_tier,
      drop_type: h.drop_type,
      itemName: h.items?.name ?? undefined,
      item_tier: h.item_tier ?? undefined,
      wealth_amount: h.wealth_amount ?? undefined,
      title_name: h.title_name ?? undefined,
      title_was_duplicate: h.title_was_duplicate ?? undefined,
      duplicate_conversion: h.duplicate_conversion ?? undefined,
      opened_at: h.opened_at,
    }))
  },

  /**
   * Get crate count by tier for a user
   */
  async getCrateCounts(user_id: number): Promise<Record<string, number>> {
    const crates = await prisma.user_crates.groupBy({
      by: ['tier'],
      where: { user_id, is_escrowed: false },
      _count: { _all: true },
    })

    const counts: Record<string, number> = {
      [CRATE_TIERS.COMMON]: 0,
      [CRATE_TIERS.UNCOMMON]: 0,
      [CRATE_TIERS.RARE]: 0,
      [CRATE_TIERS.LEGENDARY]: 0,
    }

    for (const c of crates) {
      counts[c.tier] = c._count._all
    }

    return counts
  },
}

export default CrateService
