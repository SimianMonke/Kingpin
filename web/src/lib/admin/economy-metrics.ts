// =============================================================================
// ECONOMY METRICS - Phase 1 Economy Rebalance Telemetry
// =============================================================================

import { prisma } from '../db'

// Helper functions for date manipulation (avoiding external dependencies)
function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

// =============================================================================
// TYPES
// =============================================================================

export interface DailyEconomySnapshot {
  date: Date
  totalWealth: bigint
  totalPlayers: number
  activePlayers: number // Players with activity in last 7 days
  wealthInjected: bigint
  wealthRemoved: bigint
  netFlow: bigint
  topPlayerWealth: bigint
  medianWealth: bigint
  giniCoefficient: number
}

export interface EconomyBreakdown {
  playRewards: bigint
  businessRevenue: bigint
  missionRewards: bigint
  checkinRewards: bigint
  gamblingNet: bigint // Can be negative (sink)
  robberyNet: bigint // Neutral transfer, not tracked
  bailPaid: bigint
  purchases: bigint
}

export interface EconomyHealthStatus {
  status: 'healthy' | 'warning' | 'critical'
  inflationRate: number // Daily % change in total wealth
  sinkToFaucetRatio: number
  giniCoefficient: number
  topTenWealthShare: number
  alerts: string[]
}

// Alert thresholds from implementation doc
const ALERT_THRESHOLDS = {
  DAILY_INJECTION_RATIO: 2.0, // Alert if injected > 2x removed
  GINI_WARNING: 0.7,
  GINI_CRITICAL: 0.8,
  TOP_TEN_SHARE_WARNING: 0.4,
  TOP_TEN_SHARE_CRITICAL: 0.5,
  INFLATION_WARNING: 0.1, // 10% daily
  INFLATION_CRITICAL: 0.25, // 25% daily
}

// =============================================================================
// SNAPSHOT CAPTURE
// =============================================================================

/**
 * Capture current economy snapshot for monitoring
 */
