'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber, CurrencyDisplay } from '@/components/ui/kinetic-number'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface TokenStatus {
  tokens: number
  tokensEarnedToday: number
  softCap: number
  hardCap: number
  nextConversionCost: number
  lastTokenReset: string | null
}

interface TokenTransaction {
  id: string
  amount: number
  type: string
  description: string | null
  createdAt: string
}

// =============================================================================
// TOKENS PAGE
// =============================================================================

export default function TokensPage() {
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [transactions, setTransactions] = useState<TokenTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)

  // Fetch token status
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/tokens')
        if (res.ok) {
          const data = await res.json()
          setStatus(data.data)
          setTransactions(data.data.recentTransactions || [])
        }
      } catch (error) {
        console.error('Failed to fetch token status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleBuyToken = useCallback(async () => {
    setBuying(true)
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to buy token')
      }

      // Refresh status
      const statusRes = await fetch('/api/tokens')
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData.data)
        setTransactions(statusData.data.recentTransactions || [])
      }
    } catch (error) {
      console.error('Failed to buy token:', error)
    } finally {
      setBuying(false)
    }
  }, [])

  if (loading) {
    return <TokensPageSkeleton />
  }

  const tokenProgress = status ? (status.tokens / status.softCap) * 100 : 0
  const isAtSoftCap = status ? status.tokens >= status.softCap : false
  const isAtHardCap = status ? status.tokens >= status.hardCap : false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[var(--color-foreground)]">
          <span className="text-gradient-primary">TOKENS</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// ECONOMY CURRENCY // '}
          <span className="text-[var(--color-warning)]">
            Boost your rewards with tokens
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Token Balance Card */}
        <Card variant="default" glow="warning" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TokenIcon className="w-6 h-6 text-[var(--color-warning)]" />
              TOKEN BALANCE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Balance Display */}
            <div className="flex items-center justify-between p-6 bg-[var(--color-surface)] border-2 border-[var(--color-warning)]">
              <div>
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  CURRENT BALANCE
                </span>
                <p className="font-mono text-5xl text-[var(--color-warning)] mt-1">
                  <KineticNumber value={status?.tokens || 0} />
                </p>
              </div>
              <div className="text-right">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  EARNED TODAY
                </span>
                <p className="font-mono text-2xl text-[var(--color-foreground)] mt-1">
                  <KineticNumber value={status?.tokensEarnedToday || 0} />
                </p>
              </div>
            </div>

            {/* Progress to Soft Cap */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  PROGRESS TO SOFT CAP
                </span>
                <span className="font-mono text-sm">
                  {status?.tokens || 0} / {status?.softCap || 100}
                </span>
              </div>
              <div className="h-3 bg-[var(--color-surface)] border border-[var(--color-border)]">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    isAtSoftCap
                      ? 'bg-[var(--color-warning)]'
                      : 'bg-[var(--color-warning)]/70'
                  )}
                  style={{ width: `${Math.min(tokenProgress, 100)}%` }}
                />
              </div>
              {isAtSoftCap && (
                <p className="font-mono text-xs text-[var(--color-warning)] mt-1">
                  Above soft cap! Tokens will decay 5% daily.
                </p>
              )}
            </div>

            {/* Token Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatBox label="SOFT CAP" value={status?.softCap || 100} />
              <StatBox label="HARD CAP" value={status?.hardCap || 500} />
              <StatBox
                label="DAILY DECAY"
                value={isAtHardCap ? '10%' : isAtSoftCap ? '5%' : '0%'}
                isText
              />
              <StatBox
                label="NEXT COST"
                value={status?.nextConversionCost || 1000}
                prefix="$"
              />
            </div>
          </CardContent>
        </Card>

        {/* Buy Tokens Card */}
        <Card variant="solid">
          <CardHeader>
            <CardTitle className="text-sm">CONVERT CREDITS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-warning)]/30 text-center">
              <span className="font-display text-xs uppercase text-[var(--color-muted)]">
                COST PER TOKEN
              </span>
              <p className="font-mono text-2xl text-[var(--color-warning)] mt-1">
                <CurrencyDisplay value={status?.nextConversionCost || 1000} />
              </p>
              <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
                Price increases 15% per purchase
              </p>
            </div>

            <Button
              onClick={handleBuyToken}
              disabled={buying || isAtHardCap}
              variant="default"
              size="lg"
              className={cn('w-full', !isAtHardCap && 'glow-primary')}
            >
              {buying
                ? 'CONVERTING...'
                : isAtHardCap
                ? 'AT HARD CAP'
                : 'BUY 1 TOKEN'}
            </Button>

            <div className="p-3 border border-[var(--color-border)]">
              <p className="font-mono text-xs text-[var(--color-muted)]">
                Tokens can be used to boost your Play rewards by 25%. The cost
                scales based on how many tokens you've purchased today.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token Uses */}
      <Card variant="solid">
        <CardHeader>
          <CardTitle className="text-sm">TOKEN USES</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5">
              <div className="flex items-center gap-2 mb-2">
                <PlayIcon className="w-5 h-5 text-[var(--color-primary)]" />
                <span className="font-display text-sm uppercase">PLAY BOOST</span>
              </div>
              <p className="font-mono text-xs text-[var(--color-muted)]">
                Use 1 token per play to gain +25% wealth and XP rewards
              </p>
            </div>
            <div className="p-4 border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/5">
              <div className="flex items-center gap-2 mb-2">
                <BusinessIcon className="w-5 h-5 text-[var(--color-secondary)]" />
                <span className="font-display text-sm uppercase">BUSINESS BOOST</span>
              </div>
              <p className="font-mono text-xs text-[var(--color-muted)]">
                Use 2 tokens to boost business collection by 50%
              </p>
            </div>
            <div className="p-4 border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
              <div className="flex items-center gap-2 mb-2">
                <StarIcon className="w-5 h-5 text-[var(--color-warning)]" />
                <span className="font-display text-sm uppercase">FUTURE USES</span>
              </div>
              <p className="font-mono text-xs text-[var(--color-muted)]">
                More token uses coming soon with future updates
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card variant="solid">
          <CardHeader>
            <CardTitle className="text-sm">RECENT TRANSACTIONS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transactions.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-[var(--color-surface)]"
                >
                  <div>
                    <span className="font-display text-xs uppercase">
                      {tx.type.replace(/_/g, ' ')}
                    </span>
                    {tx.description && (
                      <p className="font-mono text-xs text-[var(--color-muted)]">
                        {tx.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'font-mono text-lg',
                      tx.amount >= 0
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-destructive)]'
                    )}
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatBox({
  label,
  value,
  prefix,
  isText,
}: {
  label: string
  value: number | string
  prefix?: string
  isText?: boolean
}) {
  return (
    <div className="p-3 bg-[var(--color-surface)]">
      <span className="font-display text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <p className="font-mono text-lg mt-1">
        {prefix}
        {isText ? value : <KineticNumber value={value as number} />}
      </p>
    </div>
  )
}

function TokensPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 bg-[var(--color-surface)] animate-pulse" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-64 bg-[var(--color-surface)] animate-pulse" />
        <div className="h-64 bg-[var(--color-surface)] animate-pulse" />
      </div>
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M9 9l3-3 3 3M9 15l3 3 3-3" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BusinessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}
