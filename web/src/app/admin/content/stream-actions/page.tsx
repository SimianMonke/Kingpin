'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// =============================================================================
// TYPES
// =============================================================================

interface StreamAction {
  id: string;
  name: string;
  description: string | null;
  category: string;
  cost: number;
  cooldownSeconds: number;
  limitPerStream: number | null;
  lumiaCommandId: string | null;
  queueBehavior: 'overwrite' | 'queue';
  maxCharacters: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface SystemLumiaSettings {
  'lumia.crown_change_command': { command: string } | null;
  'lumia.leaderboard_command': { command: string } | null;
}

type CategoryFilter = 'all' | 'lights' | 'fog' | 'sound' | 'tts';

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function StreamActionsPage() {
  const [activeTab, setActiveTab] = useState<'actions' | 'system'>('actions');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/content" className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Stream Actions
        </h1>
      </div>

      <p className="font-mono text-sm text-[var(--color-muted)]">
        Manage stream actions for the shop and configure Lumia Stream commands.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-primary)]/20 pb-2">
        {(['actions', 'system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 font-display text-xs uppercase tracking-wider transition-colors rounded-t',
              activeTab === tab
                ? 'bg-amber-500 text-black'
                : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
            )}
          >
            {tab === 'actions' ? 'Shop Actions' : 'System Commands'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'actions' && <ActionsTab />}
      {activeTab === 'system' && <SystemCommandsTab />}
    </div>
  );
}

// =============================================================================
// ACTIONS TAB
// =============================================================================

