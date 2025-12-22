'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CONTENT_SECTIONS = [
  {
    title: 'Heist Events',
    description: 'Manage trivia, riddles, and quick-grab phrases for stream heists',
    href: '/admin/content/heists',
    icon: HeistIcon,
    stats: ['Trivia Questions', 'Riddles', 'Quick-Grab Phrases'],
  },
  {
    title: 'Stream Actions',
    description: 'Manage Lumia Stream actions for the shop and configure system commands',
    href: '/admin/content/stream-actions',
    icon: StreamActionIcon,
    stats: ['Shop Actions', 'Lumia Commands', 'System Events'],
  },
  {
    title: 'Items Catalog',
    description: 'View all weapons, armor, and businesses (read-only)',
    href: '/admin/content/items',
    icon: ItemIcon,
    stats: ['Weapons', 'Armor', 'Businesses'],
    disabled: true,
  },
  {
    title: 'Achievements',
    description: 'View all achievements and requirements (read-only)',
    href: '/admin/content/achievements',
    icon: AchievementIcon,
    stats: ['Total Achievements', 'Categories'],
    disabled: true,
  },
];

export default function ContentHubPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
        Content Management
      </h1>

      <p className="font-mono text-sm text-[var(--color-muted)]">
        Manage game content including heist events, items, and achievements.
      </p>

      {/* Content Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CONTENT_SECTIONS.map((section) => {
          const Icon = section.icon;

          if (section.disabled) {
            return (
              <Card key={section.title} className="opacity-50 cursor-not-allowed">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[var(--color-muted)]/20 rounded">
                      <Icon className="w-5 h-5 text-[var(--color-muted)]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <p className="font-mono text-[10px] text-[var(--color-muted)] mt-0.5">
                        Coming Soon
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-xs text-[var(--color-muted)]">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            );
          }

          return (
            <Link key={section.title} href={section.href}>
              <Card className="hover:border-amber-500/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded">
                      <Icon className="w-5 h-5 text-amber-500" />
                    </div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-xs text-[var(--color-muted)]">
                    {section.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {section.stats.map((stat) => (
                      <span
                        key={stat}
                        className="px-2 py-1 bg-[var(--color-surface)] rounded font-mono text-[10px] text-[var(--color-muted)]"
                      >
                        {stat}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function HeistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function StreamActionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ItemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function AchievementIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}
