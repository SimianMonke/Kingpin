import { prisma } from '../db'
import {
  INSURANCE_CONFIG,
  INSURANCE_TIERS,
  type InsuranceTier,
} from '../game'

// =============================================================================
// INSURANCE SERVICE TYPES
// =============================================================================

export interface InsuranceStatus {
  tier: InsuranceTier
  protection: number
  dailyCost: number
  paidAt: Date | null
  isActive: boolean
}

export interface InsurancePurchaseResult {
  success: boolean
  error?: string
  newTier: InsuranceTier
  cost: number
}

export interface InsuranceDeductionResult {
  userId: number
  previousTier: InsuranceTier
  newTier: InsuranceTier
  amountDeducted: number
  downgraded: boolean
}

// =============================================================================
// INSURANCE SERVICE
// Phase 2 Economy Rebalance: Robbery protection with recurring costs
// =============================================================================

export const InsuranceService = {
  /**
   * Get user's current insurance status
   */
  async getInsuranceStatus(user_id: number): Promise<InsuranceStatus> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        insurance_tier: true,
        insurance_paid_at: true,
      },
    })

    const tier = (user?.insurance_tier as InsuranceTier) || INSURANCE_TIERS.NONE
    const tierConfig = INSURANCE_CONFIG.TIERS[tier]

    // Check if premium is current (paid within last 24 hours + grace period)
    const now = new Date()
    const paidAt = user?.insurance_paid_at || null
    const gracePeriodMs = INSURANCE_CONFIG.GRACE_PERIOD_HOURS * 60 * 60 * 1000
    const isActive = tier === INSURANCE_TIERS.NONE ||
      (paidAt && (now.getTime() - paidAt.getTime()) < (24 * 60 * 60 * 1000 + gracePeriodMs))

    return {
      tier,
      protection: tierConfig.protection,
      dailyCost: tierConfig.dailyCost,
      paidAt,
      isActive: !!isActive,
    }
  },

  /**
   * Set user's insurance tier
   */
  async setInsuranceTier(
    user_id: number,
    newTier: InsuranceTier
  ): Promise<InsurancePurchaseResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { wealth: true, insurance_tier: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', newTier: INSURANCE_TIERS.NONE, cost: 0 }
    }

    const tierConfig = INSURANCE_CONFIG.TIERS[newTier]

    // If upgrading to a paid tier, deduct first day's premium immediately
    if (newTier !== INSURANCE_TIERS.NONE && tierConfig.dailyCost > 0) {
      const wealthNum = Number(user.wealth || 0)
      if (wealthNum < tierConfig.dailyCost) {
        return {
          success: false,
          error: `Need $${tierConfig.dailyCost.toLocaleString()} to purchase ${newTier} insurance`,
          newTier: (user.insurance_tier as InsuranceTier) || INSURANCE_TIERS.NONE,
          cost: 0,
        }
      }

      // Deduct first premium and set tier
      await prisma.$transaction([
        prisma.users.update({
          where: { id: user_id },
          data: {
            wealth: { decrement: tierConfig.dailyCost },
            insurance_tier: newTier,
            insurance_paid_at: new Date(),
          },
        }),
        prisma.game_events.create({
          data: {
            user_id,
            event_type: 'insurance_purchase',
            wealth_change: -tierConfig.dailyCost,
            xp_change: 0,
            event_description: `Purchased ${newTier} insurance`,
            success: true,
          },
        }),
      ])

      return { success: true, newTier, cost: tierConfig.dailyCost }
    }

    // Downgrading to none (free)
    await prisma.users.update({
      where: { id: user_id },
      data: {
        insurance_tier: INSURANCE_TIERS.NONE,
        insurance_paid_at: null,
      },
    })

    return { success: true, newTier: INSURANCE_TIERS.NONE, cost: 0 }
  },

  /**
   * Calculate insurance protection for a robbery
   * Returns the amount of stolen wealth that should be returned to victim
   */
  async calculateInsurancePayout(
    victim_id: number,
    stolenAmount: number
  ): Promise<{ payout: number; tier: InsuranceTier }> {
    const status = await this.getInsuranceStatus(victim_id)

    if (!status.isActive || status.tier === INSURANCE_TIERS.NONE) {
      return { payout: 0, tier: INSURANCE_TIERS.NONE }
    }

    const payout = Math.floor(stolenAmount * status.protection)
    return { payout, tier: status.tier }
  },

  /**
   * Process daily insurance premium for a single user
   * Called by the daily job
   */
  async processUserPremium(user_id: number): Promise<InsuranceDeductionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        wealth: true,
        insurance_tier: true,
        insurance_paid_at: true,
      },
    })

    if (!user) {
      return {
        userId: user_id,
        previousTier: INSURANCE_TIERS.NONE,
        newTier: INSURANCE_TIERS.NONE,
        amountDeducted: 0,
        downgraded: false,
      }
    }

    const currentTier = (user.insurance_tier as InsuranceTier) || INSURANCE_TIERS.NONE

    // No premium for 'none' tier
    if (currentTier === INSURANCE_TIERS.NONE) {
      return {
        userId: user_id,
        previousTier: currentTier,
        newTier: currentTier,
        amountDeducted: 0,
        downgraded: false,
      }
    }

    const tierConfig = INSURANCE_CONFIG.TIERS[currentTier]
    const wealthNum = Number(user.wealth || 0)

    // Can afford premium
    if (wealthNum >= tierConfig.dailyCost) {
      await prisma.$transaction([
        prisma.users.update({
          where: { id: user_id },
          data: {
            wealth: { decrement: tierConfig.dailyCost },
            insurance_paid_at: new Date(),
          },
        }),
        prisma.game_events.create({
          data: {
            user_id,
            event_type: 'insurance_premium',
            wealth_change: -tierConfig.dailyCost,
            xp_change: 0,
            event_description: `${currentTier} insurance daily premium`,
            success: true,
          },
        }),
      ])

      return {
        userId: user_id,
        previousTier: currentTier,
        newTier: currentTier,
        amountDeducted: tierConfig.dailyCost,
        downgraded: false,
      }
    }

    // Cannot afford - downgrade to none
    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: {
          insurance_tier: INSURANCE_TIERS.NONE,
          insurance_paid_at: null,
        },
      }),
      prisma.game_events.create({
        data: {
          user_id,
          event_type: 'insurance_lapse',
          wealth_change: 0,
          xp_change: 0,
          event_description: `Insurance lapsed (couldn't afford ${currentTier} premium)`,
          success: false,
        },
      }),
    ])

    return {
      userId: user_id,
      previousTier: currentTier,
      newTier: INSURANCE_TIERS.NONE,
      amountDeducted: 0,
      downgraded: true,
    }
  },

  /**
   * Process all insurance premiums (daily job)
   */
  async processAllPremiums(): Promise<{
    processed: number
    totalDeducted: number
    downgrades: number
  }> {
    // Get all users with active insurance
    const usersWithInsurance = await prisma.users.findMany({
      where: {
        insurance_tier: { not: INSURANCE_TIERS.NONE },
      },
      select: { id: true },
    })

    let processed = 0
    let totalDeducted = 0
    let downgrades = 0

    for (const user of usersWithInsurance) {
      const result = await this.processUserPremium(user.id)
      processed++
      totalDeducted += result.amountDeducted
      if (result.downgraded) downgrades++
    }

    return { processed, totalDeducted, downgrades }
  },

  /**
   * Get available insurance tiers for display
   */
  getAvailableTiers(): Array<{
    tier: InsuranceTier
    protection: number
    dailyCost: number
    monthlyCost: number
  }> {
    return Object.entries(INSURANCE_CONFIG.TIERS).map(([tier, config]) => ({
      tier: tier as InsuranceTier,
      protection: config.protection,
      dailyCost: config.dailyCost,
      monthlyCost: config.dailyCost * 30,
    }))
  },
}

export default InsuranceService
