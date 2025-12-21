import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/auth';
import {
  captureEconomySnapshot,
  getEconomyBreakdown,
  evaluateEconomyHealth,
  formatWealthBigInt,
} from '@/lib/admin/economy-metrics';

// =============================================================================
// GET /api/admin/economy/metrics - Phase 1 Economy Telemetry
// =============================================================================

export const GET = withAdminAuth(async (req: NextRequest, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const daysBack = parseInt(searchParams.get('days') || '1', 10);

    // Fetch all economy metrics in parallel
    const [snapshot, breakdown, health] = await Promise.all([
      captureEconomySnapshot(),
      getEconomyBreakdown(daysBack),
      evaluateEconomyHealth(),
    ]);

    // Calculate totals
    const totalFaucets = Number(breakdown.playRewards) +
      Number(breakdown.businessRevenue) +
      Number(breakdown.missionRewards) +
      Number(breakdown.checkinRewards);

    const totalSinks = Number(breakdown.bailPaid) +
      Number(breakdown.purchases) +
      Math.max(0, -Number(breakdown.gamblingNet)); // Only count net losses

    return NextResponse.json({
      success: true,
      data: {
        snapshot: {
          date: snapshot.date.toISOString(),
          totalWealth: snapshot.totalWealth.toString(),
          totalWealthFormatted: formatWealthBigInt(snapshot.totalWealth),
          totalPlayers: snapshot.totalPlayers,
          activePlayers: snapshot.activePlayers,
          wealthInjected: snapshot.wealthInjected.toString(),
          wealthInjectedFormatted: formatWealthBigInt(snapshot.wealthInjected),
          wealthRemoved: snapshot.wealthRemoved.toString(),
          wealthRemovedFormatted: formatWealthBigInt(snapshot.wealthRemoved),
          netFlow: snapshot.netFlow.toString(),
          netFlowFormatted: formatWealthBigInt(snapshot.netFlow),
          topPlayerWealth: snapshot.topPlayerWealth.toString(),
          topPlayerWealthFormatted: formatWealthBigInt(snapshot.topPlayerWealth),
          medianWealth: snapshot.medianWealth.toString(),
          medianWealthFormatted: formatWealthBigInt(snapshot.medianWealth),
          giniCoefficient: snapshot.giniCoefficient,
        },
        breakdown: {
          period: `${daysBack} day(s)`,
          faucets: {
            playRewards: breakdown.playRewards.toString(),
            businessRevenue: breakdown.businessRevenue.toString(),
            missionRewards: breakdown.missionRewards.toString(),
            checkinRewards: breakdown.checkinRewards.toString(),
            total: totalFaucets.toString(),
            totalFormatted: formatWealthBigInt(BigInt(totalFaucets)),
          },
          sinks: {
            bailPaid: breakdown.bailPaid.toString(),
            purchases: breakdown.purchases.toString(),
            gamblingLosses: Math.max(0, -Number(breakdown.gamblingNet)).toString(),
            total: totalSinks.toString(),
            totalFormatted: formatWealthBigInt(BigInt(totalSinks)),
          },
          gamblingNet: breakdown.gamblingNet.toString(),
          gamblingNetFormatted: formatWealthBigInt(breakdown.gamblingNet),
        },
        health: {
          status: health.status,
          inflationRate: health.inflationRate,
          inflationRatePercent: `${(health.inflationRate * 100).toFixed(2)}%`,
          sinkToFaucetRatio: health.sinkToFaucetRatio,
          sinkToFaucetRatioPercent: `${(health.sinkToFaucetRatio * 100).toFixed(1)}%`,
          giniCoefficient: health.giniCoefficient,
          topTenWealthShare: health.topTenWealthShare,
          topTenWealthSharePercent: `${(health.topTenWealthShare * 100).toFixed(1)}%`,
          alerts: health.alerts,
        },
        // Phase 1 specific metrics
        phase1: {
          businessDailyCapActive: true,
          businessDailyCap: '$50,000',
          playWealthCapsActive: true,
          bailRatePercent: '15%',
          bailMin: '$500',
          bailMax: '$100,000',
        },
      },
    });
  } catch (error) {
    console.error('Economy metrics error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch economy metrics' } },
      { status: 500 }
    );
  }
}, { requiredPermission: 'view_economy' });
