'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GameActionPanel, ActionResult, useCooldown } from './game-action-panel'
import { KineticNumber, CurrencyDisplay } from '@/components/ui/kinetic-number'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface RobStatus {
  canRob: boolean
  cooldownEndsAt?: string
  isJailed: boolean
  insuranceTier: string
  insuranceProtection: number
}

interface TargetUser {
  id: number
  kingpin_name: string
  wealth: number
  tier: string
  level: number
  insuranceTier: string
}

// =============================================================================
// ROB TAB
// =============================================================================

export function RobTab() {
  const [status, setStatus] = useState<RobStatus | null>(null)
  const [targetQuery, setTargetQuery] = useState('')
  const [target, setTarget] = useState<TargetUser | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const cooldown = useCooldown(status?.cooldownEndsAt ? new Date(status.cooldownEndsAt) : null)

  // Fetch rob status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/users/me/cooldowns')
        if (res.ok) {
          const data = await res.json()
          setStatus({
            canRob: !data.data.robbery?.active,
            cooldownEndsAt: data.data.robbery?.endsAt,
            isJailed: data.data.jail?.active || false,
            insuranceTier: data.data.insuranceTier || 'none',
            insuranceProtection: data.data.insuranceProtection || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch rob status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [])

  const searchTarget = useCallback(async () => {
    if (!targetQuery.trim()) return

    setSearching(true)
    setSearchError(null)
    setTarget(null)

    try {
      const res = await fetch(`/api/users/by-name/${encodeURIComponent(targetQuery)}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Player not found')
      }
      setTarget(data.data)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [targetQuery])

  const handleRob = useCallback(async (): Promise<ActionResult> => {
    if (!target) {
      throw new Error('Select a target first')
    }

    const res = await fetch('/api/rob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: target.kingpin_name }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Robbery failed')
    }

    // Clear target after robbery
    setTarget(null)
    setTargetQuery('')

    // Handle failure
    if (!data.data.success) {
      return {
        success: false,
        message: data.data.message || 'The robbery failed!',
        event: 'ROBBERY FAILED',
        wealth: data.data.loss ? -data.data.loss : undefined,
      }
    }

    return {
      success: true,
      message: data.data.message || 'Robbery successful!',
      event: 'ROBBERY SUCCESS',
      wealth: data.data.stolen || data.data.amount,
      xp: data.data.xp,
    }
  }, [target])

  if (loading) {
    return <RobTabSkeleton />
  }

  const isJailed = status?.isJailed
  const isOnCooldown = cooldown.isOnCooldown
  const canRob = !isJailed && !isOnCooldown && target !== null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Target Selection */}
      <Card variant="solid">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TargetIcon className="w-5 h-5 text-[var(--color-secondary)]" />
            SELECT TARGET
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter player name..."
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchTarget()}
              className="flex-1"
            />
            <Button
              onClick={searchTarget}
              disabled={searching || !targetQuery.trim()}
              variant="ghost"
            >
              {searching ? 'SEARCHING...' : 'SEARCH'}
            </Button>
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="p-3 border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10">
              <span className="font-mono text-sm text-[var(--color-destructive)]">
                {searchError}
              </span>
            </div>
          )}

          {/* Target Info */}
          {target && (
            <div className="p-4 border-2 border-[var(--color-secondary)] bg-[var(--color-secondary)]/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-display uppercase tracking-wider text-[var(--color-secondary)]">
                    {target.kingpin_name}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <TierBadge tier={target.tier} />
                    <span className="font-mono text-xs text-[var(--color-muted)]">
                      LVL {target.level}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTarget(null)
                    setTargetQuery('')
                  }}
                >
                  CLEAR
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-[var(--color-surface)]">
                  <span className="font-display text-[10px] uppercase text-[var(--color-muted)]">
                    WEALTH
                  </span>
                  <p className="font-mono text-sm text-[var(--color-success)]">
                    <CurrencyDisplay value={target.wealth} size="sm" />
                  </p>
                </div>
                <div className="p-2 bg-[var(--color-surface)]">
                  <span className="font-display text-[10px] uppercase text-[var(--color-muted)]">
                    INSURANCE
                  </span>
                  <p className="font-mono text-sm">
                    {target.insuranceTier === 'none'
                      ? 'NONE'
                      : target.insuranceTier.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No Target Selected */}
          {!target && !searchError && (
            <div className="p-6 border border-dashed border-[var(--color-border)] text-center">
              <TargetIcon className="w-8 h-8 mx-auto text-[var(--color-muted)] mb-2" />
              <span className="font-mono text-sm text-[var(--color-muted)]">
                Search for a player to rob
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rob Action */}
      <GameActionPanel
        title="EXECUTE ROBBERY"
        description="Attempt to steal wealth from your target"
        icon={<MaskIcon className="w-6 h-6" />}
        actionLabel={target ? `ROB ${target.kingpin_name.toUpperCase()}` : 'SELECT TARGET'}
        onAction={handleRob}
        cooldownEndTime={status?.cooldownEndsAt ? new Date(status.cooldownEndsAt) : null}
        disabled={!canRob}
        disabledReason={
          isJailed
            ? 'IN JAIL'
            : isOnCooldown
            ? `COOLDOWN: ${cooldown.formatted}`
            : !target
            ? 'SELECT TARGET'
            : 'UNAVAILABLE'
        }
        accentColor="secondary"
      >
        {/* Your Insurance Status */}
        <div className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4 text-[var(--color-primary)]" />
              <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                YOUR INSURANCE
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm">
                {status?.insuranceTier === 'none'
                  ? 'NONE'
                  : status?.insuranceTier?.toUpperCase()}
              </span>
              {status?.insuranceProtection !== undefined && status.insuranceProtection > 0 && (
                <p className="font-mono text-xs text-[var(--color-success)]">
                  {Math.round(status.insuranceProtection * 100)}% protection
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Risk Warning */}
        <div className="p-3 border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5">
          <div className="flex items-start gap-2">
            <WarningIcon className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
            <span className="font-mono text-xs text-[var(--color-muted)]">
              Robbery has a chance to fail. If caught, you may lose wealth and go to jail.
              Higher tier targets are harder to rob but yield greater rewards.
            </span>
          </div>
        </div>
      </GameActionPanel>
    </div>
  )
}

// =============================================================================
// TIER BADGE
// =============================================================================

function TierBadge({ tier }: { tier: string }) {
  const tierColors: Record<string, string> = {
    Punk: 'var(--tier-common)',
    Associate: 'var(--tier-uncommon)',
    Soldier: 'var(--tier-uncommon)',
    Captain: 'var(--tier-rare)',
    Underboss: 'var(--tier-rare)',
    Kingpin: 'var(--tier-legendary)',
  }
  const color = tierColors[tier] || 'var(--tier-common)'

  return (
    <span
      className="font-display text-[10px] uppercase tracking-wider px-1.5 py-0.5 border"
      style={{ color, borderColor: color }}
    >
      {tier}
    </span>
  )
}

// =============================================================================
// SKELETON
// =============================================================================

function RobTabSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card variant="solid" className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-32 bg-[var(--color-surface)]" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-[var(--color-surface)]" />
          <div className="h-24 bg-[var(--color-surface)]" />
        </CardContent>
      </Card>
      <Card variant="default" className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-[var(--color-surface)]" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-12 bg-[var(--color-surface)]" />
          <div className="h-12 bg-[var(--color-surface)]" />
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
