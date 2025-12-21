'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlayTab } from '@/components/gameplay/play-tab'
import { RobTab } from '@/components/gameplay/rob-tab'
import { CasinoTab } from '@/components/gameplay/casino-tab'

// =============================================================================
// TYPES
// =============================================================================

type GameTab = 'play' | 'rob' | 'casino'

const TABS: { id: GameTab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'play',
    label: 'PLAY',
    icon: <PlayIcon className="w-5 h-5" />,
    description: 'Run operations to earn wealth and XP',
  },
  {
    id: 'rob',
    label: 'ROB',
    icon: <MaskIcon className="w-5 h-5" />,
    description: 'Target other players for risky rewards',
  },
  {
    id: 'casino',
    label: 'CASINO',
    icon: <DiceIcon className="w-5 h-5" />,
    description: 'Test your luck at the underground casino',
  },
]

// =============================================================================
// PLAY HUB PAGE
// =============================================================================

export default function PlayPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<GameTab>('play')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[var(--color-foreground)]">
            <span className="text-gradient-primary">OPERATIONS</span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// GAMEPLAY HUB // '}
            <span className="text-[var(--color-primary)]">
              {TABS.find(t => t.id === activeTab)?.description}
            </span>
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b-2 border-[var(--color-primary)]/20 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 font-display text-sm uppercase tracking-wider transition-all',
              'border-2 border-transparent',
              activeTab === tab.id
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)]'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'play' && <PlayTab />}
        {activeTab === 'rob' && <RobTab />}
        {activeTab === 'casino' && <CasinoTab />}
      </div>
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function MaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
