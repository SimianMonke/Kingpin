'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GameActionPanel, ActionResult, useCooldown } from './game-action-panel'
import { KineticNumber, CurrencyDisplay } from '@/components/ui/kinetic-number'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface PlayStatus {
  canPlay: boolean
  isJailed: boolean
  jailReleaseAt?: string
  tokens: number
  tokenBonusEnabled: boolean
  economyMode: 'online' | 'offline'
}

interface TokenStatus {
  tokens: number
  tokensEarnedToday: number
  softCap: number
  hardCap: number
  nextConversionCost: number
}

// =============================================================================
// PLAY TAB
// =============================================================================

export function PlayTab() {
  const [status, setStatus] = useState<PlayStatus | null>(null)
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [useToken, setUseToken] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch play status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const [playRes, tokenRes] = await Promise.all([
          fetch('/api/play'),
          fetch('/api/tokens'),
        ])

        if (playRes.ok) {
          const data = await playRes.json()
          setStatus(data.data)
        }

        if (tokenRes.ok) {
          const data = await tokenRes.json()
          setTokenStatus(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch play status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [])

  const handlePlay = useCallback(async (): Promise<ActionResult> => {
    const res = await fetch('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useToken }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Play failed')
    }

    // Refresh token status after playing
    const tokenRes = await fetch('/api/tokens')
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json()
      setTokenStatus(tokenData.data)
    }

    // Handle busted result
    if (data.data.busted) {
      return {
        success: false,
        message: `You got busted! Jailed for ${data.data.jailDuration || 60} minutes.`,
        event: 'BUSTED',
      }
    }

    return {
      success: true,
      message: data.data.message || 'Operation successful!',
      event: data.data.event_name || data.data.eventName,
      wealth: data.data.wealth_earned || data.data.wealthEarned,
      xp: data.data.xp_earned || data.data.xpEarned,
    }
  }, [useToken])

  if (loading) {
    return <PlayTabSkeleton />
  }

  const isJailed = status?.isJailed
  const canPlay = status?.canPlay && !isJailed
  const hasTokens = (tokenStatus?.tokens || 0) > 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Main Play Action */}
      <GameActionPanel
        title="RUN OPERATION"
        description="Execute a random criminal operation based on your tier"
        icon={<PlayIcon className="w-6 h-6" />}
        actionLabel="EXECUTE OPERATION"
        onAction={handlePlay}
        disabled={!canPlay}
        disabledReason={isJailed ? 'IN JAIL' : 'UNAVAILABLE'}
        accentColor="primary"
      >
        {/* Token Bonus Toggle */}
        {hasTokens && (
          <div
            className={cn(
              'flex items-center justify-between p-3 border transition-all cursor-pointer',
              useToken
                ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10'
                : 'border-[var(--color-border)] hover:border-[var(--color-warning)]/50'
            )}
            onClick={() => setUseToken(!useToken)}
          >
            <div className="flex items-center gap-3">
              <TokenIcon
                className={cn(
                  'w-5 h-5',
                  useToken ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted)]'
                )}
              />
              <div>
                <span className="font-display text-sm uppercase tracking-wider">
                  USE TOKEN BOOST
                </span>
                <p className="font-mono text-xs text-[var(--color-muted)]">
                  +25% wealth & XP rewards
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--color-warning)]">
                {tokenStatus?.tokens || 0} available
              </span>
              <div
                className={cn(
                  'w-5 h-5 border-2 flex items-center justify-center',
                  useToken
                    ? 'border-[var(--color-warning)] bg-[var(--color-warning)]'
                    : 'border-[var(--color-muted)]'
                )}
              >
                {useToken && <CheckIcon className="w-3 h-3 text-[var(--color-void)]" />}
              </div>
            </div>
          </div>
        )}

        {/* Jail Warning */}
        {isJailed && status?.jailReleaseAt && (
          <JailWarning releaseAt={status.jailReleaseAt} />
        )}

        {/* Economy Mode Warning */}
        {status?.economyMode === 'online' && (
          <div className="p-3 border border-[var(--color-secondary)] bg-[var(--color-secondary)]/10">
            <div className="flex items-center gap-2">
              <StreamIcon className="w-4 h-4 text-[var(--color-secondary)]" />
              <span className="font-mono text-xs text-[var(--color-secondary)]">
                STREAM MODE ACTIVE - Use chat commands to play
              </span>
            </div>
          </div>
        )}
      </GameActionPanel>

      {/* Token Status Card */}
      <Card variant="solid" className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TokenIcon className="w-5 h-5 text-[var(--color-warning)]" />
            TOKEN STATUS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token Balance */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] border border-[var(--color-warning)]/30">
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
              BALANCE
            </span>
            <span className="font-mono text-2xl text-[var(--color-warning)]">
              <KineticNumber value={tokenStatus?.tokens || 0} />
            </span>
          </div>

          {/* Token Caps */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 bg-[var(--color-surface)]">
              <span className="font-display text-[10px] uppercase text-[var(--color-muted)]">
                SOFT CAP
              </span>
              <p className="font-mono text-sm">{tokenStatus?.softCap || 100}</p>
            </div>
            <div className="p-2 bg-[var(--color-surface)]">
              <span className="font-display text-[10px] uppercase text-[var(--color-muted)]">
                HARD CAP
              </span>
              <p className="font-mono text-sm">{tokenStatus?.hardCap || 500}</p>
            </div>
          </div>

          {/* Daily Progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display text-xs uppercase text-[var(--color-muted)]">
                EARNED TODAY
              </span>
              <span className="font-mono text-xs">
                {tokenStatus?.tokensEarnedToday || 0} tokens
              </span>
            </div>
            <div className="h-2 bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div
                className="h-full bg-[var(--color-warning)]"
                style={{
                  width: `${Math.min(
                    ((tokenStatus?.tokensEarnedToday || 0) / 50) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Buy Token Button */}
          <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="font-mono text-xs text-[var(--color-muted)] mb-2">
              Next token costs:{' '}
              <CurrencyDisplay value={tokenStatus?.nextConversionCost || 1000} size="sm" />
            </p>
            <Button variant="ghost" size="sm" className="w-full" asChild>
              <a href="/tokens">MANAGE TOKENS</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// JAIL WARNING
// =============================================================================

function JailWarning({ releaseAt }: { releaseAt: string }) {
  const cooldown = useCooldown(new Date(releaseAt))

  return (
    <div className="p-4 border-2 border-[var(--color-destructive)] bg-[var(--color-destructive)]/10">
      <div className="flex items-center gap-3">
        <JailIcon className="w-6 h-6 text-[var(--color-destructive)]" />
        <div className="flex-1">
          <span className="font-display uppercase tracking-wider text-[var(--color-destructive)]">
            YOU ARE IN JAIL
          </span>
          <p className="font-mono text-sm text-[var(--color-muted)] mt-1">
            Release in: {cooldown.formatted || 'Soon'}
          </p>
        </div>
        <Button variant="destructive" size="sm" asChild>
          <a href="/api/bail">PAY BAIL</a>
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// SKELETON
// =============================================================================

function PlayTabSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card variant="default" className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-[var(--color-surface)]" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-12 bg-[var(--color-surface)]" />
          <div className="h-12 bg-[var(--color-surface)]" />
        </CardContent>
      </Card>
      <Card variant="solid" className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-32 bg-[var(--color-surface)]" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-16 bg-[var(--color-surface)]" />
          <div className="h-8 bg-[var(--color-surface)]" />
        </CardContent>
      </Card>
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

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M9 9l3-3 3 3M9 15l3 3 3-3" />
    </svg>
  )
}

function JailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="16" y1="3" x2="16" y2="21" />
    </svg>
  )
}

function StreamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
