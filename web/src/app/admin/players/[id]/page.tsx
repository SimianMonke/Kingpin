'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatWealth } from '@/lib/game/formulas';
import { cn } from '@/lib/utils';

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const playerId = params.id as string;

  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary');
  const [banDuration, setBanDuration] = useState('24');

  // Fetch player data
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-player', playerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/players/${playerId}`);
      if (!res.ok) throw new Error('Failed to load player');
      return res.json();
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to update player');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-player', playerId] });
      setEditMode(false);
      setEditValues({});
      setReason('');
    },
  });

  // Ban mutation
  const banMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/players/${playerId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: banReason,
          ban_type: banType,
          duration_hours: banType === 'temporary' ? parseInt(banDuration) : undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to ban player');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-player', playerId] });
      setBanDialogOpen(false);
      setBanReason('');
    },
  });

  // Unban mutation
  const unbanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/players/${playerId}/ban`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin action' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to unban player');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-player', playerId] });
    },
  });

  // Clear cooldowns mutation
  const clearCooldownsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/players/${playerId}/clear-cooldowns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin action' }),
      });
      if (!res.ok) throw new Error('Failed to clear cooldowns');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-player', playerId] });
    },
  });

  const handleSaveEdit = () => {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(editValues)) {
      if (value.trim()) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      editMutation.mutate(updates);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-mono">Failed to load player</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const player = data.data;
  const isBanned = player.bans?.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
              {player.username}
            </h1>
            <p className="font-mono text-xs text-[var(--color-muted)]">
              ID: {player.id} • Created: {new Date(player.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isBanned ? (
            <Button
              variant="outline"
              onClick={() => unbanMutation.mutate()}
              disabled={unbanMutation.isPending}
            >
              Unban
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setBanDialogOpen(true)}
            >
              Ban
            </Button>
          )}
        </div>
      </div>

      {/* Ban warning */}
      {isBanned && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BanIcon className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-display text-sm text-red-400 uppercase">Player is Banned</p>
                <p className="font-mono text-xs text-red-400/80">
                  {player.bans[0]?.ban_type === 'permanent' ? 'Permanent ban' :
                    `Expires: ${new Date(player.bans[0]?.expiresAt).toLocaleString()}`}
                  {' • '}{player.bans[0]?.reason}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Player Stats</CardTitle>
            {!editMode ? (
              <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setEditValues({}); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={editMutation.isPending}>
                  {editMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {editMutation.isError && (
              <p className="text-red-500 font-mono text-sm mb-4">{(editMutation.error as Error).message}</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatField
                label="Wealth"
                value={formatWealth(BigInt(player.stats.wealth))}
                editMode={editMode}
                editValue={editValues.wealth || ''}
                onEditChange={(v) => setEditValues({ ...editValues, wealth: v })}
                placeholder="+1000 or 5000"
              />
              <StatField
                label="XP"
                value={BigInt(player.stats.xp).toLocaleString()}
                editMode={editMode}
                editValue={editValues.xp || ''}
                onEditChange={(v) => setEditValues({ ...editValues, xp: v })}
                placeholder="+500 or 10000"
              />
              <StatField
                label="Level"
                value={player.stats.level.toString()}
                editMode={false}
                subValue={player.stats.tier}
              />
              <StatField
                label="HP"
                value={`${player.stats.hp}/100`}
                editMode={editMode}
                editValue={editValues.hp || ''}
                onEditChange={(v) => setEditValues({ ...editValues, hp: v })}
                placeholder="0-100"
              />
              <StatField
                label="Check-in Streak"
                value={player.stats.checkinStreak.toString()}
                editMode={editMode}
                editValue={editValues.checkin_streak || ''}
                onEditChange={(v) => setEditValues({ ...editValues, checkin_streak: v })}
              />
              <StatField
                label="Play Count"
                value={player.stats.totalPlayCount.toLocaleString()}
                editMode={false}
              />
            </div>

            {editMode && (
              <div className="mt-4 pt-4 border-t border-[var(--color-primary)]/20">
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-2">
                  Reason for changes (optional)
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you making this change?"
                  className="bg-[var(--color-void)]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Info */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-mono text-xs text-[var(--color-muted)]">Platforms</p>
              <div className="flex gap-2 mt-1">
                {player.platforms.kick && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Kick</span>
                )}
                {player.platforms.twitch && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">Twitch</span>
                )}
                {player.platforms.discord && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Discord</span>
                )}
              </div>
            </div>

            <div>
              <p className="font-mono text-xs text-[var(--color-muted)]">Faction</p>
              <p className="font-mono text-sm">
                {player.faction ? player.faction.name : 'None'}
              </p>
            </div>

            <div>
              <p className="font-mono text-xs text-[var(--color-muted)]">Last Seen</p>
              <p className="font-mono text-sm">
                {new Date(player.lastSeen).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="font-mono text-xs text-[var(--color-muted)]">Active Cooldowns</p>
              <p className="font-mono text-sm">
                {player.cooldowns?.length || 0}
                {player.cooldowns?.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2"
                    onClick={() => clearCooldownsMutation.mutate()}
                    disabled={clearCooldownsMutation.isPending}
                  >
                    Clear All
                  </Button>
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-xs text-[var(--color-muted)]">Active Buffs</p>
              <p className="font-mono text-sm">{player.buffs?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory & Crates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory ({player.inventory?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {player.inventory?.length === 0 ? (
              <p className="font-mono text-sm text-[var(--color-muted)]">No items</p>
            ) : (
              <div className="space-y-2">
                {player.inventory?.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-[var(--color-primary)]/10 last:border-0">
                    <div>
                      <p className="font-mono text-sm">{item.itemName}</p>
                      <p className="font-mono text-[10px] text-[var(--color-muted)]">
                        {item.itemType} • {item.itemTier} • Durability: {item.durability}%
                      </p>
                    </div>
                    {item.isEquipped && (
                      <span className="px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] rounded">
                        Equipped
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crates</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(player.crates || {}).length === 0 ? (
              <p className="font-mono text-sm text-[var(--color-muted)]">No crates</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(player.crates).map(([tier, count]) => (
                  <div key={tier} className="p-3 bg-[var(--color-void)] rounded">
                    <p className="font-display text-xs uppercase text-[var(--color-muted)]">{tier}</p>
                    <p className="font-mono text-lg">{count as number}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin History */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Action History</CardTitle>
        </CardHeader>
        <CardContent>
          {player.adminHistory?.length === 0 ? (
            <p className="font-mono text-sm text-[var(--color-muted)]">No admin actions on this player</p>
          ) : (
            <div className="space-y-2">
              {player.adminHistory?.map((action: any) => (
                <div key={action.id} className="flex items-start justify-between py-2 border-b border-[var(--color-primary)]/10 last:border-0">
                  <div>
                    <p className="font-mono text-sm">
                      <span className="text-amber-500">{action.adminName}</span>
                      {' '}<span className="text-[var(--color-muted)]">{action.action.replace(/_/g, ' ').toLowerCase()}</span>
                    </p>
                    {action.reason && (
                      <p className="font-mono text-[10px] text-[var(--color-muted)]">
                        Reason: {action.reason}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-muted)]">
                    {new Date(action.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban Player</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban {player.username}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block font-mono text-xs text-[var(--color-muted)] mb-2">Ban Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={banType === 'temporary'}
                    onChange={() => setBanType('temporary')}
                    className="accent-amber-500"
                  />
                  <span className="font-mono text-sm">Temporary</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={banType === 'permanent'}
                    onChange={() => setBanType('permanent')}
                    className="accent-amber-500"
                  />
                  <span className="font-mono text-sm">Permanent</span>
                </label>
              </div>
            </div>

            {banType === 'temporary' && (
              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-2">Duration (hours)</label>
                <Input
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  min={1}
                  className="bg-[var(--color-void)]"
                />
              </div>
            )}

            <div>
              <label className="block font-mono text-xs text-[var(--color-muted)] mb-2">Reason (required)</label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Why is this player being banned?"
                className="bg-[var(--color-void)]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => banMutation.mutate()}
              disabled={!banReason.trim() || banMutation.isPending}
            >
              {banMutation.isPending ? 'Banning...' : 'Confirm Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// STAT FIELD COMPONENT
// =============================================================================

function StatField({
  label,
  value,
  subValue,
  editMode,
  editValue,
  onEditChange,
  placeholder,
}: {
  label: string;
  value: string;
  subValue?: string;
  editMode: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="p-3 bg-[var(--color-void)] rounded">
      <p className="font-mono text-xs text-[var(--color-muted)]">{label}</p>
      {editMode && onEditChange ? (
        <Input
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          placeholder={placeholder || value}
          className="mt-1 bg-transparent border-[var(--color-primary)]/30 h-8 text-sm"
        />
      ) : (
        <>
          <p className="font-mono text-lg">{value}</p>
          {subValue && (
            <p className="font-mono text-[10px] text-[var(--color-muted)]">{subValue}</p>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