export async function captureEconomySnapshot(): Promise<DailyEconomySnapshot> {
  const todayStart = startOfDay(new Date())
  const sevenDaysAgo = subDays(todayStart, 7)

  const [
    totalWealthResult,
    playerCount,
    activePlayerCount,
    injections,
    removals,
    topPlayer,
    wealthDistribution,
  ] = await Promise.all([
    // Total wealth across all users
    prisma.users.aggregate({
      _sum: { wealth: true },
    }),

    // Total player count
    prisma.users.count(),

    // Active players (any game_events in last 7 days)
    prisma.game_events.groupBy({
      by: ['user_id'],
      where: {
        created_at: { gte: sevenDaysAgo },
        user_id: { not: null },
      },
    }).then(results => results.length),

    // Wealth injected today (positive wealth_change events)
    prisma.game_events.aggregate({
      where: {
        created_at: { gte: todayStart },
        wealth_change: { gt: 0 },
        event_type: {
          in: ['play', 'checkin', 'mission_complete', 'crate_open'],
        },
      },
      _sum: { wealth_change: true },
    }),

    // Wealth removed today (negative wealth_change + gambling losses)
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COALESCE(SUM(ABS(wealth_change)), 0) as total
      FROM game_events
      WHERE created_at >= ${todayStart}
        AND wealth_change < 0
        AND event_type IN ('bail', 'purchase', 'rob_victim')
    `.then(r => ({ _sum: { wealth_change: r[0]?.total || BigInt(0) } })),

    // Top player by wealth
    prisma.users.findFirst({
      orderBy: { wealth: 'desc' },
      select: { wealth: true },
    }),

    // All wealth values for distribution analysis
    prisma.users.findMany({
      select: { wealth: true },
      where: { wealth: { gt: 0 } },
      orderBy: { wealth: 'asc' },
    }),
  ])

  const totalWealth = totalWealthResult._sum.wealth || BigInt(0)
  const wealthInjected = injections._sum.wealth_change || BigInt(0)
  const wealthRemoved = removals._sum.wealth_change || BigInt(0)
  const netFlow = wealthInjected - wealthRemoved

  // Calculate median wealth
  const wealthValues = wealthDistribution.map(u => u.wealth || BigInt(0))
  const medianWealth = wealthValues.length > 0
    ? wealthValues[Math.floor(wealthValues.length / 2)]
    : BigInt(0)

  // Calculate Gini coefficient
  const giniCoefficient = calculateGini(wealthValues.map(w => Number(w)))

  return {
    date: new Date(),
    totalWealth,
    totalPlayers: playerCount,
    activePlayers: activePlayerCount,
    wealthInjected,
    wealthRemoved,
    netFlow,
    topPlayerWealth: topPlayer?.wealth || BigInt(0),
    medianWealth,
    giniCoefficient,
  }
}

/**
 * Get detailed economy breakdown by source/sink
 */
export async function getEconomyBreakdown(daysBack: number = 1): Promise<EconomyBreakdown> {
  const startDate = subDays(startOfDay(new Date()), daysBack - 1)

  const [
    playEvents,
    businessRevenue,
    missionEvents,
    checkinEvents,
    gamblingStats,
    bailEvents,
    purchaseEvents,
  ] = await Promise.all([
    // Play command rewards
    prisma.game_events.aggregate({
      where: {
        created_at: { gte: startDate },
        event_type: 'play',
        wealth_change: { gt: 0 },
      },
      _sum: { wealth_change: true },
    }),

    // Business revenue
    prisma.business_revenue_history.aggregate({
      where: {
        collected_at: { gte: startDate },
      },
      _sum: { net_revenue: true },
    }),

    // Mission rewards
    prisma.game_events.aggregate({
      where: {
        created_at: { gte: startDate },
        event_type: 'mission_complete',
        wealth_change: { gt: 0 },
      },
      _sum: { wealth_change: true },
    }),

    // Check-in rewards
    prisma.game_events.aggregate({
      where: {
        created_at: { gte: startDate },
        event_type: 'checkin',
        wealth_change: { gt: 0 },
      },
      _sum: { wealth_change: true },
    }),

    // Gambling net (payout - wager)
    prisma.gambling_sessions.aggregate({
      where: {
        created_at: { gte: startDate },
      },
      _sum: {
        wager_amount: true,
        payout: true,
      },
    }),

    // Bail payments
    prisma.game_events.aggregate({
      where: {
        created_at: { gte: startDate },
        event_type: 'bail',
        wealth_change: { lt: 0 },
      },
      _sum: { wealth_change: true },
    }),

    // Purchases (shop, etc.)
    prisma.game_events.aggregate({
      where: {
        created_at: { gte: startDate },
        event_type: 'purchase',
        wealth_change: { lt: 0 },
      },
      _sum: { wealth_change: true },
    }),
  ])

  const gamblingNet = (gamblingStats._sum.payout || BigInt(0)) -
    (gamblingStats._sum.wager_amount || BigInt(0))

  return {
    playRewards: playEvents._sum.wealth_change || BigInt(0),
    businessRevenue: BigInt(businessRevenue._sum.net_revenue || 0),
    missionRewards: missionEvents._sum.wealth_change || BigInt(0),
    checkinRewards: checkinEvents._sum.wealth_change || BigInt(0),
    gamblingNet,
    robberyNet: BigInt(0), // Robbery is wealth transfer, not creation/destruction
    bailPaid: BigInt(Math.abs(Number(bailEvents._sum.wealth_change || 0))),
    purchases: BigInt(Math.abs(Number(purchaseEvents._sum.wealth_change || 0))),
  }
}

// =============================================================================
// HEALTH MONITORING
// =============================================================================

type HealthStatus = 'healthy' | 'warning' | 'critical'

// Helper to upgrade status level (critical > warning > healthy)
function upgradeStatus(current: HealthStatus, next: HealthStatus): HealthStatus {
  const levels: Record<HealthStatus, number> = { healthy: 0, warning: 1, critical: 2 }
  return levels[next] > levels[current] ? next : current
}

/**
 * Evaluate economy health status with alerts
 */
export async function evaluateEconomyHealth(): Promise<EconomyHealthStatus> {
  const snapshot = await captureEconomySnapshot()
  const alerts: string[] = []
  let status: HealthStatus = 'healthy'

  // Calculate inflation rate (need yesterday's total for comparison)
  const yesterdaySnapshot = await prisma.users.aggregate({
    _sum: { wealth: true },
  })
  const yesterdayWealth = yesterdaySnapshot._sum.wealth || BigInt(1)
  const inflationRate = Number(snapshot.totalWealth - yesterdayWealth) / Number(yesterdayWealth)

  // Sink to faucet ratio
  const sinkToFaucetRatio = Number(snapshot.wealthRemoved) /
    Math.max(1, Number(snapshot.wealthInjected))

  // Top 10 wealth share
  const top10 = await prisma.users.findMany({
    orderBy: { wealth: 'desc' },
    take: 10,
    select: { wealth: true },
  })
  const top10Wealth = top10.reduce((sum, u) => sum + Number(u.wealth || 0), 0)
  const topTenWealthShare = top10Wealth / Math.max(1, Number(snapshot.totalWealth))

  // Evaluate alerts - check each condition and upgrade status as needed
  if (Number(snapshot.wealthInjected) > Number(snapshot.wealthRemoved) * ALERT_THRESHOLDS.DAILY_INJECTION_RATIO) {
    alerts.push(`Inflation warning: Injected $${Number(snapshot.wealthInjected).toLocaleString()} vs removed $${Number(snapshot.wealthRemoved).toLocaleString()}`)
    status = upgradeStatus(status, 'warning')
  }

  if (snapshot.giniCoefficient > ALERT_THRESHOLDS.GINI_CRITICAL) {
    alerts.push(`Critical inequality: Gini coefficient ${snapshot.giniCoefficient.toFixed(3)} exceeds ${ALERT_THRESHOLDS.GINI_CRITICAL}`)
    status = upgradeStatus(status, 'critical')
  } else if (snapshot.giniCoefficient > ALERT_THRESHOLDS.GINI_WARNING) {
    alerts.push(`Inequality warning: Gini coefficient ${snapshot.giniCoefficient.toFixed(3)}`)
    status = upgradeStatus(status, 'warning')
  }

  if (topTenWealthShare > ALERT_THRESHOLDS.TOP_TEN_SHARE_CRITICAL) {
    alerts.push(`Critical wealth concentration: Top 10 hold ${(topTenWealthShare * 100).toFixed(1)}% of wealth`)
    status = upgradeStatus(status, 'critical')
  } else if (topTenWealthShare > ALERT_THRESHOLDS.TOP_TEN_SHARE_WARNING) {
    alerts.push(`Wealth concentration warning: Top 10 hold ${(topTenWealthShare * 100).toFixed(1)}%`)
    status = upgradeStatus(status, 'warning')
  }

  if (inflationRate > ALERT_THRESHOLDS.INFLATION_CRITICAL) {
    alerts.push(`Critical inflation: ${(inflationRate * 100).toFixed(1)}% daily growth`)
    status = upgradeStatus(status, 'critical')
  } else if (inflationRate > ALERT_THRESHOLDS.INFLATION_WARNING) {
    alerts.push(`Inflation warning: ${(inflationRate * 100).toFixed(1)}% daily growth`)
    status = upgradeStatus(status, 'warning')
  }

  return {
    status,
    inflationRate,
    sinkToFaucetRatio,
    giniCoefficient: snapshot.giniCoefficient,
    topTenWealthShare,
    alerts,
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate Gini coefficient for wealth distribution
 * Returns value between 0 (perfect equality) and 1 (perfect inequality)
 */
function calculateGini(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((a, b) => a + b, 0) / n

  if (mean === 0) return 0

  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i]
  }

  return sum / (n * n * mean)
}

/**
 * Format bigint wealth for display
 */
export function formatWealthBigInt(amount: bigint): string {
  const num = Number(amount)
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toLocaleString()}`
}
