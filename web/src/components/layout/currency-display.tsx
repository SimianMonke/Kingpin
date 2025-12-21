'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface CurrencyData {
  wealth: number
  tokens: number
  bonds: number
}

// =============================================================================
// CURRENCY DISPLAY
// Header component showing wealth, tokens, and bonds
// =============================================================================

export function CurrencyDisplay() {
  const [data, setData] = useState<CurrencyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCurrency() {
      try {
        const res = await fetch('/api/users/me')
        if (res.ok) {
          const json = await res.json()
          setData({
            wealth: json.data.wealth || 0,
            tokens: json.data.tokens || 0,
            bonds: json.data.bonds || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch currency:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrency()

    // Refresh every 30 seconds
    const interval = setInterval(fetchCurrency, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-5 w-16 bg-[var(--color-surface)] animate-pulse" />
        <div className="h-5 w-10 bg-[var(--color-surface)] animate-pulse" />
        <div className="h-5 w-10 bg-[var(--color-surface)] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Wealth */}
      <Link
        href="/profile"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1',
          'bg-[var(--color-surface)] border border-[var(--color-success)]/30',
          'hover:border-[var(--color-success)] transition-all'
        )}
        title="View Profile"
      >
        <DollarIcon className="w-3.5 h-3.5 text-[var(--color-success)]" />
        <span className="font-mono text-xs text-[var(--color-success)]">
          {formatCompact(data?.wealth || 0)}
        </span>
      </Link>

      {/* Tokens */}
      <Link
        href="/tokens"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1',
          'bg-[var(--color-surface)] border border-[var(--color-warning)]/30',
          'hover:border-[var(--color-warning)] transition-all'
        )}
        title="Manage Tokens"
      >
        <TokenIcon className="w-3.5 h-3.5 text-[var(--color-warning)]" />
        <span className="font-mono text-xs text-[var(--color-warning)]">
          {data?.tokens || 0}
        </span>
      </Link>

      {/* Bonds */}
      <Link
        href="/bonds"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1',
          'bg-[var(--color-surface)] border border-[var(--color-secondary)]/30',
          'hover:border-[var(--color-secondary)] transition-all'
        )}
        title="Manage Bonds"
      >
        <DiamondIcon className="w-3.5 h-3.5 text-[var(--color-secondary)]" />
        <span className="font-mono text-xs text-[var(--color-secondary)]">
          {data?.bonds || 0}
        </span>
      </Link>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toString()
}

// =============================================================================
// ICONS
// =============================================================================

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M9 9l3-3 3 3M9 15l3 3 3-3" />
    </svg>
  )
}

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 9l10 13L22 9l-10-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 9h20M7 9l5 13 5-13" />
    </svg>
  )
}
