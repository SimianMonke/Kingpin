import { prisma } from '../db'
import { TOKEN_CONFIG } from '../game'

// =============================================================================
// TOKEN SERVICE TYPES
// =============================================================================

export interface TokenStatus {
  tokens: number
  tokensEarnedToday: number
  lastTokenReset: Date | null
  softCap: number
  hardCap: number
  aboveSoftCap: boolean
  atHardCap: boolean
}

export interface TokenConversionResult {
  success: boolean
  error?: string
  tokensGained: number
  cost?: number
  newBalance: number
}

export interface TokenDecayResult {
  userId: number
  previousTokens: number
  tokensDecayed: number
  newTokens: number
}

export type TokenTransactionType =
  | 'CHANNEL_POINTS'
  | 'CREDIT_CONVERSION'
  | 'PLAY_BONUS'
  | 'BUSINESS_BOOST'
  | 'DECAY'
  | 'ADMIN_GRANT'
  | 'DAILY_RESET'

// =============================================================================
// TOKEN SERVICE
// Phase 3 Economy Rebalance: Token system to gate wealth generation frequency
// =============================================================================

export const TokenService = {
  /**
   * Get user's current token status
   */
  async getTokenStatus(user_id: number): Promise<TokenStatus> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        tokens: true,
        tokens_earned_today: true,
        last_token_reset: true,
      },
    })

    const tokens = user?.tokens || 0
    const tokensEarnedToday = user?.tokens_earned_today || 0

    return {
      tokens,
      tokensEarnedToday,
      lastTokenReset: user?.last_token_reset || null,
      softCap: TOKEN_CONFIG.SOFT_CAP,
      hardCap: TOKEN_CONFIG.HARD_CAP,
      aboveSoftCap: tokens > TOKEN_CONFIG.SOFT_CAP,
      atHardCap: tokens >= TOKEN_CONFIG.HARD_CAP,
    }
  },

  /**
   * Convert channel points to tokens
   * Primary earning method - tied to streamer engagement
   */
  async convertChannelPointsToTokens(
    user_id: number,
    channelPoints: number
  ): Promise<TokenConversionResult> {
    const tokensEarned = Math.floor(channelPoints / TOKEN_CONFIG.CHANNEL_POINT_RATE)

    if (tokensEarned <= 0) {
      return {
        success: false,
        error: `Need at least ${TOKEN_CONFIG.CHANNEL_POINT_RATE} channel points`,
        tokensGained: 0,
        newBalance: 0,
      }
    }

    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { tokens: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', tokensGained: 0, newBalance: 0 }
    }

    const currentTokens = user.tokens || 0

    // Cap at hard cap
    const newTotal = Math.min(currentTokens + tokensEarned, TOKEN_CONFIG.HARD_CAP)
    const actualGain = newTotal - currentTokens

    if (actualGain <= 0) {
      return {
        success: false,
        error: 'At token cap',
        tokensGained: 0,
        newBalance: currentTokens,
      }
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { tokens: newTotal },
      }),
      prisma.token_transactions.create({
        data: {
          user_id,
          amount: actualGain,
          type: 'CHANNEL_POINTS',
          description: `Converted ${channelPoints} channel points`,
        },
      }),
    ])

    return {
      success: true,
      tokensGained: actualGain,
      newBalance: newTotal,
    }
  },

  /**
   * Convert credits (wealth) to tokens
   * Wealth sink with progressively increasing cost
   */
  async convertCreditsToTokens(user_id: number): Promise<TokenConversionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: {
        tokens: true,
        tokens_earned_today: true,
        wealth: true,
      },
    })

    if (!user) {
      return { success: false, error: 'User not found', tokensGained: 0, newBalance: 0 }
    }

    const currentTokens = user.tokens || 0
    const tokensEarnedToday = user.tokens_earned_today || 0
    const wealthNum = Number(user.wealth || 0)

    // Check daily conversion limit
    if (tokensEarnedToday >= TOKEN_CONFIG.MAX_CREDIT_CONVERSIONS_PER_DAY) {
      return {
        success: false,
        error: `Daily limit reached (${TOKEN_CONFIG.MAX_CREDIT_CONVERSIONS_PER_DAY} conversions/day)`,
        tokensGained: 0,
        newBalance: currentTokens,
      }
    }

    // Check hard cap
    if (currentTokens >= TOKEN_CONFIG.HARD_CAP) {
      return {
        success: false,
        error: 'At token cap',
        tokensGained: 0,
        newBalance: currentTokens,
      }
    }

    // Calculate dynamic cost based on today's purchases
    const cost = Math.floor(
      TOKEN_CONFIG.CREDIT_CONVERSION_BASE *
      Math.pow(TOKEN_CONFIG.CREDIT_CONVERSION_SCALING, tokensEarnedToday)
    )

    if (wealthNum < cost) {
      return {
        success: false,
        error: `Need $${cost.toLocaleString()} credits (you have $${wealthNum.toLocaleString()})`,
        tokensGained: 0,
        cost,
        newBalance: currentTokens,
      }
    }

    const newTotal = currentTokens + 1

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: {
          wealth: { decrement: cost },
          tokens: { increment: 1 },
          tokens_earned_today: { increment: 1 },
        },
      }),
      prisma.token_transactions.create({
        data: {
          user_id,
          amount: 1,
          type: 'CREDIT_CONVERSION',
          description: `Converted $${cost.toLocaleString()} credits`,
        },
      }),
      prisma.game_events.create({
        data: {
          user_id,
          event_type: 'token_purchase',
          wealth_change: -cost,
          xp_change: 0,
          event_description: `Purchased 1 token for $${cost.toLocaleString()}`,
          success: true,
        },
      }),
    ])

    return {
      success: true,
      tokensGained: 1,
      cost,
      newBalance: newTotal,
    }
  },

  /**
   * Spend tokens for play bonus
   * Returns true if tokens were successfully deducted
   */
  async spendTokenForPlayBonus(user_id: number): Promise<{
    success: boolean
    error?: string
    bonusMultiplier: number
  }> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { tokens: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', bonusMultiplier: 1.0 }
    }

    const currentTokens = user.tokens || 0

    if (currentTokens < TOKEN_CONFIG.PLAY_BONUS_COST) {
      return {
        success: false,
        error: `Need ${TOKEN_CONFIG.PLAY_BONUS_COST} token(s)`,
        bonusMultiplier: 1.0,
      }
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { tokens: { decrement: TOKEN_CONFIG.PLAY_BONUS_COST } },
      }),
      prisma.token_transactions.create({
        data: {
          user_id,
          amount: -TOKEN_CONFIG.PLAY_BONUS_COST,
          type: 'PLAY_BONUS',
          description: 'Bonus used on !play',
        },
      }),
    ])

    return {
      success: true,
      bonusMultiplier: TOKEN_CONFIG.PLAY_BONUS_MULTIPLIER,
    }
  },

  /**
   * Spend tokens for business collection boost
   */
  async spendTokenForBusinessBoost(user_id: number): Promise<{
    success: boolean
    error?: string
    bonusMultiplier: number
  }> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { tokens: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', bonusMultiplier: 1.0 }
    }

    const currentTokens = user.tokens || 0

    if (currentTokens < TOKEN_CONFIG.BUSINESS_BOOST_COST) {
      return {
        success: false,
        error: `Need ${TOKEN_CONFIG.BUSINESS_BOOST_COST} tokens`,
        bonusMultiplier: 1.0,
      }
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { tokens: { decrement: TOKEN_CONFIG.BUSINESS_BOOST_COST } },
      }),
      prisma.token_transactions.create({
        data: {
          user_id,
          amount: -TOKEN_CONFIG.BUSINESS_BOOST_COST,
          type: 'BUSINESS_BOOST',
          description: 'Business collection boost',
        },
      }),
    ])

    return {
      success: true,
      bonusMultiplier: TOKEN_CONFIG.BUSINESS_BOOST_MULTIPLIER,
    }
  },

  /**
   * Process token decay for a single user
   * Called by the daily job for users above soft cap
   */
  async processUserDecay(user_id: number): Promise<TokenDecayResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { tokens: true },
    })

    if (!user) {
      return { userId: user_id, previousTokens: 0, tokensDecayed: 0, newTokens: 0 }
    }

    const currentTokens = user.tokens || 0

    // No decay below soft cap
    if (currentTokens <= TOKEN_CONFIG.SOFT_CAP) {
      return {
        userId: user_id,
        previousTokens: currentTokens,
        tokensDecayed: 0,
        newTokens: currentTokens,
      }
    }

    // Calculate decay amount
    let decayAmount: number

    if (currentTokens >= TOKEN_CONFIG.HARD_CAP) {
      // At hard cap: higher decay rate on total
      decayAmount = Math.floor(currentTokens * TOKEN_CONFIG.DECAY_RATE_AT_HARD)
    } else {
      // Above soft cap but below hard cap: decay only the excess
      const excess = currentTokens - TOKEN_CONFIG.SOFT_CAP
      decayAmount = Math.floor(excess * TOKEN_CONFIG.DECAY_RATE_ABOVE_SOFT)
    }

    // Minimum 1 token decay if above soft cap
    decayAmount = Math.max(1, decayAmount)

    const newTokens = currentTokens - decayAmount

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { tokens: newTokens },
      }),
      prisma.token_transactions.create({
        data: {
          user_id,
          amount: -decayAmount,
          type: 'DECAY',
          description: `Daily decay (${currentTokens} > ${TOKEN_CONFIG.SOFT_CAP} soft cap)`,
        },
      }),
    ])

    return {
      userId: user_id,
      previousTokens: currentTokens,
      tokensDecayed: decayAmount,
      newTokens,
    }
  },

  /**
   * Reset daily token counters for all users
   * Called by the daily job at midnight
   */
  async resetDailyCounters(): Promise<{ usersReset: number }> {
    const result = await prisma.users.updateMany({
      where: {
        tokens_earned_today: { gt: 0 },
      },
      data: {
        tokens_earned_today: 0,
        last_token_reset: new Date(),
      },
    })

    return { usersReset: result.count }
  },

  /**
   * Process all token decay (daily job)
   */
  async processAllDecay(): Promise<{
    processed: number
    totalDecayed: number
  }> {
    // Get all users above soft cap
    const usersAboveCap = await prisma.users.findMany({
      where: {
        tokens: { gt: TOKEN_CONFIG.SOFT_CAP },
      },
      select: { id: true },
    })

    let processed = 0
    let totalDecayed = 0

    for (const user of usersAboveCap) {
      const result = await this.processUserDecay(user.id)
      processed++
      totalDecayed += result.tokensDecayed
    }

    return { processed, totalDecayed }
  },

  /**
   * Admin function to grant tokens to a user
   */
  async adminGrantTokens(
    user_id: number,
    amount: number,
    admin_id: number,
    reason?: string
  ): Promise<TokenConversionResult> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { tokens: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', tokensGained: 0, newBalance: 0 }
    }

    const currentTokens = user.tokens || 0
    const newTotal = Math.min(currentTokens + amount, TOKEN_CONFIG.HARD_CAP)
    const actualGain = newTotal - currentTokens

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user_id },
        data: { tokens: newTotal },
      }),
      prisma.token_transactions.create({
        data: {
          user_id,
          amount: actualGain,
          type: 'ADMIN_GRANT',
          description: reason || `Granted by admin #${admin_id}`,
        },
      }),
    ])

    return {
      success: true,
      tokensGained: actualGain,
      newBalance: newTotal,
    }
  },

  /**
   * Get user's token transaction history
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
    const transactions = await prisma.token_transactions.findMany({
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
   * Get next conversion cost (for display)
   */
  async getNextConversionCost(user_id: number): Promise<number> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { tokens_earned_today: true },
    })

    const tokensEarnedToday = user?.tokens_earned_today || 0

    return Math.floor(
      TOKEN_CONFIG.CREDIT_CONVERSION_BASE *
      Math.pow(TOKEN_CONFIG.CREDIT_CONVERSION_SCALING, tokensEarnedToday)
    )
  },
}

export default TokenService
