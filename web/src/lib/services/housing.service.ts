import { prisma } from '../db'
import { HOUSING_UPKEEP_CONFIG } from '../game'

// =============================================================================
// HOUSING SERVICE TYPES
// =============================================================================

export interface UpkeepResult {
  user_id: number
  housingName: string
  upkeepCost: number
  paid: boolean
  newDebtDays: number
  wealthBefore: number
  wealthAfter: number
  penalty?: string
}

export interface UpkeepSummary {
  usersProcessed: number
  totalUpkeepCollected: number
  usersInDebt: number
  usersEvicted: number
  errors: string[]
}

// =============================================================================
// HOUSING SERVICE
// =============================================================================

export const HousingService = {
  /**
   * Get all users with equipped housing
   */
  async getUsersWithHousing(): Promise<{ user_id: number; housingId: number; upkeepCost: number; housingName: string }[]> {
    const equipped = await prisma.user_inventory.findMany({
      where: {
        is_equipped: true,
        slot: 'housing',
        items: {
          type: 'housing',
          upkeep_cost: { not: null },
        },
      },
      include: {
        items: true,
        users: true,
      },
    })

    return equipped
      .filter(inv => inv.items.upkeep_cost !== null)
      .map(inv => ({
        user_id: inv.user_id,
        housingId: inv.items.id,
        upkeepCost: inv.items.upkeep_cost!,
        housingName: inv.items.name,
      }))
  },

  /**
   * Deduct upkeep for a specific user
   */
  async deductUpkeep(user_id: number): Promise<UpkeepResult | null> {
    // Find user's equipped housing
    const equippedHousing = await prisma.user_inventory.findFirst({
      where: {
        user_id: user_id,
        is_equipped: true,
        slot: 'housing',
        items: {
          type: 'housing',
          upkeep_cost: { not: null },
        },
      },
      include: {
        items: true,
      },
    })

    if (!equippedHousing || !equippedHousing.items.upkeep_cost) {
      return null
    }

    const upkeepCost = equippedHousing.items.upkeep_cost
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { wealth: true, upkeep_debt_days: true },
    })

    if (!user) return null

    const currentWealth = Number(user.wealth || 0)
    const currentDebtDays = user.upkeep_debt_days || 0

    let paid = false
    let newDebtDays = currentDebtDays
    let newWealth = currentWealth
    let penalty: string | undefined

    if (currentWealth >= upkeepCost) {
      // Can afford upkeep - deduct and reset debt
      newWealth = currentWealth - upkeepCost
      newDebtDays = 0
      paid = true

      await prisma.users.update({
        where: { id: user_id },
        data: {
          wealth: { decrement: upkeepCost },
          upkeep_debt_days: 0,
          last_upkeep_check: new Date(),
        },
      })
    } else {
      // Cannot afford - increase debt days
      newDebtDays = currentDebtDays + 1

      await prisma.users.update({
        where: { id: user_id },
        data: {
          upkeep_debt_days: newDebtDays,
          last_upkeep_check: new Date(),
        },
      })

      // Apply penalties based on debt days
      if (newDebtDays >= HOUSING_UPKEEP_CONFIG.EVICTION_DAYS) {
        // Eviction - unequip housing
        await this.evictUser(user_id, equippedHousing.id)
        penalty = `Evicted from ${equippedHousing.items.name} after ${newDebtDays} days without payment`
      } else if (newDebtDays >= HOUSING_UPKEEP_CONFIG.GRACE_PERIOD_DAYS) {
        penalty = `${HOUSING_UPKEEP_CONFIG.DEBUFF_PERCENT}% stat debuff applied (${newDebtDays} days overdue)`
      }
    }

    return {
      user_id,
      housingName: equippedHousing.items.name,
      upkeepCost,
      paid,
      newDebtDays,
      wealthBefore: currentWealth,
      wealthAfter: newWealth,
      penalty,
    }
  },

  /**
   * Evict user from housing (unequip due to non-payment)
   */
  async evictUser(user_id: number, inventoryId: number): Promise<void> {
    await prisma.user_inventory.update({
      where: { id: inventoryId },
      data: {
        is_equipped: false,
        slot: null,
        equipped_at: null,
      },
    })

    // Reset debt days since they no longer have housing
    await prisma.users.update({
      where: { id: user_id },
      data: {
        upkeep_debt_days: 0,
      },
    })
  },

  /**
   * Process upkeep for all users with equipped housing
   * Called by daily cron job
   */
  async processAllUpkeep(): Promise<UpkeepSummary> {
    const summary: UpkeepSummary = {
      usersProcessed: 0,
      totalUpkeepCollected: 0,
      usersInDebt: 0,
      usersEvicted: 0,
      errors: [],
    }

    try {
      const usersWithHousing = await this.getUsersWithHousing()

      for (const housing of usersWithHousing) {
        try {
          const result = await this.deductUpkeep(housing.user_id)
          if (result) {
            summary.usersProcessed++
            if (result.paid) {
              summary.totalUpkeepCollected += result.upkeepCost
            } else {
              summary.usersInDebt++
              if (result.penalty?.includes('Evicted')) {
                summary.usersEvicted++
              }
            }
          }
        } catch (error) {
          summary.errors.push(`User ${housing.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    } catch (error) {
      summary.errors.push(`Failed to fetch housing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return summary
  },

  /**
   * Check upkeep status for a user
   */
  async checkUpkeepStatus(user_id: number): Promise<{
    hasHousing: boolean
    housingName: string | null
    upkeepCost: number | null
    debtDays: number
    hasPenalty: boolean
    willBeEvicted: boolean
    daysUntilEviction: number | null
  }> {
    const equippedHousing = await prisma.user_inventory.findFirst({
      where: {
        user_id: user_id,
        is_equipped: true,
        slot: 'housing',
      },
      include: {
        items: true,
      },
    })

    if (!equippedHousing) {
      return {
        hasHousing: false,
        housingName: null,
        upkeepCost: null,
        debtDays: 0,
        hasPenalty: false,
        willBeEvicted: false,
        daysUntilEviction: null,
      }
    }

    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { upkeep_debt_days: true },
    })

    const debtDays = user?.upkeep_debt_days || 0
    const hasPenalty = debtDays >= HOUSING_UPKEEP_CONFIG.GRACE_PERIOD_DAYS
    const willBeEvicted = debtDays >= HOUSING_UPKEEP_CONFIG.EVICTION_DAYS - 1 // Will be evicted on next check
    const daysUntilEviction = debtDays > 0 ? HOUSING_UPKEEP_CONFIG.EVICTION_DAYS - debtDays : null

    return {
      hasHousing: true,
      housingName: equippedHousing.items.name,
      upkeepCost: equippedHousing.items.upkeep_cost,
      debtDays,
      hasPenalty,
      willBeEvicted,
      daysUntilEviction,
    }
  },

  /**
   * Get debuff multiplier for a user based on upkeep debt
   * Returns 1.0 if no debuff, or reduced value if debuff applies
   */
  async getDebuffMultiplier(user_id: number): Promise<number> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { upkeep_debt_days: true },
    })

    const debtDays = user?.upkeep_debt_days || 0

    if (debtDays >= HOUSING_UPKEEP_CONFIG.GRACE_PERIOD_DAYS) {
      // Apply debuff - reduce stats by DEBUFF_PERCENT
      return 1 - (HOUSING_UPKEEP_CONFIG.DEBUFF_PERCENT / 100)
    }

    return 1.0 // No debuff
  },
}
