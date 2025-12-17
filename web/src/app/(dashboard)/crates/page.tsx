'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber } from '@/components/ui/kinetic-number'
import { PageLoader, InitializingText } from '@/components/ui/initializing-loader'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface CrateInfo {
  id: number
  tier: string
  source: string | null
  acquired_at: string
  is_escrowed: boolean
  escrow_expires_at: string | null
}

interface CrateStats {
  total: number
  maxCrates: number
  escrowedCount: number
  maxEscrow: number
  byTier: Record<string, number>
}

interface CrateData {
  crates: CrateInfo[]
  stats: CrateStats
  canOpen: boolean
  canOpenReason?: string
}

interface ItemReward {
  id: number
  name: string
  type: string
  tier: string
  inventoryId: number
  toEscrow: boolean
}

interface CrateOpenResult {
  crateId: number
  crate_tier: string
  drop_type: 'weapon' | 'armor' | 'wealth' | 'title'
  reward: {
    item?: ItemReward
    wealth?: { amount: number }
    title?: { title: string; isDuplicate: boolean; duplicateValue?: number }
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_ORDER = ['legendary', 'rare', 'uncommon', 'common']

const TIER_STYLES: Record<string, { color: string; border: string; bg: string; glow: string }> = {
  common: {
    color: 'var(--tier-common)',
    border: 'border-[var(--tier-common)]/50',
    bg: 'bg-[var(--tier-common)]/5',
    glow: '',
  },
  uncommon: {
    color: 'var(--tier-uncommon)',
    border: 'border-[var(--tier-uncommon)]/50',
    bg: 'bg-[var(--tier-uncommon)]/5',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
  },
  rare: {
    color: 'var(--tier-rare)',
    border: 'border-[var(--tier-rare)]/50',
    bg: 'bg-[var(--tier-rare)]/5',
    glow: 'shadow-[0_0_25px_rgba(59,130,246,0.3)]',
  },
  legendary: {
    color: 'var(--tier-legendary)',
    border: 'border-[var(--tier-legendary)]/50',
    bg: 'bg-[var(--tier-legendary)]/5',
    glow: 'shadow-[0_0_30px_rgba(255,215,0,0.4)]',
  },
}

const DROP_CHANCES: Record<string, string[]> = {
  common: ['40% WEAPON', '40% ARMOR', '20% WEALTH'],
  uncommon: ['38% WEAPON', '38% ARMOR', '22% WEALTH', '2% TITLE'],
  rare: ['35% WEAPON', '35% ARMOR', '25% WEALTH', '5% TITLE'],
  legendary: ['30% WEAPON', '30% ARMOR', '30% WEALTH', '10% TITLE'],
}

// =============================================================================
// CRATES PAGE
// =============================================================================

export default function CratesPage() {
  const [data, setData] = useState<CrateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [openResult, setOpenResult] = useState<CrateOpenResult | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    fetchCrates()
  }, [])