function ActionsTab() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    category: 'lights' as 'lights' | 'fog' | 'sound' | 'tts',
    cost: 100,
    cooldownSeconds: 60,
    limitPerStream: '',
    lumiaCommandId: '',
    queueBehavior: 'overwrite' as 'overwrite' | 'queue',
    maxCharacters: '',
  });

  const { data, isLoading } = useQuery<{ success: boolean; actions: StreamAction[]; total: number }>({
    queryKey: ['admin-stream-actions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stream-actions', {
        headers: { 'x-api-key': getAdminApiKey() },
      });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await fetch('/api/admin/stream-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getAdminApiKey(),
        },
        body: JSON.stringify({
          id: payload.id,
          name: payload.name,
          description: payload.description || null,
          category: payload.category,
          cost: payload.cost,
          cooldownSeconds: payload.cooldownSeconds,
          limitPerStream: payload.limitPerStream ? parseInt(payload.limitPerStream) : null,
          lumiaCommandId: payload.lumiaCommandId || null,
          queueBehavior: payload.queueBehavior,
          maxCharacters: payload.maxCharacters ? parseInt(payload.maxCharacters) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stream-actions'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: typeof formData & { isActive?: boolean }) => {
      const res = await fetch(`/api/admin/stream-actions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getAdminApiKey(),
        },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description || null,
          category: payload.category,
          cost: payload.cost,
          cooldownSeconds: payload.cooldownSeconds,
          limitPerStream: payload.limitPerStream ? parseInt(payload.limitPerStream) : null,
          lumiaCommandId: payload.lumiaCommandId || null,
          queueBehavior: payload.queueBehavior,
          maxCharacters: payload.maxCharacters ? parseInt(payload.maxCharacters) : null,
          isActive: payload.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stream-actions'] });
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/stream-actions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getAdminApiKey(),
        },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stream-actions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/stream-actions/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': getAdminApiKey() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stream-actions'] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      category: 'lights',
      cost: 100,
      cooldownSeconds: 60,
      limitPerStream: '',
      lumiaCommandId: '',
      queueBehavior: 'overwrite',
      maxCharacters: '',
    });
  };

  const handleEdit = (action: StreamAction) => {
    setEditingId(action.id);
    setFormData({
      id: action.id,
      name: action.name,
      description: action.description || '',
      category: action.category as 'lights' | 'fog' | 'sound' | 'tts',
      cost: action.cost,
      cooldownSeconds: action.cooldownSeconds,
      limitPerStream: action.limitPerStream?.toString() || '',
      lumiaCommandId: action.lumiaCommandId || '',
      queueBehavior: action.queueBehavior,
      maxCharacters: action.maxCharacters?.toString() || '',
    });
    setShowForm(true);
  };

  const filteredActions = data?.actions.filter(
    (a) => categoryFilter === 'all' || a.category === categoryFilter
  ) || [];

  const categoryCounts = {
    all: data?.actions.length || 0,
    lights: data?.actions.filter((a) => a.category === 'lights').length || 0,
    fog: data?.actions.filter((a) => a.category === 'fog').length || 0,
    sound: data?.actions.filter((a) => a.category === 'sound').length || 0,
    tts: data?.actions.filter((a) => a.category === 'tts').length || 0,
  };

  if (isLoading) {
    return <div className="text-center py-8 font-mono text-[var(--color-muted)]">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'lights', 'fog', 'sound', 'tts'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'px-3 py-1.5 rounded font-mono text-xs transition-colors',
              categoryFilter === cat
                ? 'bg-amber-500 text-black'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
            )}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {/* Add Button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 mr-2" /> Add Stream Action
        </Button>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Stream Action' : 'Add Stream Action'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) {
                  updateMutation.mutate(formData);
                } else {
                  createMutation.mutate(formData);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                    ID {!editingId && '(lowercase, underscores)'}
                  </label>
                  <Input
                    value={formData.id}
                    onChange={(e) => setFormData((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    placeholder="e.g., red_lights_burst"
                    disabled={!!editingId}
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Display name"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((f) => ({
                      ...f,
                      category: e.target.value as 'lights' | 'fog' | 'sound' | 'tts',
                      queueBehavior: e.target.value === 'tts' || e.target.value === 'sound' ? 'queue' : 'overwrite',
                    }))}
                    className="w-full h-10 rounded-md border border-[var(--color-primary)]/20 bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
                  >
                    <option value="lights">Lights</option>
                    <option value="fog">Fog</option>
                    <option value="sound">Sound</option>
                    <option value="tts">TTS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this action do?"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Cost ($)</label>
                  <Input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData((f) => ({ ...f, cost: parseInt(e.target.value) || 0 }))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Cooldown (seconds)</label>
                  <Input
                    type="number"
                    value={formData.cooldownSeconds}
                    onChange={(e) => setFormData((f) => ({ ...f, cooldownSeconds: parseInt(e.target.value) || 0 }))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Limit Per Stream</label>
                  <Input
                    type="number"
                    value={formData.limitPerStream}
                    onChange={(e) => setFormData((f) => ({ ...f, limitPerStream: e.target.value }))}
                    placeholder="Unlimited"
                    min={1}
                  />
                </div>
                {formData.category === 'tts' && (
                  <div>
                    <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Max Characters</label>
                    <Input
                      type="number"
                      value={formData.maxCharacters}
                      onChange={(e) => setFormData((f) => ({ ...f, maxCharacters: e.target.value }))}
                      placeholder="200"
                      min={1}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                    Lumia Command ID
                    <span className="text-amber-500 ml-1">(from Lumia Stream)</span>
                  </label>
                  <Input
                    value={formData.lumiaCommandId}
                    onChange={(e) => setFormData((f) => ({ ...f, lumiaCommandId: e.target.value }))}
                    placeholder="The exact command name in Lumia"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Queue Behavior</label>
                  <select
                    value={formData.queueBehavior}
                    onChange={(e) => setFormData((f) => ({ ...f, queueBehavior: e.target.value as 'overwrite' | 'queue' }))}
                    className="w-full h-10 rounded-md border border-[var(--color-primary)]/20 bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
                  >
                    <option value="overwrite">Overwrite (lights/fog)</option>
                    <option value="queue">Queue (audio/TTS)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>

              {(createMutation.isError || updateMutation.isError) && (
                <p className="text-red-400 font-mono text-xs">
                  {((createMutation.error || updateMutation.error) as Error)?.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-primary)]/20">
                <th className="text-left p-4 font-display text-xs uppercase">Name</th>
                <th className="text-left p-4 font-display text-xs uppercase">Category</th>
                <th className="text-left p-4 font-display text-xs uppercase">Lumia Command</th>
                <th className="text-center p-4 font-display text-xs uppercase">Cost</th>
                <th className="text-center p-4 font-display text-xs uppercase">Cooldown</th>
                <th className="text-center p-4 font-display text-xs uppercase">Status</th>
                <th className="text-right p-4 font-display text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredActions.map((action) => (
                <tr key={action.id} className="border-b border-[var(--color-primary)]/10 last:border-0">
                  <td className="p-4">
                    <p className="font-mono text-sm">{action.name}</p>
                    <p className="font-mono text-[10px] text-[var(--color-muted)]">{action.id}</p>
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      'px-2 py-1 rounded font-mono text-[10px] uppercase',
                      action.category === 'lights' && 'bg-yellow-500/20 text-yellow-400',
                      action.category === 'fog' && 'bg-blue-500/20 text-blue-400',
                      action.category === 'sound' && 'bg-purple-500/20 text-purple-400',
                      action.category === 'tts' && 'bg-green-500/20 text-green-400'
                    )}>
                      {action.category}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-[var(--color-muted)]">
                    {action.lumiaCommandId || <span className="text-red-400">Not configured</span>}
                  </td>
                  <td className="p-4 text-center font-mono text-sm">${action.cost.toLocaleString()}</td>
                  <td className="p-4 text-center font-mono text-xs">{action.cooldownSeconds}s</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: action.id, isActive: !action.isActive })}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-display uppercase',
                        action.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {action.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleEdit(action)} className="text-blue-400 hover:text-blue-300 mr-3">
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deactivate this stream action?')) {
                          deleteMutation.mutate(action.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredActions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-mono text-[var(--color-muted)]">
                    No stream actions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// SYSTEM COMMANDS TAB
// =============================================================================

function SystemCommandsTab() {
  const queryClient = useQueryClient();
  const [crownCommand, setCrownCommand] = useState('');
  const [leaderboardCommand, setLeaderboardCommand] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: Record<string, unknown> }>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json();
    },
    onSuccess: (data) => {
      const settings = data.data as Record<string, { command?: string }>;
      setCrownCommand(settings?.['lumia.crown_change_command']?.command || '');
      setLeaderboardCommand(settings?.['lumia.leaderboard_command']?.command || '');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      'lumia.crown_change_command': { command: crownCommand },
      'lumia.leaderboard_command': { command: leaderboardCommand },
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 font-mono text-[var(--color-muted)]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Juicernaut Events</CardTitle>
          <p className="font-mono text-xs text-[var(--color-muted)]">
            Configure which Lumia commands trigger for Juicernaut system events.
            Enter the exact command name as configured in Lumia Stream.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Crown Change */}
          <div>
            <label className="block font-mono text-sm text-[var(--color-foreground)] mb-2">
              Crown Change Command
            </label>
            <p className="font-mono text-xs text-[var(--color-muted)] mb-2">
              Triggers when a new player takes the Juicernaut lead.
              Available variables: {'{{new_juicernaut}}'}, {'{{old_juicernaut}}'}, {'{{total_usd}}'}
            </p>
            <Input
              value={crownCommand}
              onChange={(e) => {
                setCrownCommand(e.target.value);
                setHasChanges(true);
              }}
              placeholder="e.g., juicernaut-crown-change"
            />
          </div>

          {/* Leaderboard Announce */}
          <div>
            <label className="block font-mono text-sm text-[var(--color-foreground)] mb-2">
              Leaderboard Announce Command
            </label>
            <p className="font-mono text-xs text-[var(--color-muted)] mb-2">
              Triggers when the Juicernaut leaderboard is posted to chat.
              Available variables: {'{{leader_1}}'}, {'{{leader_1_usd}}'}, {'{{leader_2}}'}, {'{{leader_2_usd}}'}, etc.
            </p>
            <Input
              value={leaderboardCommand}
              onChange={(e) => {
                setLeaderboardCommand(e.target.value);
                setHasChanges(true);
              }}
              placeholder="e.g., juicernaut-leaderboard"
            />
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            {updateMutation.isSuccess && (
              <span className="text-green-400 font-mono text-xs">Settings saved!</span>
            )}
            {updateMutation.isError && (
              <span className="text-red-400 font-mono text-xs">
                {(updateMutation.error as Error)?.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 font-mono text-sm text-[var(--color-muted)]">
          <p>
            1. Create commands in Lumia Stream with the desired effects (lights, TTS, sounds, etc.)
          </p>
          <p>
            2. Enter the exact command name here (must match what you named it in Lumia)
          </p>
          <p>
            3. Use {'{{variable}}'} placeholders in your Lumia command for dynamic text
          </p>
          <p>
            4. When the event occurs, Kingpin will trigger the command with the current values
          </p>

          <div className="mt-4 p-4 bg-[var(--color-surface)] rounded">
            <p className="text-amber-500 mb-2">Example Lumia TTS Command:</p>
            <code className="text-xs">
              "All hail {'{{new_juicernaut}}'}, the new Juicernaut with ${'{{total_usd}}'} in contributions!"
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getAdminApiKey(): string {
  // In production, this would come from a secure source
  // For now, we'll use a placeholder that the API will validate
  return typeof window !== 'undefined'
    ? (window as unknown as { __ADMIN_API_KEY__?: string }).__ADMIN_API_KEY__ || ''
    : '';
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
