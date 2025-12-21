'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatWealth } from '@/lib/game/formulas';
import { cn } from '@/lib/utils';

interface EconomyStats {
  overview: {
    totalWealth: string;
    totalXp: string;
    avgWealth: number;
    totalPlayers: number;
    wealthChange24h: string;
  };
  jackpot: {
    currentPool: string;
    lastWinnerId: number | null;
    lastWinAmount: string;
    lastWonAt: string | null;
    contributionRate: string;
  } | null;
  lottery: {
    drawId: number;
    drawType: string;
    prizePool: string;
    status: string;
    drawAt: string;
    ticketCount: number;
  } | null;
  distribution: {
    ranges: Array<{ label: string; count: number; totalWealth: string }>;
  };
  recentFlow: {
    sources: Record<string, { amount: string; count: number }>;
    sinks: Record<string, { amount: string; count: number }>;
  };
  gambling24h: {
    totalWagered: string;
    totalPaid: string;
    netHouseProfit: string;
    gamesPlayed: number;
    byGame: Record<string, { wagered: string; paid: string; count: number }>;
  };
}

export default function EconomyPage() {
  const queryClient = useQueryClient();
  const [adjustTab, setAdjustTab] = useState<'adjust' | 'jackpot' | 'lottery'>('adjust');

  // Form states
  const [adjustForm, setAdjustForm] = useState({
    userId: '',
    type: 'wealth' as 'wealth' | 'xp',
    amount: '',
    reason: '',
  });

  const [jackpotForm, setJackpotForm] = useState({
    seedAmount: '10000',
    reason: '',
  });

  const { data, isLoading, error } = useQuery<{ success: boolean; data: EconomyStats }>({
    queryKey: ['admin-economy-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/economy/stats');
      if (!res.ok) throw new Error('Failed to load economy stats');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Adjust mutation
  const adjustMutation = useMutation({
    mutationFn: async (payload: typeof adjustForm) => {
      const res = await fetch('/api/admin/economy/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(payload.userId),
          type: payload.type,
          amount: parseInt(payload.amount),
          reason: payload.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to adjust');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-economy-stats'] });
      setAdjustForm({ userId: '', type: 'wealth', amount: '', reason: '' });
    },
  });

  // Jackpot reset mutation
  const jackpotMutation = useMutation({
    mutationFn: async (payload: typeof jackpotForm) => {
      const res = await fetch('/api/admin/economy/jackpot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedAmount: parseInt(payload.seedAmount),
          reason: payload.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reset jackpot');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-economy-stats'] });
      setJackpotForm({ seedAmount: '10000', reason: '' });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">Economy</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
        <p className="text-red-500 font-mono">Failed to load economy data</p>
      </div>
    );
  }

  const { overview, jackpot, lottery, distribution, gambling24h } = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
        Economy Management
      </h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Wealth"
          value={formatWealth(BigInt(overview.totalWealth))}
          subValue={`Avg: ${formatWealth(overview.avgWealth)}`}
          icon={<WealthIcon className="w-5 h-5" />}
        />
        <StatCard
          label="24h Net Flow"
          value={formatWealth(BigInt(overview.wealthChange24h))}
          subValue={BigInt(overview.wealthChange24h) >= 0 ? 'Inflation' : 'Deflation'}
          icon={<FlowIcon className="w-5 h-5" />}
          variant={BigInt(overview.wealthChange24h) >= 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Jackpot Pool"
          value={jackpot ? formatWealth(BigInt(jackpot.currentPool)) : '$10,000'}
          subValue="Slots jackpot"
          icon={<JackpotIcon className="w-5 h-5" />}
        />
        <StatCard
          label="Lottery Pool"
          value={lottery ? formatWealth(BigInt(lottery.prizePool)) : '$0'}
          subValue={lottery ? `${lottery.ticketCount} tickets` : 'No active draw'}
          icon={<LotteryIcon className="w-5 h-5" />}
        />
      </div>

      {/* Gambling 24h Stats */}
      <Card>
        <CardHeader>
          <CardTitle>24h Gambling Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Total Wagered</p>
              <p className="font-display text-xl text-amber-500">
                {formatWealth(BigInt(gambling24h.totalWagered))}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Total Paid Out</p>
              <p className="font-display text-xl text-green-400">
                {formatWealth(BigInt(gambling24h.totalPaid))}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-[var(--color-muted)] uppercase">House Profit</p>
              <p className={cn(
                'font-display text-xl',
                BigInt(gambling24h.netHouseProfit) >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {formatWealth(BigInt(gambling24h.netHouseProfit))}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-[var(--color-muted)] uppercase">Games Played</p>
              <p className="font-display text-xl">
                {gambling24h.gamesPlayed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* By Game */}
          <div className="mt-6 pt-4 border-t border-[var(--color-primary)]/20">
            <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-3">By Game</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(gambling24h.byGame).map(([game, stats]) => (
                <div key={game} className="bg-[var(--color-void)]/50 p-3 rounded">
                  <p className="font-display text-xs uppercase text-amber-500">{game}</p>
                  <p className="font-mono text-sm mt-1">{stats.count.toLocaleString()} plays</p>
                  <p className="font-mono text-[10px] text-[var(--color-muted)]">
                    {formatWealth(BigInt(stats.wagered))} wagered
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wealth Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Wealth Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {distribution.ranges.map((range) => {
              const percentage = overview.totalPlayers > 0
                ? (range.count / overview.totalPlayers * 100).toFixed(1)
                : '0';
              return (
                <div key={range.label} className="flex items-center gap-4">
                  <div className="w-28 font-mono text-xs">{range.label}</div>
                  <div className="flex-1 bg-[var(--color-void)] rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-amber-500/60 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs text-[var(--color-muted)]">
                    {range.count.toLocaleString()} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CardTitle>Admin Actions</CardTitle>
            <div className="flex gap-1">
              {(['adjust', 'jackpot', 'lottery'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAdjustTab(tab)}
                  className={cn(
                    'px-3 py-1 rounded font-display text-xs uppercase transition-colors',
                    adjustTab === tab
                      ? 'bg-amber-500 text-black'
                      : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Manual Adjustment Tab */}
          {adjustTab === 'adjust' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!adjustForm.userId || !adjustForm.amount || !adjustForm.reason) return;
                adjustMutation.mutate(adjustForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                    Player ID
                  </label>
                  <Input
                    type="number"
                    value={adjustForm.userId}
                    onChange={(e) => setAdjustForm(f => ({ ...f, userId: e.target.value }))}
                    placeholder="Enter player ID"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                    Type
                  </label>
                  <div className="flex gap-2">
                    {(['wealth', 'xp'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAdjustForm(f => ({ ...f, type }))}
                        className={cn(
                          'flex-1 py-2 rounded font-display text-xs uppercase',
                          adjustForm.type === type
                            ? 'bg-amber-500 text-black'
                            : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                  Amount (use negative for removal)
                </label>
                <Input
                  type="number"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 1000 or -500"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                  Reason (required)
                </label>
                <Input
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Reason for this adjustment"
                />
              </div>

              <Button
                type="submit"
                disabled={adjustMutation.isPending || !adjustForm.userId || !adjustForm.amount || !adjustForm.reason}
                className="w-full"
              >
                {adjustMutation.isPending ? 'Applying...' : 'Apply Adjustment'}
              </Button>

              {adjustMutation.isSuccess && (
                <p className="text-green-400 font-mono text-sm text-center">
                  Adjustment applied successfully!
                </p>
              )}
              {adjustMutation.isError && (
                <p className="text-red-400 font-mono text-sm text-center">
                  {(adjustMutation.error as Error).message}
                </p>
              )}
            </form>
          )}

          {/* Jackpot Tab */}
          {adjustTab === 'jackpot' && (
            <div className="space-y-4">
              <div className="bg-[var(--color-void)]/50 p-4 rounded">
                <p className="font-mono text-xs text-[var(--color-muted)]">Current Jackpot Pool</p>
                <p className="font-display text-2xl text-amber-500 mt-1">
                  {jackpot ? formatWealth(BigInt(jackpot.currentPool)) : '$10,000'}
                </p>
                {jackpot?.lastWonAt && (
                  <p className="font-mono text-[10px] text-[var(--color-muted)] mt-2">
                    Last won: {new Date(jackpot.lastWonAt).toLocaleDateString()} ({formatWealth(BigInt(jackpot.lastWinAmount))})
                  </p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!jackpotForm.reason) return;
                  if (!confirm(`Reset jackpot to $${parseInt(jackpotForm.seedAmount).toLocaleString()}?`)) return;
                  jackpotMutation.mutate(jackpotForm);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                    New Seed Amount
                  </label>
                  <Input
                    type="number"
                    value={jackpotForm.seedAmount}
                    onChange={(e) => setJackpotForm(f => ({ ...f, seedAmount: e.target.value }))}
                    min={0}
                    max={10000000}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                    Reason (required)
                  </label>
                  <Input
                    value={jackpotForm.reason}
                    onChange={(e) => setJackpotForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Reason for reset"
                  />
                </div>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={jackpotMutation.isPending || !jackpotForm.reason}
                  className="w-full"
                >
                  {jackpotMutation.isPending ? 'Resetting...' : 'Reset Jackpot'}
                </Button>

                {jackpotMutation.isSuccess && (
                  <p className="text-green-400 font-mono text-sm text-center">
                    Jackpot reset successfully!
                  </p>
                )}
                {jackpotMutation.isError && (
                  <p className="text-red-400 font-mono text-sm text-center">
                    {(jackpotMutation.error as Error).message}
                  </p>
                )}
              </form>
            </div>
          )}

          {/* Lottery Tab */}
          {adjustTab === 'lottery' && (
            <div className="space-y-4">
              {lottery ? (
                <>
                  <div className="bg-[var(--color-void)]/50 p-4 rounded">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="font-mono text-xs text-[var(--color-muted)]">Draw ID</p>
                        <p className="font-display text-lg">#{lottery.drawId}</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-[var(--color-muted)]">Prize Pool</p>
                        <p className="font-display text-lg text-amber-500">
                          {formatWealth(BigInt(lottery.prizePool))}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-[var(--color-muted)]">Tickets</p>
                        <p className="font-display text-lg">{lottery.ticketCount}</p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-[var(--color-muted)]">Scheduled</p>
                        <p className="font-mono text-sm">
                          {new Date(lottery.drawAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <LotteryForceDrawForm drawId={lottery.drawId} />
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="font-mono text-[var(--color-muted)]">No active lottery draw</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// LOTTERY FORCE DRAW FORM
// =============================================================================

function LotteryForceDrawForm({ drawId }: { drawId: number }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/economy/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to execute draw');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-economy-stats'] });
      setReason('');
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason) return;
        if (!confirm(`Force execute lottery draw #${drawId}? This cannot be undone.`)) return;
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
          Reason for forced draw (required)
        </label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for forcing this draw"
        />
      </div>

      <Button
        type="submit"
        variant="destructive"
        disabled={mutation.isPending || !reason}
        className="w-full"
      >
        {mutation.isPending ? 'Executing...' : 'Force Execute Draw'}
      </Button>

      {mutation.isSuccess && (
        <div className="bg-green-500/20 p-4 rounded">
          <p className="text-green-400 font-mono text-sm">Draw executed successfully!</p>
          {mutation.data?.data && (
            <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
              Winning numbers: {mutation.data.data.winningNumbers?.join(', ')}
            </p>
          )}
        </div>
      )}
      {mutation.isError && (
        <p className="text-red-400 font-mono text-sm text-center">
          {(mutation.error as Error).message}
        </p>
      )}
    </form>
  );
}

// =============================================================================
// STAT CARD COMPONENT
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
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    default: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
    success: { bg: 'bg-green-500/20', text: 'text-green-400' },
    warning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    danger: { bg: 'bg-red-500/20', text: 'text-red-400' },
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-[var(--color-muted)] uppercase">{label}</p>
            <p className="font-display text-2xl mt-1">{value}</p>
            {subValue && (
              <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">{subValue}</p>
            )}
          </div>
          <div className={cn('p-2 rounded', colors[variant].bg, colors[variant].text)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function WealthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FlowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function JackpotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function LotteryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}
