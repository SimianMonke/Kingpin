'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatWealth } from '@/lib/game/formulas';
import { cn } from '@/lib/utils';

interface Player {
  id: number;
  username: string;
  displayName: string | null;
  kingpinName: string | null;
  platforms: {
    kick: boolean;
    twitch: boolean;
    discord: boolean;
  };
  wealth: string;
  xp: string;
  level: number;
  tier: string;
  hp: number;
  factionId: number | null;
  createdAt: string;
  lastSeen: string;
  isBanned: boolean;
  banInfo: {
    type: string;
    expiresAt: string | null;
  } | null;
}

interface PlayersResponse {
  success: boolean;
  data: Player[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PlayersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const { data, isLoading, error } = useQuery<PlayersResponse>({
    queryKey: ['admin-players', query, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('page', page.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/admin/players?${params}`);
      if (!res.ok) throw new Error('Failed to load players');
      return res.json();
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('q', searchInput.trim());
    router.push(`/admin/players?${params}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('page', newPage.toString());
    router.push(`/admin/players?${params}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Player Management
        </h1>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by username, id:123, kick:id, twitch:id, discord:id..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-[var(--color-void)]"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          <p className="font-mono text-[10px] text-[var(--color-muted)] mt-2">
            Prefixes: id:, kick:, twitch:, discord: for specific lookups
          </p>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Results</span>
            {data?.pagination && (
              <span className="font-mono text-xs text-[var(--color-muted)]">
                {data.pagination.total} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-mono text-sm text-[var(--color-muted)]">Loading...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 font-mono">Failed to load players</p>
            </div>
          ) : data?.data.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-mono text-[var(--color-muted)]">No players found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-[var(--color-primary)]/20">
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Player</th>
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Platforms</th>
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Level</th>
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Wealth</th>
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Status</th>
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Last Seen</th>
                      <th className="pb-3 font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data.map((player) => (
                      <tr key={player.id} className="border-b border-[var(--color-primary)]/10 last:border-0 hover:bg-[var(--color-void)]/50">
                        <td className="py-3">
                          <div>
                            <p className="font-mono text-sm">{player.username}</p>
                            <p className="font-mono text-[10px] text-[var(--color-muted)]">
                              ID: {player.id}
                              {player.kingpinName && ` • ${player.kingpinName}`}
                            </p>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {player.platforms.kick && (
                              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">K</span>
                            )}
                            {player.platforms.twitch && (
                              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">T</span>
                            )}
                            {player.platforms.discord && (
                              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded">D</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <div>
                            <p className="font-mono text-sm">Lv.{player.level}</p>
                            <p className="font-mono text-[10px] text-[var(--color-muted)]">{player.tier}</p>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-sm text-[var(--color-primary)]">
                          {formatWealth(BigInt(player.wealth))}
                        </td>
                        <td className="py-3">
                          {player.isBanned ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-display uppercase rounded">
                              Banned
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-display uppercase rounded">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-[10px] text-[var(--color-muted)]">
                          {formatTimeAgo(player.lastSeen)}
                        </td>
                        <td className="py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/admin/players/${player.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-primary)]/20">
                  <p className="font-mono text-xs text-[var(--color-muted)]">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={data.pagination.page <= 1}
                      onClick={() => handlePageChange(data.pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      onClick={() => handlePageChange(data.pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
