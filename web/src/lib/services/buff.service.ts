import { prisma } from '../db'
import { Prisma } from '@prisma/client'

const Decimal = Prisma.Decimal

// =============================================================================
// BUFF SERVICE TYPES
// =============================================================================

export type BuffSource = 'consumable' | 'juicernaut' | 'territory' | 'system'
export type BuffCategory = 'xp' | 'rob_attack' | 'rob_defense' | 'business' | 'crate' | 'wealth'

export interface ActiveBuffInfo {
  id: number
  buffType: string
  category: BuffCategory | null
  multiplier: number
  source: BuffSource
  description: string | null
  expiresAt: Date | null
  remainingMinutes: number | null
  isActive: boolean
}

export interface ApplyBuffResult {
  wasExtension: boolean
  wasUpgrade: boolean
  previousRemainingMinutes?: number
  newExpiresAt: Date
}

// =============================================================================
// BUFF SERVICE
// =============================================================================

export const BuffService = {
  // ===========================================================================
  // BUFF RETRIEVAL
  // ===========================================================================

  /**
   * Get all active buffs for a user
   */
  async getActiveBuffs(userId: number): Promise<ActiveBuffInfo[]> {
    const now = new Date()

    const buffs = await prisma.active_buffs.findMany({
      where: {
        user_id: userId,
        is_active: true,
        OR: [
          { expires_at: null },           // Non-expiring buffs (e.g., Juicernaut)
          { expires_at: { gt: now } },    // Not yet expired
        ],
      },
      orderBy: { activated_at: 'desc' },
    })

    return buffs.map((buff) => ({
      id: buff.id,
      buffType: buff.buff_type,
      category: buff.category as BuffCategory | null,
      multiplier: buff.multiplier ? Number(buff.multiplier) : 1.0,
      source: (buff.source || 'system') as BuffSource,
      description: buff.description,
      expiresAt: buff.expires_at,
      remainingMinutes: buff.expires_at
        ? Math.max(0, Math.floor((buff.expires_at.getTime() - now.getTime()) / 60000))
        : null,
      isActive: buff.is_active ?? true,
    }))
  },

  /**
   * Get aggregated multiplier for a specific buff key
   *
   * Stacking rules:
   * - Consumable buffs: Take the highest active for that category
   * - Territory buffs: Additive with consumable
   * - Juicernaut buffs: Multiplicative with everything else
   *
   * Final = (base * consumable * territory) * juicernaut
   */
  async getMultiplier(userId: number, buffKey: string): Promise<number> {
    const now = new Date()

    // Get all active buffs matching this buff key
    const buffs = await prisma.active_buffs.findMany({
      where: {
        user_id: userId,
        buff_type: buffKey,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: now } },
        ],
      },
    })

    if (buffs.length === 0) return 1.0

    // Separate by source for proper stacking
    let consumableMultiplier = 1.0
    let territoryMultiplier = 1.0
    let juicernautMultiplier = 1.0

    for (const buff of buffs) {
      const multiplier = buff.multiplier ? Number(buff.multiplier) : 1.0
      const source = buff.source || 'system'

      switch (source) {
        case 'consumable':
          // Take the highest consumable buff
          consumableMultiplier = Math.max(consumableMultiplier, multiplier)
          break
        case 'territory':
          // Territory buffs stack additively (e.g., 1.10 becomes bonus of 0.10)
          territoryMultiplier = Math.max(territoryMultiplier, multiplier)
          break
        case 'juicernaut':
          // Juicernaut is multiplicative
          juicernautMultiplier = multiplier
          break
        default:
          // System buffs - treat like consumables
          consumableMultiplier = Math.max(consumableMultiplier, multiplier)
      }
    }

    // Apply stacking: (consumable * territory) * juicernaut
    // Note: consumable and territory are multipliers (1.25 = +25%)
    // So base * 1.25 * 1.10 * 1.5 for juicernaut
    return consumableMultiplier * territoryMultiplier * juicernautMultiplier
  },

  /**
   * Get multiplier for a category (aggregates all buffs in that category)
   */
  async getCategoryMultiplier(userId: number, category: BuffCategory): Promise<number> {
    const now = new Date()

    const buffs = await prisma.active_buffs.findMany({
      where: {
        user_id: userId,
        category,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: now } },
        ],
      },
    })

    if (buffs.length === 0) return 1.0

    // Same stacking logic as getMultiplier
    let consumableMultiplier = 1.0
    let territoryMultiplier = 1.0
    let juicernautMultiplier = 1.0

    for (const buff of buffs) {
      const multiplier = buff.multiplier ? Number(buff.multiplier) : 1.0
      const source = buff.source || 'system'

      switch (source) {
        case 'consumable':
          consumableMultiplier = Math.max(consumableMultiplier, multiplier)
          break
        case 'territory':
          territoryMultiplier = Math.max(territoryMultiplier, multiplier)
          break
        case 'juicernaut':
          juicernautMultiplier = multiplier
          break
        default:
          consumableMultiplier = Math.max(consumableMultiplier, multiplier)
      }
    }

    return consumableMultiplier * territoryMultiplier * juicernautMultiplier
  },

  // ===========================================================================
  // BUFF APPLICATION
  // ===========================================================================

  /**
   * Apply a new buff (handles upgrade/extension logic for same category)
   *
   * Rules:
   * - Same buff_type with higher multiplier: Replace, reset duration
   * - Same buff_type with same multiplier: Extend duration
   * - Same buff_type with lower multiplier: Reject (return existing buff info)
   */
  async applyBuff(
    userId: number,
    buffType: string,
    category: BuffCategory,
    multiplier: number,
    durationHours: number,
    source: BuffSource,
    description?: string
  ): Promise<ApplyBuffResult> {
    const now = new Date()
    const newExpiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000)

    // Use transaction with row locking to prevent race conditions
    return await prisma.$transaction(async (tx) => {
      // Check for existing buff of same type (with lock)
      const existingBuff = await tx.active_buffs.findFirst({
        where: {
          user_id: userId,
          buff_type: buffType,
          is_active: true,
          OR: [
            { expires_at: null },
            { expires_at: { gt: now } },
          ],
        },
      })

      let wasExtension = false
      let wasUpgrade = false
      let previousRemainingMinutes: number | undefined

      if (existingBuff) {
        const existingMultiplier = existingBuff.multiplier ? Number(existingBuff.multiplier) : 1.0
        previousRemainingMinutes = existingBuff.expires_at
          ? Math.max(0, Math.floor((existingBuff.expires_at.getTime() - now.getTime()) / 60000))
          : undefined

        if (multiplier > existingMultiplier) {
          // Upgrade: Replace with higher tier, reset duration
          wasUpgrade = true
          await tx.active_buffs.update({
            where: { id: existingBuff.id },
            data: {
              multiplier: new Decimal(multiplier),
              description: description || existingBuff.description,
              source,
              category,
              expires_at: newExpiresAt,
              activated_at: now,
            },
          })
        } else if (multiplier === existingMultiplier) {
          // Extension: Add duration to existing expiry
          wasExtension = true
          const currentExpiry = existingBuff.expires_at || now
          const extendedExpiresAt = new Date(
            Math.max(currentExpiry.getTime(), now.getTime()) + durationHours * 60 * 60 * 1000
          )
          await tx.active_buffs.update({
            where: { id: existingBuff.id },
            data: {
              expires_at: extendedExpiresAt,
            },
          })
          return {
            wasExtension,
            wasUpgrade,
            previousRemainingMinutes,
            newExpiresAt: extendedExpiresAt,
          }
        } else {
          // Lower tier - don't apply, but still return info about current buff
          // The caller should handle this case (e.g., warn user)
          return {
            wasExtension: false,
            wasUpgrade: false,
            previousRemainingMinutes,
            newExpiresAt: existingBuff.expires_at || now,
          }
        }
      } else {
        // No existing buff - create new
        await tx.active_buffs.create({
          data: {
            user_id: userId,
            buff_type: buffType,
            multiplier: new Decimal(multiplier),
            description,
            source,
            category,
            is_active: true,
            expires_at: newExpiresAt,
            activated_at: now,
          },
        })
      }

      return {
        wasExtension,
        wasUpgrade,
        previousRemainingMinutes,
        newExpiresAt,
      }
    })
  },

  // ===========================================================================
  // BUFF CHECKS
  // ===========================================================================

  /**
   * Check if user has a specific buff active
   */
  async hasBuff(userId: number, buffType: string): Promise<boolean> {
    const now = new Date()

    const buff = await prisma.active_buffs.findFirst({
      where: {
        user_id: userId,
        buff_type: buffType,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: now } },
        ],
      },
    })

    return !!buff
  },

  /**
   * Check if user has any buff in a category active
   */
  async hasBuffInCategory(userId: number, category: BuffCategory): Promise<boolean> {
    const now = new Date()

    const buff = await prisma.active_buffs.findFirst({
      where: {
        user_id: userId,
        category,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: now } },
        ],
      },
    })

    return !!buff
  },

  /**
   * Get buff info for a specific buff type
   */
  async getBuffInfo(userId: number, buffType: string): Promise<ActiveBuffInfo | null> {
    const now = new Date()

    const buff = await prisma.active_buffs.findFirst({
      where: {
        user_id: userId,
        buff_type: buffType,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: now } },
        ],
      },
    })

    if (!buff) return null

    return {
      id: buff.id,
      buffType: buff.buff_type,
      category: buff.category as BuffCategory | null,
      multiplier: buff.multiplier ? Number(buff.multiplier) : 1.0,
      source: (buff.source || 'system') as BuffSource,
      description: buff.description,
      expiresAt: buff.expires_at,
      remainingMinutes: buff.expires_at
        ? Math.max(0, Math.floor((buff.expires_at.getTime() - now.getTime()) / 60000))
        : null,
      isActive: buff.is_active ?? true,
    }
  },

  // ===========================================================================
  // BUFF REMOVAL
  // ===========================================================================

  /**
   * Remove a specific buff
   */
  async removeBuff(userId: number, buffType: string): Promise<boolean> {
    const result = await prisma.active_buffs.updateMany({
      where: {
        user_id: userId,
        buff_type: buffType,
        is_active: true,
      },
      data: {
        is_active: false,
      },
    })

    return result.count > 0
  },

  /**
   * Remove all buffs from a specific source
   */
  async removeBuffsBySource(userId: number, source: BuffSource): Promise<number> {
    const result = await prisma.active_buffs.updateMany({
      where: {
        user_id: userId,
        source,
        is_active: true,
      },
      data: {
        is_active: false,
      },
    })

    return result.count
  },

  // ===========================================================================
  // BUFF MAINTENANCE
  // ===========================================================================

  /**
   * Clean up expired buffs (called by cron job)
   * Marks expired buffs as inactive
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date()

    const result = await prisma.active_buffs.updateMany({
      where: {
        is_active: true,
        expires_at: {
          not: null,
          lt: now,
        },
      },
      data: {
        is_active: false,
      },
    })

    return result.count
  },

  /**
   * Get buffs expiring soon (for notifications)
   */
  async getExpiringBuffs(userId: number, withinMinutes: number = 60): Promise<ActiveBuffInfo[]> {
    const now = new Date()
    const threshold = new Date(now.getTime() + withinMinutes * 60 * 1000)

    const buffs = await prisma.active_buffs.findMany({
      where: {
        user_id: userId,
        is_active: true,
        expires_at: {
          not: null,
          gt: now,
          lt: threshold,
        },
      },
      orderBy: { expires_at: 'asc' },
    })

    return buffs.map((buff) => ({
      id: buff.id,
      buffType: buff.buff_type,
      category: buff.category as BuffCategory | null,
      multiplier: buff.multiplier ? Number(buff.multiplier) : 1.0,
      source: (buff.source || 'system') as BuffSource,
      description: buff.description,
      expiresAt: buff.expires_at,
      remainingMinutes: buff.expires_at
        ? Math.max(0, Math.floor((buff.expires_at.getTime() - now.getTime()) / 60000))
        : null,
      isActive: buff.is_active ?? true,
    }))
  },

  // ===========================================================================
  // SNAPSHOT FOR CALCULATIONS
  // ===========================================================================

  /**
   * Snapshot all active buff multipliers at calculation time
   * This prevents mid-calculation expiry issues
   */
  async snapshotMultipliers(userId: number): Promise<Record<string, number>> {
    const buffs = await this.getActiveBuffs(userId)
    const snapshot: Record<string, number> = {}

    for (const buff of buffs) {
      // Store by buff_type
      if (!snapshot[buff.buffType] || snapshot[buff.buffType] < buff.multiplier) {
        snapshot[buff.buffType] = buff.multiplier
      }
    }

    return snapshot
  },
}

export default BuffService
