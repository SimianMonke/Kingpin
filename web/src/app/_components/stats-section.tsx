'use client'

import { useEffect, useState } from 'react'
import { KineticNumber } from '@/components/ui/kinetic-number'

// =============================================================================
// STATS SECTION COMPONENT
// Global metrics panel with kinetic number animations
// =============================================================================

interface GlobalStats {
  players: number
  totalWealth: number
  cratesOpened: number
  robberies: number
}

export function StatsSection() {
  const [stats, setStats] = useState<GlobalStats>({
    players: 0,
    totalWealth: 0,
    cratesOpened: 0,
    robberies: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/feed/stats')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setStats(data.data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-panel p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[var(--color-primary)]" />
          <h2 className="font-display text-sm tracking-widest text-[var(--color-primary)]">
            GLOBAL METRICS
          </h2>
        </div>
        <span className="font-data text-xs text-[var(--color-muted)]">
          {'[LIVE]'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCell
          label="PLAYERS"
          value={stats.players}
          isLoading={isLoading}
        />
        <StatCell
          label="TOTAL WEALTH"
          value={stats.totalWealth}
          prefix="$"
          isLoading={isLoading}
        />
        <StatCell
          label="CRATES OPENED"
          value={stats.cratesOpened}
          isLoading={isLoading}
        />
        <StatCell
          label="ROBBERIES"
          value={stats.robberies}
          isLoading={isLoading}
        />
      </div>

      {/* Terminal Footer */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
        <span className="font-data text-xs text-[var(--color-muted)]">
          {'>'} SYSTEM STATUS: <span className="text-[var(--color-success)]">NOMINAL</span>
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// STAT CELL COMPONENT
// Individual stat display with kinetic animation
// =============================================================================

function StatCell({
  label,
  value,
  prefix = '',
  isLoading = false,
}: {
  label: string
  value: number
  prefix?: string
  isLoading?: boolean
}) {
  return (
    <div className="text-center md:text-left">
      {isLoading ? (
        <div className="h-8 md:h-10 bg-[var(--color-surface)] animate-pulse mb-2" />
      ) : (
        <div className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)]">
          <KineticNumber
            value={value}
            prefix={prefix}
            className="text-gradient-primary"
            duration={1500}
          />
        </div>
      )}
      <div className="font-display text-xs tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
    </div>
  )
}
