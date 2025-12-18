'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  username: string;
  role: 'owner' | 'moderator';
}

export function AdminHeader({ username, role }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-amber-500/20">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Breadcrumb / Title area */}
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-xs text-[var(--color-muted)]">
            Admin Session Active
          </span>
        </div>

        {/* User info and actions */}
        <div className="flex items-center gap-4">
          {/* Role badge */}
          <div className={cn(
            'px-3 py-1 rounded font-display text-[10px] uppercase tracking-wider',
            role === 'owner'
              ? 'bg-amber-500/20 text-amber-500'
              : 'bg-blue-500/20 text-blue-500'
          )}>
            {role}
          </div>

          {/* Username */}
          <span className="font-mono text-sm text-[var(--color-foreground)]">
            {username}
          </span>

          {/* Logout */}
          <Button
            onClick={() => signOut({ callbackUrl: '/' })}
            variant="ghost"
            size="sm"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
