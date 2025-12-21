'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber, CurrencyDisplay } from '@/components/ui/kinetic-number'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface BondStatus {
  bonds: number
  lastBondConversion: string | null
  canConvert: boolean
  daysUntilConversion: number
  conversionCost: number
  bondsPerConversion: number
  minLevel: number
  currentLevel: number
}

interface BondBundle {
  id: string
  bonds: number
  bonus: number
  total: number
  priceUsd: number
}

interface Cosmetic {
  type: string
  name: string
  cost: number
  owned: boolean
}

interface BondTransaction {
  id: string
  amount: number
  type: string
  description: string | null
  createdAt: string
}

// =============================================================================
// BONDS PAGE
// =============================================================================

export default function BondsPage() {
  const [status, setStatus] = useState<BondStatus | null>(null)
  const [bundles, setBundles] = useState<BondBundle[]>([])
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([])
  const [transactions, setTransactions] = useState<BondTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  // Fetch bond data
  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, purchaseRes, historyRes] = await Promise.all([
          fetch('/api/bonds'),
          fetch('/api/bonds/purchase'),
          fetch('/api/bonds/history'),
        ])

        if (statusRes.ok) {
          const data = await statusRes.json()
          setStatus(data.data)
        }

        if (purchaseRes.ok) {
          const data = await purchaseRes.json()
          setBundles(data.data.bundles || [])
          setCosmetics(data.data.cosmetics || [])
        }

        if (historyRes.ok) {
          const data = await historyRes.json()
          setTransactions(data.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch bond data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleConvertCredits = useCallback(async () => {
    setConverting(true)
    try {
      const res = await fetch('/api/bonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Conversion failed')
      }

      // Refresh status
      const statusRes = await fetch('/api/bonds')
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData.data)
      }
    } catch (error) {
      console.error('Failed to convert credits:', error)
    } finally {
      setConverting(false)
    }
  }, [])

  const handleBuyBundle = useCallback(async (bundleId: string) => {
    setPurchasing(bundleId)
    try {
      const res = await fetch('/api/bonds/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: bundleId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed')
      }

      // Redirect to Stripe checkout
      if (data.data.url) {
        window.location.href = data.data.url
      }
    } catch (error) {
      console.error('Failed to start checkout:', error)
    } finally {
      setPurchasing(null)
    }
  }, [])

  const handleBuyCosmetic = useCallback(async (type: string, name?: string) => {
    setPurchasing(type)
    try {
      const res = await fetch('/api/bonds/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Purchase failed')
      }

      // Refresh data
      const [statusRes, purchaseRes] = await Promise.all([
        fetch('/api/bonds'),
        fetch('/api/bonds/purchase'),
      ])

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData.data)
      }
      if (purchaseRes.ok) {
        const purchaseData = await purchaseRes.json()
        setCosmetics(purchaseData.data.cosmetics || [])
      }
    } catch (error) {
      console.error('Failed to buy cosmetic:', error)
    } finally {
      setPurchasing(null)
    }
  }, [])

  if (loading) {
    return <BondsPageSkeleton />
  }

  const meetsLevelReq = status ? status.currentLevel >= status.minLevel : false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[var(--color-foreground)]">
          <span className="text-gradient-secondary">BONDS</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// PREMIUM CURRENCY // '}
          <span className="text-[var(--color-secondary)]">
            Exclusive cosmetics and rewards
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bond Balance Card */}
        <Card variant="default" glow="secondary" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DiamondIcon className="w-6 h-6 text-[var(--color-secondary)]" />
              BOND BALANCE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Balance Display */}
            <div className="flex items-center justify-between p-6 bg-[var(--color-surface)] border-2 border-[var(--color-secondary)]">
              <div>
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  CURRENT BALANCE
                </span>
                <p className="font-mono text-5xl text-[var(--color-secondary)] mt-1">
                  <KineticNumber value={status?.bonds || 0} />
                </p>
              </div>
              <div className="text-6xl">💎</div>
            </div>

            {/* Credit Conversion */}
            <div className="p-4 border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-display uppercase tracking-wider text-[var(--color-warning)]">
                    THE GOLDEN SINK
                  </span>
                  <p className="font-mono text-sm text-[var(--color-muted)] mt-1">
                    Convert credits to bonds (weekly)
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg">
                    <CurrencyDisplay value={status?.conversionCost || 2500000} />
                  </span>
                  <p className="font-mono text-xs text-[var(--color-success)]">
                    = {status?.bondsPerConversion || 100} bonds
                  </p>
                </div>
              </div>

              {!meetsLevelReq ? (
                <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-destructive)]/30">
                  <span className="font-mono text-sm text-[var(--color-destructive)]">
                    Requires Level {status?.minLevel || 60} (Captain tier)
                  </span>
                </div>
              ) : !status?.canConvert ? (
                <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-muted)]/30">
                  <span className="font-mono text-sm text-[var(--color-muted)]">
                    Available in {status?.daysUntilConversion || 7} days
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleConvertCredits}
                  disabled={converting}
                  variant="default"
                  className="w-full glow-primary"
                >
                  {converting ? 'CONVERTING...' : 'CONVERT CREDITS'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Buy Bonds Card */}
        <Card variant="solid">
          <CardHeader>
            <CardTitle className="text-sm">BUY BONDS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bundles.length > 0 ? (
              bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => handleBuyBundle(bundle.id)}
                  disabled={purchasing === bundle.id}
                  className={cn(
                    'w-full p-3 border-2 transition-all text-left',
                    'border-[var(--color-secondary)]/30 hover:border-[var(--color-secondary)]',
                    'bg-[var(--color-surface)] hover:bg-[var(--color-secondary)]/5'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-display text-sm uppercase">
                        {bundle.total.toLocaleString()} BONDS
                      </span>
                      {bundle.bonus > 0 && (
                        <span className="ml-2 font-mono text-xs text-[var(--color-success)]">
                          +{bundle.bonus} BONUS
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-lg text-[var(--color-secondary)]">
                      ${bundle.priceUsd.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center">
                <span className="font-mono text-sm text-[var(--color-muted)]">
                  Bond purchases coming soon
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cosmetics Shop */}
      <Card variant="solid">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <SparkleIcon className="w-5 h-5 text-[var(--color-secondary)]" />
            BOND SHOP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Custom Title */}
            <CosmeticCard
              type="title"
              name="Custom Title"
              description="Set a custom title for your profile"
              cost={100}
              owned={cosmetics.find((c) => c.type === 'title')?.owned || false}
              canAfford={(status?.bonds || 0) >= 100}
              purchasing={purchasing === 'title'}
              onBuy={() => handleBuyCosmetic('title')}
            />

            {/* Profile Frame */}
            <CosmeticCard
              type="frame"
              name="Profile Frame"
              description="Add a unique border to your avatar"
              cost={50}
              owned={cosmetics.find((c) => c.type === 'frame')?.owned || false}
              canAfford={(status?.bonds || 0) >= 50}
              purchasing={purchasing === 'frame'}
              onBuy={() => handleBuyCosmetic('frame')}
            />

            {/* Name Color */}
            <CosmeticCard
              type="color"
              name="Name Color"
              description="Change your name color in chat"
              cost={75}
              owned={cosmetics.find((c) => c.type === 'color')?.owned || false}
              canAfford={(status?.bonds || 0) >= 75}
              purchasing={purchasing === 'color'}
              onBuy={() => handleBuyCosmetic('color')}
            />

            {/* Chat Badge */}
            <CosmeticCard
              type="badge"
              name="Chat Badge"
              description="Display a special badge next to your name"
              cost={150}
              owned={cosmetics.find((c) => c.type === 'badge')?.owned || false}
              canAfford={(status?.bonds || 0) >= 150}
              purchasing={purchasing === 'badge'}
              onBuy={() => handleBuyCosmetic('badge')}
            />

            {/* Season Pass */}
            <CosmeticCard
              type="season_pass"
              name="Season Pass"
              description="90-day pass with exclusive rewards"
              cost={500}
              owned={cosmetics.find((c) => c.type === 'season_pass')?.owned || false}
              canAfford={(status?.bonds || 0) >= 500}
              purchasing={purchasing === 'season_pass'}
              onBuy={() => handleBuyCosmetic('season_pass')}
              highlight
            />
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
                    <p className="font-mono text-[10px] text-[var(--color-muted)]">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
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
                    {tx.amount} 💎
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
// COSMETIC CARD
// =============================================================================

function CosmeticCard({
  type,
  name,
  description,
  cost,
  owned,
  canAfford,
  purchasing,
  onBuy,
  highlight,
}: {
  type: string
  name: string
  description: string
  cost: number
  owned: boolean
  canAfford: boolean
  purchasing: boolean
  onBuy: () => void
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'p-4 border-2 transition-all',
        highlight
          ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/5'
          : 'border-[var(--color-border)]',
        owned && 'opacity-50'
      )}
    >
      <div className="mb-3">
        <span className="font-display text-sm uppercase">{name}</span>
        <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg text-[var(--color-secondary)]">
          {cost} 💎
        </span>
        <Button
          onClick={onBuy}
          disabled={owned || !canAfford || purchasing}
          variant="ghost"
          size="sm"
        >
          {purchasing
            ? '...'
            : owned
            ? 'OWNED'
            : canAfford
            ? 'BUY'
            : 'NEED MORE'}
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// SKELETON
// =============================================================================

function BondsPageSkeleton() {
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

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 9l10 13L22 9l-10-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 9h20M7 9l5 13 5-13" />
    </svg>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
