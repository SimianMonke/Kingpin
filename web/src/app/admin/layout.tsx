'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';

interface AdminStatus {
  isAdmin: boolean;
  role: 'owner' | 'moderator' | null;
  username?: string;
  userId?: number;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  // Check admin status
  const { data: adminStatus, isLoading } = useQuery<AdminStatus>({
    queryKey: ['admin-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/status');
      if (!res.ok) throw new Error('Failed to check admin status');
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Show loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-void)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm text-[var(--color-muted)]">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    redirect('/login');
  }

  // Redirect if not admin
  if (!adminStatus?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[var(--color-void)] flex">
      {/* Sidebar */}
      <AdminSidebar role={adminStatus.role!} />

      {/* Main content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Header */}
        <AdminHeader username={adminStatus.username || 'Admin'} role={adminStatus.role!} />

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
