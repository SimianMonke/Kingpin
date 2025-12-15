import { prisma } from '../db'
import { BUSINESS_REVENUE_CONFIG } from '../game'

// =============================================================================
// BUSINESS SERVICE TYPES
// =============================================================================

export interface BusinessRevenueResult {
  userId: number
  businessName: string
  baseRevenue: number
  variance: number
  totalRevenue: number
  operatingCost: number
  netRevenue: number
}

export interface CollectionSummary {
  usersProcessed: number
  totalRevenueDistributed: number
  businessesProcessed: number
  errors: string[]
}

// =============================================================================
// BUSINESS SERVICE
// =============================================================================

export const BusinessService = {
  /**
   * Calculate revenue for a single collection period (3 hours)
   * Revenue = (dailyRevenuePotential / 8) with ±20% variance
   */
  calculateRevenue(dailyRevenuePotential: number): { base: number; variance: number; total: number } {
    const base = Math.floor(dailyRevenuePotential / BUSINESS_REVENUE_CONFIG.CALCULATIONS_PER_DAY)
    const variancePercent = BUSINESS_REVENUE_CONFIG.VARIANCE_PERCENT
    const varianceAmount = Math.floor(base * (variancePercent / 100))
    const variance = Math.floor(Math.random() * (varianceAmount * 2 + 1)) - varianceAmount
    const total = base + variance

    return { base, variance, total }
  },

  /**
   * Get all users with equipped businesses
   */
  async getUsersWithBusinesses(): Promise<{ userId: number; businessId: number; dailyRevenue: number; operatingCost: number; businessName: string }[]> {
    const equipped = await prisma.user_inventory.findMany({
      where: {
        is_equipped: true,
        slot: 'business',
        items: {
          type: 'business',
          daily_revenue_potential: { not: null },
        },
      },
      include: {
        items: true,
        users: true,
      },
    })

    return equipped
      .filter(inv => inv.items.daily_revenue_potential !== null)
      .map(inv => ({
        userId: inv.user_id,
        businessId: inv.items.id,
        dailyRevenue: inv.items.daily_revenue_potential!,
        operatingCost: inv.items.operating_cost || 0,
        businessName: inv.items.name,
      }))
  },

  /**
   * Collect revenue for a specific user's business
   */
  async collectRevenue(userId: number): Promise<BusinessRevenueResult | null> {
    // Find user's equipped business
    const equippedBusiness = await prisma.user_inventory.findFirst({
      where: {
        user_id: userId,
        is_equipped: true,
        slot: 'business',
        items: {
          type: 'business',
          daily_revenue_potential: { not: null },
        },
      },
      include: {
        items: true,
      },
    })

    if (!equippedBusiness || !equippedBusiness.items.daily_revenue_potential) {
      return null
    }

    const dailyRevenue = equippedBusiness.items.daily_revenue_potential
    const operatingCost = Math.floor((equippedBusiness.items.operating_cost || 0) / BUSINESS_REVENUE_CONFIG.CALCULATIONS_PER_DAY)

    const { base, variance, total } = this.calculateRevenue(dailyRevenue)
    const netRevenue = Math.max(0, total - operatingCost)

    // Add wealth to user and record P&L history
    await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: {
          wealth: { increment: netRevenue },
        },
      }),
      prisma.business_revenue_history.create({
        data: {
          user_id: userId,
          item_id: equippedBusiness.items.id,
          business_name: equippedBusiness.items.name,
          gross_revenue: total,
          operating_cost: operatingCost,
          net_revenue: netRevenue,
          period_type: 'scheduled',
        },
      }),
    ])

    return {
      userId,
      businessName: equippedBusiness.items.name,
      baseRevenue: base,
      variance,
      totalRevenue: total,
      operatingCost,
      netRevenue,
    }
  },

  /**
   * Collect revenue for all users with equipped businesses
   * Called by cron job every 3 hours
   */
  async collectAllRevenue(): Promise<CollectionSummary> {
    const summary: CollectionSummary = {
      usersProcessed: 0,
      totalRevenueDistributed: 0,
      businessesProcessed: 0,
      errors: [],
    }

    try {
      const usersWithBusinesses = await this.getUsersWithBusinesses()

      for (const business of usersWithBusinesses) {
        try {
          const result = await this.collectRevenue(business.userId)
          if (result) {
            summary.usersProcessed++
            summary.businessesProcessed++
            summary.totalRevenueDistributed += result.netRevenue
          }
        } catch (error) {
          summary.errors.push(`User ${business.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    } catch (error) {
      summary.errors.push(`Failed to fetch businesses: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return summary
  },

  /**
   * Get business count for a user (for ownership limits)
   */
  async getBusinessCount(userId: number): Promise<number> {
    return prisma.user_inventory.count({
      where: {
        user_id: userId,
        items: {
          type: 'business',
        },
      },
    })
  },

  /**
   * Check if user can purchase another business
   */
  async canPurchaseBusiness(userId: number, maxBusinesses: number = 3): Promise<{ canPurchase: boolean; currentCount: number; error?: string }> {
    const count = await this.getBusinessCount(userId)

    if (count >= maxBusinesses) {
      return {
        canPurchase: false,
        currentCount: count,
        error: `You can only own ${maxBusinesses} businesses. Sell one to buy another.`,
      }
    }

    return {
      canPurchase: true,
      currentCount: count,
    }
  },

  /**
   * Get user's business revenue stats
   */
  async getBusinessStats(userId: number): Promise<{
    hasEquippedBusiness: boolean
    businessName: string | null
    dailyRevenuePotential: number | null
    operatingCost: number | null
    revenuePerCollection: number | null
    netPerCollection: number | null
  }> {
    const equippedBusiness = await prisma.user_inventory.findFirst({
      where: {
        user_id: userId,
        is_equipped: true,
        slot: 'business',
      },
      include: {
        items: true,
      },
    })

    if (!equippedBusiness) {
      return {
        hasEquippedBusiness: false,
        businessName: null,
        dailyRevenuePotential: null,
        operatingCost: null,
        revenuePerCollection: null,
        netPerCollection: null,
      }
    }

    const dailyRevenue = equippedBusiness.items.daily_revenue_potential
    const operatingCost = equippedBusiness.items.operating_cost
    const revenuePerCollection = dailyRevenue ? Math.floor(dailyRevenue / 8) : null
    const opCostPerCollection = operatingCost ? Math.floor(operatingCost / 8) : 0
    const netPerCollection = revenuePerCollection ? revenuePerCollection - opCostPerCollection : null

    return {
      hasEquippedBusiness: true,
      businessName: equippedBusiness.items.name,
      dailyRevenuePotential: dailyRevenue,
      operatingCost,
      revenuePerCollection,
      netPerCollection,
    }
  },

  /**
   * Get P&L summary for a user's businesses
   */
  async getProfitLossSummary(userId: number, days: number = 7): Promise<{
    totalGrossRevenue: number
    totalOperatingCosts: number
    totalNetRevenue: number
    collectionCount: number
    averageNetPerCollection: number
    revenueByBusiness: { businessName: string; netRevenue: number; collections: number }[]
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const history = await prisma.business_revenue_history.findMany({
      where: {
        user_id: userId,
        collected_at: { gte: startDate },
      },
      orderBy: { collected_at: 'desc' },
    })

    const totalGrossRevenue = history.reduce((sum, h) => sum + h.gross_revenue, 0)
    const totalOperatingCosts = history.reduce((sum, h) => sum + h.operating_cost, 0)
    const totalNetRevenue = history.reduce((sum, h) => sum + h.net_revenue, 0)
    const collectionCount = history.length
    const averageNetPerCollection = collectionCount > 0 ? Math.floor(totalNetRevenue / collectionCount) : 0

    // Group by business
    const byBusiness = new Map<string, { netRevenue: number; collections: number }>()
    for (const h of history) {
      const existing = byBusiness.get(h.business_name) || { netRevenue: 0, collections: 0 }
      byBusiness.set(h.business_name, {
        netRevenue: existing.netRevenue + h.net_revenue,
        collections: existing.collections + 1,
      })
    }

    const revenueByBusiness = Array.from(byBusiness.entries()).map(([businessName, data]) => ({
      businessName,
      ...data,
    }))

    return {
      totalGrossRevenue,
      totalOperatingCosts,
      totalNetRevenue,
      collectionCount,
      averageNetPerCollection,
      revenueByBusiness,
    }
  },

  /**
   * Get recent P&L history entries
   */
  async getRevenueHistory(userId: number, limit: number = 20): Promise<{
    id: number
    businessName: string
    grossRevenue: number
    operatingCost: number
    netRevenue: number
    collectedAt: Date
  }[]> {
    const history = await prisma.business_revenue_history.findMany({
      where: { user_id: userId },
      orderBy: { collected_at: 'desc' },
      take: limit,
    })

    return history.map(h => ({
      id: h.id,
      businessName: h.business_name,
      grossRevenue: h.gross_revenue,
      operatingCost: h.operating_cost,
      netRevenue: h.net_revenue,
      collectedAt: h.collected_at,
    }))
  },
}
