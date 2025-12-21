'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatWealth } from '@/lib/game/formulas';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface AnalyticsData {
  range: string;
  userGrowth: {
    daily: Array<{ date: string; newUsers: number; activeUsers: number }>;
    totals: { totalUsers: number; newInRange: number; averageDailyNew: number };
  };
  platformBreakdown: {
    kick: { count: number; percentage: number };
    twitch: { count: number; percentage: number };
    discord: { count: number; percentage: number };
    multiPlatform: number;
    total: number;
  };
  economyHealth: {
    totals: {
      totalWealth: string;
      averageWealth: number;
      maxWealth: string;
      minWealth: string;
    };
    distribution: Array<{ tier: string; count: number; totalWealth: string }>;
    inequality: { giniCoefficient: string; top10Percentage: number };
    flow: { totalGained: string; totalLost: string; netFlow: string };
  };
  featureUsage: {
    eventBreakdown: Array<{ type: string; count: number }>;
    highlights: {
      missionCompletions: number;
      crateOpens: number;
      heistWins: number;
      checkIns: number;
      robberyAttempts: number;
    };
  };
  gamblingStats: {
    byGame: Array<{
      gameType: string;
      sessions: number;
      totalWagered: string;
      totalPayout: string;
      houseEdge: string;
    }>;
    winRates: Array<{ gameType: string; winRate: number }>;
    jackpot: { currentPool: string; lastWinAmount: string; lastWonAt: string | null };
    lottery: { drawId: number; prizePool: string; ticketCount: number; drawAt: string } | null;
  };
  topGamblers: {
    byVolume: Array<{ username: string; displayName: string | null; totalWagered: string; netProfit: string }>;
    byProfit: Array<{ username: string; displayName: string | null; netProfit: string; totalWagered: string }>;
  };
  generatedAt: string;
}

// =============================================================================
// Page Component
// =============================================================================

