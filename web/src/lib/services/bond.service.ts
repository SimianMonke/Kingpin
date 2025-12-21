import { prisma } from '../db'
import { BOND_CONFIG } from '../game'
import { getTierFromLevel } from '../game/formulas'

// =============================================================================
// BOND SERVICE TYPES
// =============================================================================

export interface BondStatus {
  bonds: number
  lastBondConversion: Date | null
  daysUntilNextConversion: number
  canConvert: boolean
  conversionCost: number
  conversionReward: number
  requiredLevel: number
}

export interface BondConversionResult {
  success: boolean
  error?: string
  bondsGained: number
  cost?: number
  newBalance: number
}

export type BondTransactionType =
  | 'PURCHASE'
  | 'CREDIT_CONVERSION'
  | 'COSMETIC'
  | 'SEASON_PASS'
  | 'ACHIEVEMENT'
  | 'ADMIN_GRANT'

// =============================================================================
// BOND SERVICE
// Phase 4 Economy Rebalance: Premium currency for end-game wealth sink
// =============================================================================

export const BondService = {
  /**
   * Get user's current bond status
   */
  async getBondStatus(user_id: number): Promise<BondStatus> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        bonds: true,
        last_bond_conversion: true,
        level: true,
      },
    })

    const bonds = user?.bonds || 0
    const lastConversion = user?.last_bond_conversion || null
    const level = user?.level || 1
    const config = BOND_CONFIG.CREDIT_CONVERSION

    // Calculate days until next conversion
    let daysUntilNextConversion = 0
    if (lastConversion) {
      const daysSinceConversion = Math.floor(
        (Date.now() - lastConversion.getTime()) / (1000 * 60 * 60 * 24)
      )
      daysUntilNextConversion = Math.max(0, config.COOLDOWN_DAYS - daysSinceConversion)
    }

    const canConvert =
      level >= config.MIN_LEVEL &&
      daysUntilNextConversion === 0

    return {
      bonds,
      lastBondConversion: lastConversion,
      daysUntilNextConversion,
      canConvert,
      conversionCost: config.COST,
      conversionReward: config.BONDS_RECEIVED,
      requiredLevel: config.MIN_LEVEL,
    }
  },

  /**
   * Convert credits (wealth) to bonds
   * The "Golden Sink" - massive wealth removal for wealthy players
   */
  async convertCreditsToBonds(user_id: number): Promise<BondConversionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        bonds: true,
        last_bond_conversion: true,
        level: true,
        wealth: true,
      },
    })

    if (!user) {
      return { success: false, error: 'User not found', bondsGained: 0, newBalance: 0 }
    }

    const currentBonds = user.bonds || 0
    const level = user.level || 1
    const wealthNum = Number(user.wealth || 0)
    const config = BOND_CONFIG.CREDIT_CONVERSION

    // Check level requirement
    if (level < config.MIN_LEVEL) {
      const tier = getTierFromLevel(config.MIN_LEVEL)
      return {
        success: false,
        error: `Must be ${tier} tier (level ${config.MIN_LEVEL}+) to convert credits to bonds`,
        bondsGained: 0,
        newBalance: currentBonds,
      }
    }

    // Check cooldown
    if (user.last_bond_conversion) {
      const daysSinceConversion = Math.floor(
        (Date.now() - user.last_bond_conversion.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceConversion < config.COOLDOWN_DAYS) {
        const daysRemaining = config.COOLDOWN_DAYS - daysSinceConversion
        return {
          success: false,
          error: `Can convert again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
          bondsGained: 0,
          newBalance: currentBonds,
        }
      }
    }

    // Check wealth
    if (wealthNum < config.COST) {
      return {
        success: false,
        error: `Need $${config.COST.toLocaleString()} credits (you have $${wealthNum.toLocaleString()})`,
        bondsGained: 0,
        cost: config.COST,
        newBalance: currentBonds,
      }
    }

    const newBondTotal = currentBonds + config.BONDS_RECEIVED

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: {
          wealth: { decrement: config.COST },
          bonds: { increment: config.BONDS_RECEIVED },
          last_bond_conversion: new Date(),
        },
      }),
      prisma.bond_transactions.create({
        data: {
          user_id,
          amount: config.BONDS_RECEIVED,
          type: 'CREDIT_CONVERSION',
          description: `Converted $${config.COST.toLocaleString()} credits`,
        },
      }),
      prisma.game_events.create({
        data: {
          user_id,
          event_type: 'bond_conversion',
          wealth_change: -config.COST,
          xp_change: 0,
          event_description: `Converted $${config.COST.toLocaleString()} to ${config.BONDS_RECEIVED} bonds`,
          success: true,
        },
      }),
    ])

    return {
      success: true,
      bondsGained: config.BONDS_RECEIVED,
      cost: config.COST,
      newBalance: newBondTotal,
    }
  },

  /**
   * Spend bonds on cosmetics
   */
  async purchaseCosmetic(
    user_id: number,
    cosmetic_type: keyof typeof BOND_CONFIG.COSMETICS,
    cosmetic_name?: string
  ): Promise<{
    success: boolean
    error?: string
    cost: number
    remainingBonds: number
  }> {
    const cost = BOND_CONFIG.COSMETICS[cosmetic_type]

    if (!cost) {
      return { success: false, error: 'Invalid cosmetic type', cost: 0, remainingBonds: 0 }
    }

    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { bonds: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', cost, remainingBonds: 0 }
    }

    const currentBonds = user.bonds || 0

    if (currentBonds < cost) {
      return {
        success: false,
        error: `Need ${cost} bonds (you have ${currentBonds})`,
        cost,
        remainingBonds: currentBonds,
      }
    }

    const newBalance = currentBonds - cost

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { bonds: { decrement: cost } },
      }),
      prisma.bond_transactions.create({
        data: {
          user_id,
          amount: -cost,
          type: 'COSMETIC',
          description: `Purchased ${cosmetic_type}${cosmetic_name ? `: ${cosmetic_name}` : ''}`,
        },
      }),
    ])

    return {
      success: true,
      cost,
      remainingBonds: newBalance,
    }
  },

  /**
   * Purchase season pass with bonds
   */
  async purchaseSeasonPass(user_id: number): Promise<{
    success: boolean
    error?: string
    cost: number
    expiresAt: Date | null
  }> {
    const cost = BOND_CONFIG.SEASON_PASS.COST

    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { bonds: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', cost, expiresAt: null }
    }

    const currentBonds = user.bonds || 0

    if (currentBonds < cost) {
      return {
        success: false,
        error: `Need ${cost} bonds (you have ${currentBonds})`,
        cost,
        expiresAt: null,
      }
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + BOND_CONFIG.SEASON_PASS.DURATION_DAYS)

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { bonds: { decrement: cost } },
      }),
      prisma.bond_transactions.create({
        data: {
          user_id,
          amount: -cost,
          type: 'SEASON_PASS',
          description: `Season pass purchased (expires ${expiresAt.toISOString().split('T')[0]})`,
        },
      }),
    ])

    return {
      success: true,
      cost,
      expiresAt,
    }
  },

  /**
   * Grant achievement bonds to a user (one-time rewards)
   */
  async grantAchievementBonds(
    user_id: number,
    achievement_key: keyof typeof BOND_CONFIG.ACHIEVEMENTS,
    reason?: string
  ): Promise<BondConversionResult> {
    const bondsToGrant = BOND_CONFIG.ACHIEVEMENTS[achievement_key]

    if (!bondsToGrant) {
      return { success: false, error: 'Invalid achievement', bondsGained: 0, newBalance: 0 }
    }

    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { bonds: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', bondsGained: 0, newBalance: 0 }
    }

    const currentBonds = user.bonds || 0
    const newBalance = currentBonds + bondsToGrant

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { bonds: { increment: bondsToGrant } },
      }),
      prisma.bond_transactions.create({
        data: {
          user_id,
          amount: bondsToGrant,
          type: 'ACHIEVEMENT',
          description: reason || `Achievement: ${achievement_key}`,
        },
      }),
    ])

    return {
      success: true,
      bondsGained: bondsToGrant,
      newBalance,
    }
  },

  /**
   * Admin function to grant bonds to a user
   */
  async adminGrantBonds(
    user_id: number,
    amount: number,
    admin_id: number,
    reason?: string
  ): Promise<BondConversionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { bonds: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', bondsGained: 0, newBalance: 0 }
    }

    const currentBonds = user.bonds || 0
    const newBalance = currentBonds + amount

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { bonds: newBalance },
      }),
      prisma.bond_transactions.create({
        data: {
          user_id,
          amount,
          type: 'ADMIN_GRANT',
          description: reason || `Granted by admin #${admin_id}`,
        },
      }),
    ])

    return {
      success: true,
      bondsGained: amount,
      newBalance,
    }
  },

  /**
   * Get user's bond transaction history
   */
  async getTransactionHistory(
    user_id: number,
    limit: number = 20
  ): Promise<Array<{
    amount: number
    type: string
    description: string | null
    createdAt: Date
  }>> {
    const transactions = await prisma.bond_transactions.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        amount: true,
        type: true,
        description: true,
        created_at: true,
      },
    })

    return transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.created_at,
    }))
  },

  /**
   * Grant bonds from a Stripe purchase
   * Called by the Stripe webhook when a bond purchase is completed
   */
  async grantStripePurchase(
    user_id: number,
    bundle_id: string,
    bonds_total: number,
    stripe_session_id: string,
    amount_usd: number
  ): Promise<BondConversionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { bonds: true, username: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', bondsGained: 0, newBalance: 0 }
    }

    const currentBonds = user.bonds || 0
    const newBalance = currentBonds + bonds_total

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { bonds: newBalance },
      }),
      prisma.bond_transactions.create({
        data: {
          user_id,
          amount: bonds_total,
          type: 'PURCHASE',
          description: `Purchased ${bundle_id} bundle ($${amount_usd}) - Stripe: ${stripe_session_id}`,
        },
      }),
      prisma.game_events.create({
        data: {
          user_id,
          event_type: 'bond_purchase',
          wealth_change: 0,
          xp_change: 0,
          event_description: `Purchased ${bonds_total} bonds ($${amount_usd})`,
          success: true,
        },
      }),
    ])

    console.log(
      `Bond purchase completed: ${user.username} bought ${bonds_total} bonds ($${amount_usd})`
    )

    return {
      success: true,
      bondsGained: bonds_total,
      newBalance,
    }
  },

  /**
   * Get economy-wide bond statistics (for admin dashboard)
   */
  async getBondStatistics(): Promise<{
    totalBondsInCirculation: number
    totalBondHolders: number
    totalCreditConversions: number
    totalCreditsConsumed: bigint
  }> {
    const [bondsAggregate, holdersCount, conversionsAggregate] = await Promise.all([
      prisma.users.aggregate({
        _sum: { bonds: true },
      }),
      prisma.users.count({
        where: { bonds: { gt: 0 } },
      }),
      prisma.bond_transactions.aggregate({
        where: { type: 'CREDIT_CONVERSION' },
        _count: true,
      }),
    ])

    const totalConversions = conversionsAggregate._count
    // Each conversion costs BOND_CONFIG.CREDIT_CONVERSION.COST
    const totalCreditsConsumed = BigInt(totalConversions) * BigInt(BOND_CONFIG.CREDIT_CONVERSION.COST)

    return {
      totalBondsInCirculation: bondsAggregate._sum.bonds || 0,
      totalBondHolders: holdersCount,
      totalCreditConversions: totalConversions,
      totalCreditsConsumed,
    }
  },
}

export default BondService
