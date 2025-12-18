'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Setting {
  key: string;
  value: unknown;
  value_type: string;
  label: string;
  description: string | null;
  constraints: {
    min?: number;
    max?: number;
    options?: string[];
  } | null;
  is_sensitive: boolean;
}

interface GroupedSettings {
  [category: string]: Setting[];
}

const CATEGORY_INFO: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  features: {
    name: 'Feature Flags',
    description: 'Enable or disable game features globally',
    icon: <ToggleIcon className="w-5 h-5" />,
  },
  economy: {
    name: 'Economy',
    description: 'Multipliers and economic adjustments for events',
    icon: <DollarIcon className="w-5 h-5" />,
  },
  gameplay: {
    name: 'Gameplay',
    description: 'Cooldowns and game mechanics tuning',
    icon: <GameIcon className="w-5 h-5" />,
  },
  display: {
    name: 'Display',
    description: 'UI messages and announcements',
    icon: <MessageIcon className="w-5 h-5" />,
  },
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState('');

  const { data, isLoading, error } = useQuery<{ success: boolean; data: GroupedSettings }>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: pendingChanges, reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to save settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setPendingChanges({});
      setReason('');
    },
  });

  const handleChange = (key: string, value: unknown) => {
    setPendingChanges((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = (key: string) => {
    setPendingChanges((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Settings
        </h1>
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-[var(--color-muted)]/20 rounded w-32 mb-4" />
                <div className="h-8 bg-[var(--color-muted)]/20 rounded w-full" />
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
        <p className="text-red-500 font-mono">Failed to load settings</p>
      </div>
    );
  }

  const settings = data.data;
  const categories = Object.keys(settings).sort((a, b) => {
    const order = ['features', 'economy', 'gameplay', 'display'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Settings
        </h1>
        {hasChanges && (
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-amber-500">
              {Object.keys(pendingChanges).length} unsaved changes
            </span>
            <Button variant="ghost" onClick={() => setPendingChanges({})}>
              Discard
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* Error */}
      {saveMutation.isError && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <p className="text-red-400 font-mono text-sm">{(saveMutation.error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {/* Reason input when there are changes */}
      {hasChanges && (
        <Card>
          <CardContent className="p-4">
            <label className="block font-mono text-xs text-[var(--color-muted)] mb-2">
              Reason for changes (will be logged)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you making these changes?"
              className="bg-[var(--color-void)]"
            />
          </CardContent>
        </Card>
      )}

      {/* Settings by category */}
      {categories.map((category) => {
        const info = CATEGORY_INFO[category] || {
          name: category,
          description: '',
          icon: <SettingsIcon className="w-5 h-5" />,
        };

        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded text-amber-500">
                  {info.icon}
                </div>
                <div>
                  <CardTitle>{info.name}</CardTitle>
                  <CardDescription>{info.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings[category].map((setting) => (
                <SettingRow
                  key={setting.key}
                  setting={setting}
                  pendingValue={pendingChanges[setting.key]}
                  onChange={(value) => handleChange(setting.key, value)}
                  onReset={() => handleReset(setting.key)}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// =============================================================================
// SETTING ROW COMPONENT
// =============================================================================

function SettingRow({
  setting,
  pendingValue,
  onChange,
  onReset,
}: {
  setting: Setting;
  pendingValue: unknown;
  onChange: (value: unknown) => void;
  onReset: () => void;
}) {
  const currentValue = pendingValue !== undefined ? pendingValue : setting.value;
  const hasChange = pendingValue !== undefined;

  return (
    <div className={cn(
      'p-4 rounded border transition-colors',
      hasChange
        ? 'border-amber-500/50 bg-amber-500/5'
        : 'border-[var(--color-primary)]/10 bg-[var(--color-void)]/50'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-sm uppercase tracking-wider">
              {setting.label}
            </p>
            {hasChange && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] rounded">
                Modified
              </span>
            )}
          </div>
          {setting.description && (
            <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
              {setting.description}
            </p>
          )}
          {setting.constraints && (
            <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">
              {setting.constraints.min !== undefined && `Min: ${setting.constraints.min}`}
              {setting.constraints.min !== undefined && setting.constraints.max !== undefined && ' • '}
              {setting.constraints.max !== undefined && `Max: ${setting.constraints.max}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {setting.value_type === 'boolean' ? (
            <button
              onClick={() => onChange(!currentValue)}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative',
                currentValue ? 'bg-green-500' : 'bg-[var(--color-muted)]/30'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  currentValue ? 'translate-x-7' : 'translate-x-1'
                )}
              />
            </button>
          ) : setting.value_type === 'number' ? (
            <Input
              type="number"
              value={currentValue as number}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              min={setting.constraints?.min}
              max={setting.constraints?.max}
              step={setting.constraints?.min !== undefined && setting.constraints.min < 1 ? 0.1 : 1}
              className="w-24 bg-transparent border-[var(--color-primary)]/30 h-8 text-sm text-right"
            />
          ) : setting.value_type === 'string' ? (
            <Input
              type="text"
              value={(currentValue as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-48 bg-transparent border-[var(--color-primary)]/30 h-8 text-sm"
              placeholder="Empty"
            />
          ) : (
            <span className="font-mono text-sm text-[var(--color-muted)]">
              {JSON.stringify(currentValue)}
            </span>
          )}

          {hasChange && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function ToggleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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

function GameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