  async function fetchCrates() {
    try {
      const res = await fetch('/api/crates')
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch crates:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenCrate(crateId?: number, tier?: string) {
    const key = crateId ? `open-${crateId}` : `open-${tier}`
    setActionLoading(key)
    setMessage(null)

    try {
      const res = await fetch('/api/crates/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crateId ? { crateId } : {}),
      })

      const json = await res.json()

      if (res.ok) {
        setIsAnimating(true)
        await new Promise((resolve) => setTimeout(resolve, 1500))
        setIsAnimating(false)
        setOpenResult(json.data)
        await fetchCrates()
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'FAILED TO OPEN' })
      }
    } catch {
      setMessage({ type: 'error', text: 'NETWORK ERROR' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleOpenAll() {
    if (!data) return

    const count = data.stats.total
    if (count === 0) return

    setActionLoading('open-all')
    setMessage(null)

    try {
      const res = await fetch('/api/crates/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: Math.min(count, 10) }),
      })

      const json = await res.json()

      if (res.ok) {
        const results = json.data.results as CrateOpenResult[]
        const stats = json.data.stats

        let summary = `OPENED ${stats.opened} CRATE${stats.opened !== 1 ? 'S' : ''}`
        if (stats.stoppedEarly) {
          summary += ` (STOPPED: ${stats.stopReason?.toUpperCase()})`
        }

        setMessage({ type: 'success', text: summary })

        if (results.length > 0) {
          setOpenResult(results[results.length - 1])
        }

        await fetchCrates()
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'FAILED TO OPEN' })
      }
    } catch {
      setMessage({ type: 'error', text: 'NETWORK ERROR' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleClaim(crateId: number) {
    setActionLoading(`claim-${crateId}`)
    setMessage(null)

    try {
      const res = await fetch('/api/crates/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crateId }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'CRATE CLAIMED FROM ESCROW' })
        await fetchCrates()
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'CLAIM FAILED' })
      }
    } catch {
      setMessage({ type: 'error', text: 'NETWORK ERROR' })
    } finally {
      setActionLoading(null)
    }
  }

  function formatTimeRemaining(expires_at: string): string {
    const diff = new Date(expires_at).getTime() - Date.now()
    if (diff <= 0) return 'EXPIRED'

    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}M`
    return `${Math.floor(minutes / 60)}H ${minutes % 60}M`
  }

  if (loading) {
    return <PageLoader message="LOADING CRATE DATA" />
  }

  if (!data) {
    return (
      <Card variant="outlined" className="border-[var(--color-destructive)] p-8 text-center">
        <p className="font-mono text-[var(--color-destructive)]">{'> CRATE DATA UNAVAILABLE'}</p>
      </Card>
    )
  }

  const regularCrates = data.crates.filter((c) => !c.is_escrowed)
  const escrowedCrates = data.crates.filter((c) => c.is_escrowed)

  const cratesByTier: Record<string, CrateInfo[]> = {}
  for (const tier of TIER_ORDER) {
    const tierCrates = regularCrates.filter((c) => c.tier === tier)
    if (tierCrates.length > 0) {
      cratesByTier[tier] = tierCrates
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
            <span className="text-[var(--color-primary)]">CRATES</span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// '}
            <KineticNumber value={data.stats.total} />/{data.stats.maxCrates} CRATES
            {data.stats.escrowedCount > 0 && (
              <span className="text-[var(--color-warning)]">
                {' // '}{data.stats.escrowedCount} IN ESCROW
              </span>
            )}
          </p>
        </div>
        {data.stats.total > 1 && data.canOpen && (
          <Button
            onClick={handleOpenAll}
            disabled={actionLoading === 'open-all'}
            variant="default"
            size="lg"
            className="glow-primary"
          >
            {actionLoading === 'open-all' ? (
              <InitializingText text="OPENING" className="text-xs" />
            ) : (
              `OPEN ALL (${Math.min(data.stats.total, 10)})`
            )}
          </Button>
        )}
      </div>

      {/* Message */}
      {message && (
        <Card
          variant="outlined"
          className={cn(
            'p-4',
            message.type === 'success'
              ? 'border-[var(--color-success)] bg-[var(--color-success)]/5'
              : 'border-[var(--color-destructive)] bg-[var(--color-destructive)]/5 error-state'
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'font-display uppercase text-sm',
                message.type === 'success'
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-destructive)]'
              )}
            >
              {message.type === 'success' ? '✓ SUCCESS' : '✗ ERROR'}
            </span>
            <span className="font-mono text-sm">{message.text}</span>
          </div>
        </Card>
      )}

      {/* Cannot Open Warning */}
      {!data.canOpen && data.canOpenReason && data.stats.total > 0 && (
        <Card variant="outlined" className="border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5 p-4">
          <p className="font-mono text-sm text-[var(--color-warning)]">
            ⚠ {data.canOpenReason.toUpperCase()}
          </p>
        </Card>
      )}

      {/* Crates by Tier */}
      {data.stats.total === 0 ? (
        <Card variant="solid" className="p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="font-display text-xl uppercase tracking-wider mb-2">NO CRATES</h2>
          <p className="font-mono text-sm text-[var(--color-muted)]">
            EARN CRATES BY PLAYING, COMPLETING MISSIONS, OR CHECK-IN MILESTONES
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIER_ORDER.map((tier) => {
            const count = data.stats.byTier[tier] || 0
            if (count === 0) return null

            const tierCrates = cratesByTier[tier] || []
            const firstCrate = tierCrates[0]
            const style = TIER_STYLES[tier]

            return (
              <div
                key={tier}
                className={cn(
                  'relative p-6 border-2 transition-all hover:scale-[1.02]',
                  style.border,
                  style.bg,
                  style.glow
                )}
              >
                {/* Tier Badge */}
                <div
                  className={cn(
                    'absolute -top-3 left-4 px-3 py-1 font-display text-xs uppercase tracking-wider border',
                    style.border,
                    style.bg
                  )}
                  style={{ color: style.color }}
                >
                  {tier}
                </div>

                {/* Crate Visual */}
                <div className="flex flex-col items-center py-8">
                  <div className="text-6xl mb-2">📦</div>
                  <div className="font-mono text-3xl font-bold">
                    x<KineticNumber value={count} />
                  </div>
                </div>

                {/* Drop Chances */}
                <div className="font-mono text-[10px] text-[var(--color-muted)] space-y-1 mb-4">
                  {DROP_CHANCES[tier]?.map((chance, i) => (
                    <p key={i}>{chance}</p>
                  ))}
                </div>

                {/* Open Button */}
                <Button
                  onClick={() => handleOpenCrate(firstCrate?.id, tier)}
                  disabled={
                    !data.canOpen ||
                    actionLoading === `open-${tier}` ||
                    actionLoading === `open-${firstCrate?.id}`
                  }
                  variant="default"
                  className="w-full"
                  style={{
                    backgroundColor: `${style.color}20`,
                    borderColor: style.color,
                  }}
                >
                  {actionLoading?.startsWith('open-') ? (
                    <InitializingText text="..." className="text-xs" />
                  ) : (
                    'OPEN'
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Escrowed Crates */}
      {escrowedCrates.length > 0 && (
        <Card variant="outlined" className="border-[var(--color-warning)]/50 p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle className="text-[var(--color-warning)]">
              ⚠ ESCROW ({escrowedCrates.length}/{data.stats.maxEscrow})
            </CardTitle>
            <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
              CLAIM BEFORE EXPIRATION (1 HOUR)
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {escrowedCrates.map((crate) => {
                const style = TIER_STYLES[crate.tier] || TIER_STYLES.common
                return (
                  <div
                    key={crate.id}
                    className={cn('p-4 border-2', style.border, style.bg)}
                  >
                    <p
                      className="font-display text-[10px] uppercase tracking-wider"
                      style={{ color: style.color }}
                    >
                      {crate.tier}
                    </p>
                    <div className="text-3xl my-2">📦</div>
                    {crate.escrow_expires_at && (
                      <p className="font-mono text-[10px] text-[var(--color-warning)] mb-2">
                        {formatTimeRemaining(crate.escrow_expires_at)}
                      </p>
                    )}
                    <Button
                      onClick={() => handleClaim(crate.id)}
                      disabled={
                        actionLoading === `claim-${crate.id}` ||
                        data.stats.total >= data.stats.maxCrates
                      }
                      variant="warning"
                      size="sm"
                      className="w-full"
                    >
                      {actionLoading === `claim-${crate.id}` ? '...' : 'CLAIM'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opening Animation Overlay */}
      {isAnimating && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl mb-4 animate-bounce">📦</div>
            <p className="font-display text-2xl uppercase tracking-wider text-[var(--color-primary)] animate-pulse">
              OPENING...
            </p>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {openResult && !isAnimating && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setOpenResult(null)}
        >
          <Card
            variant="solid"
            className={cn(
              'max-w-md w-full p-8 text-center border-2',
              TIER_STYLES[openResult.crate_tier]?.border,
              TIER_STYLES[openResult.crate_tier]?.glow
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="font-display text-sm uppercase tracking-wider mb-2"
              style={{ color: TIER_STYLES[openResult.crate_tier]?.color }}
            >
              {openResult.crate_tier} CRATE
            </p>

            {/* Reward Display */}
            <div className="my-8">
              {openResult.reward.item && (
                <>
                  <div className="text-6xl mb-4">
                    {openResult.drop_type === 'weapon' ? '⚔️' : '🛡️'}
                  </div>
                  <h3
                    className="font-display text-2xl uppercase tracking-wider"
                    style={{ color: TIER_STYLES[openResult.reward.item.tier]?.color }}
                  >
                    {openResult.reward.item.name}
                  </h3>
                  <p className="font-mono text-sm text-[var(--color-muted)] capitalize mt-1">
                    {openResult.reward.item.tier} {openResult.reward.item.type}
                  </p>
                  {openResult.reward.item.toEscrow && (
                    <p className="font-mono text-xs text-[var(--color-warning)] mt-2">
                      SENT TO ESCROW (INVENTORY FULL)
                    </p>
                  )}
                </>
              )}

              {openResult.reward.wealth && (
                <>
                  <div className="text-6xl mb-4">💰</div>
                  <h3 className="font-mono text-3xl font-bold text-[var(--color-success)]">
                    $<KineticNumber value={openResult.reward.wealth.amount} />
                  </h3>
                  <p className="font-mono text-sm text-[var(--color-muted)] mt-1">WEALTH GAINED</p>
                </>
              )}

              {openResult.reward.title && (
                <>
                  <div className="text-6xl mb-4">👑</div>
                  {openResult.reward.title.isDuplicate ? (
                    <>
                      <h3 className="font-display text-xl text-[var(--color-muted)] line-through mb-2">
                        [{openResult.reward.title.title}]
                      </h3>
                      <p className="font-mono text-xs text-[var(--color-muted)] mb-2">
                        ALREADY OWNED
                      </p>
                      <h3 className="font-mono text-2xl font-bold text-[var(--color-success)]">
                        $<KineticNumber value={openResult.reward.title.duplicateValue || 0} />
                      </h3>
                      <p className="font-mono text-sm text-[var(--color-muted)]">
                        CONVERTED TO WEALTH
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-display text-2xl text-[var(--color-secondary)]">
                        [{openResult.reward.title.title}]
                      </h3>
                      <p className="font-mono text-sm text-[var(--color-muted)] mt-1">
                        NEW TITLE UNLOCKED
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            <Button onClick={() => setOpenResult(null)} variant="default" size="lg" className="w-full">
              CONTINUE
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
