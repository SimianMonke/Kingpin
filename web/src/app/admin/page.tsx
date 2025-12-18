'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatWealth } from '@/lib/game/formulas';
import { cn } from '@/lib/utils';

interface DashboardData {
  users: {
    total: number;
    active24h: number;
    newToday: number;
    banned: number;
  };
  economy: {
    totalWealth: string;
    avgWealth: number;
    totalXp: string;
    wealthChange24h: string;
  };
  streaming: {
    isLive: boolean;
    sessionId: number | null;
    platform?: string;
    currentJuicernaut: {
      id: number;
      username: string;
      displayName: string | null;
    } | null;
  };
  topPlayers: Array<{
    id: number;
    username: string;
    displayName: string | null;
    wealth: string;
    level: number;
    tier: string;
  }>;
  recentActions: Array<{
    id: number;
    adminName: string;
    action: string;
    category: string;
    targetName: string | null;
    createdAt: string;
  }>;
  recentEvents: Array<{
    id: number;
    username: string;
    eventType: string;
    wealthChange: string;
    success: boolean;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <p className="text-red-500 font-mono">Failed to load dashboard data</p>
      </div>
    );
  }

  const { users, economy, streaming, topPlayers, recentActions, recentEvents } = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Dashboard
        </h1>
        {streaming.isLive && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-xs text-red-400 uppercase">Live Stream</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={users.total.toLocaleString()}
          subValue={`+${users.newToday} today`}
          icon={<UsersIcon className="w-5 h-5" />}
        />
        <StatCard
          label="Active (24h)"
          value={users.active24h.toLocaleString()}
          subValue={`${((users.active24h / users.total) * 100).toFixed(1)}% of total`}
          icon={<ActivityIcon className="w-5 h-5" />}
        />
        <StatCard
          label="Total Wealth"
          value={formatWealth(BigInt(economy.totalWealth))}
          subValue={`Avg: ${formatWealth(economy.avgWealth)}`}
          icon={<DollarIcon className="w-5 h-5" />}
        />
        <StatCard
          label="Banned Users"
          value={users.banned.toString()}
          subValue="Active bans"
          icon={<BanIcon className="w-5 h-5" />}
          variant="danger"
        />
      </div>

      {/* Stream Status */}
      {streaming.isLive && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400">Stream Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="font-mono text-xs text-[var(--color-muted)]">Platform</p>
                <p className="font-display text-sm uppercase">{streaming.platform}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-[var(--color-muted)]">Juicernaut</p>
                <p className="font-display text-sm">
                  {streaming.currentJuicernaut?.username || 'None'}
                </p>
              </div>
              <div>
                <p className="font-mono text-xs text-[var(--color-muted)]">Session ID</p>
                <p className="font-mono text-sm">{streaming.sessionId}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Players */}
        <Card>
          <CardHeader>
            <CardTitle>Top Players by Wealth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPlayers.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between py-2 border-b border-[var(--color-primary)]/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 h-6 rounded flex items-center justify-center font-display text-xs',
                      index === 0 ? 'bg-amber-500/20 text-amber-500' :
                      index === 1 ? 'bg-gray-400/20 text-gray-400' :
                      index === 2 ? 'bg-orange-600/20 text-orange-600' :
                      'bg-[var(--color-surface)] text-[var(--color-muted)]'
                    )}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-mono text-sm">{player.username}</p>
                      <p className="font-mono text-[10px] text-[var(--color-muted)]">
                        Lv.{player.level} {player.tier}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-sm text-[var(--color-primary)]">
                    {formatWealth(BigInt(player.wealth))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Admin Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActions.length === 0 ? (
              <p className="text-center py-4 font-mono text-sm text-[var(--color-muted)]">
                No recent actions
              </p>
            ) : (
              <div className="space-y-3">
                {recentActions.map((action) => (
                  <div key={action.id} className="flex items-start justify-between py-2 border-b border-[var(--color-primary)]/10 last:border-0">
                    <div>
                      <p className="font-mono text-sm">
                        <span className="text-amber-500">{action.adminName}</span>
                        {' '}
                        <span className="text-[var(--color-muted)]">{formatAction(action.action)}</span>
                      </p>
                      {action.targetName && (
                        <p className="font-mono text-[10px] text-[var(--color-muted)]">
                          Target: {action.targetName}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[var(--color-muted)]">
                      {formatTimeAgo(action.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Game Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Game Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-[var(--color-primary)]/20">
                  <th className="pb-2 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Player</th>
                  <th className="pb-2 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Event</th>
                  <th className="pb-2 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Result</th>
                  <th className="pb-2 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Wealth</th>
                  <th className="pb-2 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id} className="border-b border-[var(--color-primary)]/10 last:border-0">
                    <td className="py-2 font-mono text-sm">{event.username}</td>
                    <td className="py-2 font-mono text-xs text-[var(--color-muted)]">{event.eventType}</td>
                    <td className="py-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-display uppercase',
                        event.success
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      )}>
                        {event.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className={cn(
                      'py-2 font-mono text-sm',
                      BigInt(event.wealthChange) > 0 ? 'text-green-400' :
                      BigInt(event.wealthChange) < 0 ? 'text-red-400' :
                      'text-[var(--color-muted)]'
                    )}>
                      {BigInt(event.wealthChange) > 0 ? '+' : ''}{formatWealth(BigInt(event.wealthChange))}
                    </td>
                    <td className="py-2 font-mono text-[10px] text-[var(--color-muted)]">
                      {formatTimeAgo(event.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
  variant?: 'default' | 'danger';
}) {
  return (
    <Card className={cn(
      variant === 'danger' && 'border-red-500/30'
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-[var(--color-muted)] uppercase">{label}</p>
            <p className={cn(
              'font-display text-2xl mt-1',
              variant === 'danger' ? 'text-red-400' : 'text-[var(--color-foreground)]'
            )}>
              {value}
            </p>
            {subValue && (
              <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">{subValue}</p>
            )}
          </div>
          <div className={cn(
            'p-2 rounded',
            variant === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-500'
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase();
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// =============================================================================
// ICONS
// =============================================================================

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}