export default function AnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading, error } = useQuery<{ success: boolean; data: AnalyticsData }>({
    queryKey: ['admin-analytics', range],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?range=${range}`);
      if (!res.ok) throw new Error('Failed to load analytics');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-[var(--color-muted)]/20 rounded w-24 mb-2" />
                <div className="h-8 bg-[var(--color-muted)]/20 rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-mono">Failed to load analytics data</p>
      </div>
    );
  }

  const analytics = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">Analytics</h1>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? 'default' : 'ghost'}
              onClick={() => setRange(r)}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* User Growth Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={analytics.userGrowth.totals.totalUsers.toLocaleString()}
          icon={<UsersIcon />}
        />
        <StatCard
          label={`New Users (${range})`}
          value={analytics.userGrowth.totals.newInRange.toLocaleString()}
          subValue={`~${analytics.userGrowth.totals.averageDailyNew}/day avg`}
          icon={<TrendingUpIcon />}
        />
        <StatCard
          label="Gini Coefficient"
          value={analytics.economyHealth.inequality.giniCoefficient}
          subValue="Wealth inequality (0-1)"
          icon={<BalanceIcon />}
          variant={Number(analytics.economyHealth.inequality.giniCoefficient) > 0.7 ? 'warning' : 'default'}
        />
        <StatCard
          label="Top 10% Hold"
          value={`${analytics.economyHealth.inequality.top10Percentage}%`}
          subValue="Of total wealth"
          icon={<CrownIcon />}
          variant={analytics.economyHealth.inequality.top10Percentage > 50 ? 'warning' : 'default'}
        />
      </div>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <PlatformStat
              platform="Kick"
              count={analytics.platformBreakdown.kick.count}
              percentage={analytics.platformBreakdown.kick.percentage}
              color="bg-green-500"
            />
            <PlatformStat
              platform="Twitch"
              count={analytics.platformBreakdown.twitch.count}
              percentage={analytics.platformBreakdown.twitch.percentage}
              color="bg-purple-500"
            />
            <PlatformStat
              platform="Discord"
              count={analytics.platformBreakdown.discord.count}
              percentage={analytics.platformBreakdown.discord.percentage}
              color="bg-indigo-500"
            />
            <div>
              <p className="font-mono text-xs text-[var(--color-muted)] uppercase mb-1">Multi-Platform</p>
              <p className="font-display text-2xl">{analytics.platformBreakdown.multiPlatform.toLocaleString()}</p>
              <p className="font-mono text-[10px] text-[var(--color-muted)]">
                Users with 2+ platforms linked
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle>User Growth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-1">
            {analytics.userGrowth.daily.slice(-30).map((day, i) => {
              const maxNew = Math.max(...analytics.userGrowth.daily.map(d => d.newUsers));
              const heightPercent = maxNew > 0 ? (day.newUsers / maxNew) * 100 : 0;
              return (
                <div
                  key={day.date}
                  className="flex-1 min-w-[4px] group relative"
                  title={`${day.date}: ${day.newUsers} new users`}
                >
                  <div
                    className="bg-amber-500/70 hover:bg-amber-500 transition-colors rounded-t"
                    style={{ height: `${Math.max(heightPercent, 2)}%` }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--color-void)] border border-[var(--color-primary)]/30 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    <p className="font-mono text-[10px]">{day.date}</p>
                    <p className="font-mono text-xs text-amber-500">{day.newUsers} new</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 font-mono text-[10px] text-[var(--color-muted)]">
            <span>{analytics.userGrowth.daily[0]?.date}</span>
            <span>{analytics.userGrowth.daily[analytics.userGrowth.daily.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* Economy Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wealth Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Wealth by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.economyHealth.distribution.map((tier) => {
                const totalWealth = BigInt(analytics.economyHealth.totals.totalWealth);
                const tierWealth = BigInt(tier.totalWealth);
                const percentage = totalWealth > 0 ? Number((tierWealth * BigInt(100)) / totalWealth) : 0;
                return (
                  <div key={tier.tier} className="space-y-1">
                    <div className="flex justify-between font-mono text-xs">
                      <span>{tier.tier}</span>
                      <span className="text-[var(--color-muted)]">
                        {tier.count} users · {formatWealth(tierWealth)}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface)] rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-500/70 rounded"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Wealth Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Economy Flow ({range})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Gained</p>
                <p className="font-display text-lg text-green-400">
                  +{formatWealth(BigInt(analytics.economyHealth.flow.totalGained))}
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Lost</p>
                <p className="font-display text-lg text-red-400">
                  -{formatWealth(BigInt(analytics.economyHealth.flow.totalLost))}
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Net Flow</p>
                <p className={cn(
                  'font-display text-lg',
                  BigInt(analytics.economyHealth.flow.netFlow) >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {formatWealth(BigInt(analytics.economyHealth.flow.netFlow))}
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--color-primary)]/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Total Wealth</p>
                  <p className="font-display text-xl text-amber-500">
                    {formatWealth(BigInt(analytics.economyHealth.totals.totalWealth))}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Avg Wealth</p>
                  <p className="font-display text-xl">
                    {formatWealth(analytics.economyHealth.totals.averageWealth)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage ({range})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <FeatureCard label="Missions" value={analytics.featureUsage.highlights.missionCompletions} />
            <FeatureCard label="Crates Opened" value={analytics.featureUsage.highlights.crateOpens} />
            <FeatureCard label="Heist Wins" value={analytics.featureUsage.highlights.heistWins} />
            <FeatureCard label="Check-ins" value={analytics.featureUsage.highlights.checkIns} />
            <FeatureCard label="Rob Attempts" value={analytics.featureUsage.highlights.robberyAttempts} />
          </div>
          <div className="mt-6 pt-4 border-t border-[var(--color-primary)]/20">
            <p className="font-mono text-xs text-[var(--color-muted)] mb-3 uppercase">Top Event Types</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {analytics.featureUsage.eventBreakdown.slice(0, 8).map((event) => (
                <div key={event.type} className="p-2 bg-[var(--color-surface)] rounded">
                  <p className="font-mono text-[10px] text-[var(--color-muted)] truncate">{event.type}</p>
                  <p className="font-display text-sm">{event.count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gambling Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Gambling Performance ({range})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.gamblingStats.byGame.map((game) => {
                const winRate = analytics.gamblingStats.winRates.find(w => w.gameType === game.gameType)?.winRate || 0;
                return (
                  <div key={game.gameType} className="p-3 bg-[var(--color-surface)] rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-display text-sm uppercase">{game.gameType}</span>
                      <span className="font-mono text-xs text-[var(--color-muted)]">
                        {game.sessions.toLocaleString()} sessions
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="font-mono text-[10px] text-[var(--color-muted)]">Wagered</p>
                        <p className="font-mono text-xs">{formatWealth(BigInt(game.totalWagered))}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-[var(--color-muted)]">Win Rate</p>
                        <p className="font-mono text-xs text-amber-500">{winRate}%</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-[var(--color-muted)]">House Edge</p>
                        <p className="font-mono text-xs text-green-400">{game.houseEdge}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Jackpot & Lottery */}
        <Card>
          <CardHeader>
            <CardTitle>Jackpot & Lottery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Jackpot */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded">
                <p className="font-mono text-xs text-amber-500 uppercase mb-1">Current Jackpot</p>
                <p className="font-display text-3xl text-amber-500">
                  {formatWealth(BigInt(analytics.gamblingStats.jackpot.currentPool))}
                </p>
                {analytics.gamblingStats.jackpot.lastWonAt && (
                  <p className="font-mono text-[10px] text-[var(--color-muted)] mt-2">
                    Last won: {formatWealth(BigInt(analytics.gamblingStats.jackpot.lastWinAmount))} on{' '}
                    {new Date(analytics.gamblingStats.jackpot.lastWonAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Lottery */}
              {analytics.gamblingStats.lottery ? (
                <div className="p-4 bg-[var(--color-surface)] rounded">
                  <p className="font-mono text-xs text-[var(--color-muted)] uppercase mb-1">Active Lottery</p>
                  <p className="font-display text-2xl">
                    {formatWealth(BigInt(analytics.gamblingStats.lottery.prizePool))}
                  </p>
                  <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
                    {analytics.gamblingStats.lottery.ticketCount} tickets · Draw:{' '}
                    {new Date(analytics.gamblingStats.lottery.drawAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[var(--color-surface)] rounded">
                  <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Active Lottery</p>
                  <p className="font-mono text-sm text-[var(--color-muted)]">No active draw</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Gamblers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Gamblers by Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topGamblers.byVolume.map((player, i) => (
                <div key={player.username} className="flex items-center justify-between py-2 border-b border-[var(--color-primary)]/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 h-6 rounded flex items-center justify-center font-display text-xs',
                      i === 0 ? 'bg-amber-500/20 text-amber-500' :
                      i === 1 ? 'bg-gray-400/20 text-gray-400' :
                      i === 2 ? 'bg-orange-600/20 text-orange-600' :
                      'bg-[var(--color-surface)] text-[var(--color-muted)]'
                    )}>
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm">{player.username}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{formatWealth(BigInt(player.totalWagered))}</p>
                    <p className={cn(
                      'font-mono text-[10px]',
                      BigInt(player.netProfit) >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {BigInt(player.netProfit) >= 0 ? '+' : ''}{formatWealth(BigInt(player.netProfit))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Gamblers by Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topGamblers.byProfit.map((player, i) => (
                <div key={player.username} className="flex items-center justify-between py-2 border-b border-[var(--color-primary)]/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 h-6 rounded flex items-center justify-center font-display text-xs',
                      i === 0 ? 'bg-green-500/20 text-green-500' :
                      i === 1 ? 'bg-green-400/20 text-green-400' :
                      i === 2 ? 'bg-green-300/20 text-green-300' :
                      'bg-[var(--color-surface)] text-[var(--color-muted)]'
                    )}>
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm">{player.username}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-green-400">+{formatWealth(BigInt(player.netProfit))}</p>
                    <p className="font-mono text-[10px] text-[var(--color-muted)]">
                      from {formatWealth(BigInt(player.totalWagered))} wagered
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <p className="text-center font-mono text-[10px] text-[var(--color-muted)]">
        Generated at {new Date(analytics.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function StatCard({
  label,
  value,
  subValue,
  icon,
  variant = 'default',
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card className={cn(variant === 'warning' && 'border-amber-500/30')}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-[var(--color-muted)] uppercase">{label}</p>
            <p className={cn(
              'font-display text-2xl mt-1',
              variant === 'warning' ? 'text-amber-400' : 'text-[var(--color-foreground)]'
            )}>
              {value}
            </p>
            {subValue && (
              <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">{subValue}</p>
            )}
          </div>
          <div className={cn(
            'p-2 rounded',
            variant === 'warning' ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformStat({
  platform,
  count,
  percentage,
  color,
}: {
  platform: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs text-[var(--color-muted)] uppercase mb-1">{platform}</p>
      <p className="font-display text-2xl">{count.toLocaleString()}</p>
      <div className="mt-2 h-2 bg-[var(--color-surface)] rounded overflow-hidden">
        <div className={cn('h-full rounded', color)} style={{ width: `${percentage}%` }} />
      </div>
      <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">{percentage}%</p>
    </div>
  );
}

function FeatureCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-[var(--color-surface)] rounded text-center">
      <p className="font-mono text-xs text-[var(--color-muted)] uppercase">{label}</p>
      <p className="font-display text-xl mt-1">{value.toLocaleString()}</p>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function BalanceIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l3.5 6L12 3l3.5 6L19 3v16H5V3z" />
    </svg>
  );
}
