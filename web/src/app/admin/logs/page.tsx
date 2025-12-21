'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  category: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  reason: string | null;
  createdAt: string;
}

interface LogsResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  player: 'bg-blue-500/20 text-blue-400',
  setting: 'bg-gray-500/20 text-gray-400',
  economy: 'bg-emerald-500/20 text-emerald-400',
  content: 'bg-purple-500/20 text-purple-400',
  system: 'bg-amber-500/20 text-amber-400',
};

export default function AuditLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    action: searchParams.get('action') || '',
  });

  const page = parseInt(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';
  const action = searchParams.get('action') || '';

  // Expanded log state
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<LogsResponse>({
    queryKey: ['admin-logs', category, action, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (action) params.set('action', action);
      params.set('page', page.toString());
      params.set('limit', '50');

      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) throw new Error('Failed to load logs');
      return res.json();
    },
  });

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.action) params.set('action', filters.action);
    router.push(`/admin/logs?${params}`);
  };

  const handleClearFilters = () => {
    setFilters({ category: '', action: '' });
    router.push('/admin/logs');
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (action) params.set('action', action);
    params.set('page', newPage.toString());
    router.push(`/admin/logs?${params}`);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (action) params.set('action', action);

    // Trigger download
    window.location.href = `/api/admin/logs/export?${params}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Audit Logs
        </h1>
        <div className="flex items-center gap-4">
          {data?.pagination && (
            <span className="font-mono text-xs text-[var(--color-muted)]">
              {data.pagination.total} total entries
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExport}
            className="gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full h-10 px-3 bg-[var(--color-void)] border border-[var(--color-primary)]/30 rounded font-mono text-sm"
              >
                <option value="">All Categories</option>
                <option value="player">Player</option>
                <option value="setting">Setting</option>
                <option value="economy">Economy</option>
                <option value="content">Content</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Action</label>
              <Input
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                placeholder="Filter by action..."
                className="bg-[var(--color-void)]"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleFilter}>Filter</Button>
              {(category || action) && (
                <Button variant="ghost" onClick={handleClearFilters}>Clear</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Action History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-mono text-sm text-[var(--color-muted)]">Loading...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 font-mono">Failed to load logs</p>
            </div>
          ) : data?.data.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-mono text-[var(--color-muted)]">No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.data.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'border rounded transition-colors',
                    expandedId === log.id
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30'
                  )}
                >
                  {/* Log header */}
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-display uppercase',
                            CATEGORY_COLORS[log.category] || 'bg-gray-500/20 text-gray-400'
                          )}>
                            {log.category}
                          </span>
                          <span className="font-mono text-sm text-amber-500">
                            {log.adminName}
                          </span>
                          <span className="font-mono text-sm text-[var(--color-muted)]">
                            {formatAction(log.action)}
                          </span>
                        </div>
                        {log.targetName && (
                          <p className="font-mono text-xs text-[var(--color-muted)]">
                            Target: {log.targetName}
                            {log.targetId && ` (${log.targetType}:${log.targetId})`}
                          </p>
                        )}
                        {log.reason && (
                          <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
                            Reason: {log.reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs text-[var(--color-muted)]">
                          {formatTimestamp(log.createdAt)}
                        </p>
                        <ChevronIcon
                          className={cn(
                            'w-4 h-4 mx-auto mt-1 transition-transform text-[var(--color-muted)]',
                            expandedId === log.id && 'rotate-180'
                          )}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expandedId === log.id && (
                    <div className="px-4 pb-4 border-t border-[var(--color-primary)]/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {/* Old Value */}
                        <div>
                          <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
                            Old Value
                          </p>
                          <pre className="p-3 bg-[var(--color-void)] rounded font-mono text-xs overflow-auto max-h-40">
                            {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : 'null'}
                          </pre>
                        </div>
                        {/* New Value */}
                        <div>
                          <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
                            New Value
                          </p>
                          <pre className="p-3 bg-[var(--color-void)] rounded font-mono text-xs overflow-auto max-h-40">
                            {log.newValue ? JSON.stringify(log.newValue, null, 2) : 'null'}
                          </pre>
                        </div>
                      </div>
                      {/* Metadata */}
                      <div className="mt-4 pt-4 border-t border-[var(--color-primary)]/10">
                        <div className="flex gap-6 font-mono text-[10px] text-[var(--color-muted)]">
                          <span>Log ID: {log.id}</span>
                          <span>Admin ID: {log.adminId}</span>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase();
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleString();
}

// =============================================================================
// ICONS
// =============================================================================

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
