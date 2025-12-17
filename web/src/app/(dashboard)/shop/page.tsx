'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay, KineticNumber, StatValue } from '@/components/ui/kinetic-number'
import { PageLoader, InitializingText } from '@/components/ui/initializing-loader'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface ShopItem {
  shopItemId: number
  item_id: number
  itemName: string
  type: string
  tier: string
  price: number
  original_price: number
  is_purchased: boolean
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
  description: string | null
  flavor_text: string | null
}

interface ShopData {
  items: ShopItem[]
  generated_at: string | null
  playerTier: string
  accessibleTiers: string[]
  stats: {
    totalPurchases: number
    totalSpent: number
  }
}

// =============================================================================
// TIER STYLING
// =============================================================================

const TIER_STYLES: Record<string, { color: string; border: string; bg: string }> = {
  common: {
    color: 'var(--tier-common)',
    border: 'border-[var(--tier-common)]/50',
    bg: 'bg-[var(--tier-common)]/5',
  },
  uncommon: {
    color: 'var(--tier-uncommon)',
    border: 'border-[var(--tier-uncommon)]/50',
    bg: 'bg-[var(--tier-uncommon)]/5',
  },
  rare: {
    color: 'var(--tier-rare)',
    border: 'border-[var(--tier-rare)]/50',
    bg: 'bg-[var(--tier-rare)]/5',
  },
  legendary: {
    color: 'var(--tier-legendary)',
    border: 'border-[var(--tier-legendary)]/50',
    bg: 'bg-[var(--tier-legendary)]/5',
  },
}

// =============================================================================
// SHOP PAGE
// =============================================================================

export default function ShopPage() {
  const [shopData, setShopData] = useState<ShopData | null>(null)
  const [userWealth, setUserWealth] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [shopRes, userRes] = await Promise.all([
        fetch('/api/users/me/shop'),
        fetch('/api/users/me'),
      ])

      if (shopRes.ok) {
        const json = await shopRes.json()
        setShopData(json.data)
      }

      if (userRes.ok) {
        const json = await userRes.json()
        setUserWealth(Number(json.data.wealth))
      }
    } catch (error) {
      console.error('Failed to fetch shop data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuy(shopItemId: number, price: number) {
    if (userWealth < price) {
      setMessage({ type: 'error', text: `INSUFFICIENT FUNDS - NEED $${price.toLocaleString()}` })
      return
    }

    setActionLoading(`buy-${shopItemId}`)
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopItemId }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: json.data.message.toUpperCase() })
        setUserWealth(Number(json.data.newWealth))
        setSelectedItem(null)
        await fetchData()
      } else {
        setMessage({ type: 'error', text: json.error.toUpperCase() })
      }
    } catch {
      setMessage({ type: 'error', text: 'TRANSACTION FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReroll() {
    setActionLoading('reroll')
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/shop/reroll', { method: 'POST' })
      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'INVENTORY REFRESHED' })
        await fetchData()
      } else {
        setMessage({ type: 'error', text: json.error.toUpperCase() })
      }
    } catch {
      setMessage({ type: 'error', text: 'REFRESH FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <PageLoader message="LOADING SHOP INVENTORY" />
  }

  if (!shopData) {
    return (
      <Card variant="outlined" className="border-[var(--color-destructive)] p-8 text-center">
        <p className="font-mono text-[var(--color-destructive)]">{'> SHOP DATA UNAVAILABLE'}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
            BLACK <span className="text-[var(--color-primary)]">MARKET</span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// TIER: '}
            <span className="text-[var(--color-secondary)]">{shopData.playerTier.toUpperCase()}</span>
            {' // PERSONAL INVENTORY'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
              AVAILABLE FUNDS
            </p>
            <CurrencyDisplay value={userWealth} size="lg" />
          </div>
          <Button
            onClick={handleReroll}
            disabled={actionLoading === 'reroll'}
            variant="outline"
          >
            {actionLoading === 'reroll' ? (
              <InitializingText text="REFRESH" className="text-xs" />
            ) : (
              'REFRESH'
            )}
          </Button>
        </div>
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

      {/* Tier Access Info */}
      <Card variant="solid" className="p-4">
        <p className="font-mono text-sm text-[var(--color-muted)]">
          {'> ACCESS GRANTED: '}
          {shopData.accessibleTiers.map((tier, i) => (
            <span key={tier}>
              <span style={{ color: TIER_STYLES[tier]?.color }}>{tier.toUpperCase()}</span>
              {i < shopData.accessibleTiers.length - 1 && ', '}
            </span>
          ))}
        </p>
      </Card>

      {/* Shop Items Grid */}
      <Card variant="solid" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>AVAILABLE ITEMS ({shopData.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {shopData.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-mono text-[var(--color-muted)]">{'> NO ITEMS AVAILABLE'}</p>
              <p className="font-mono text-xs text-[var(--color-muted)]/70 mt-2">
                {'// TRY REFRESHING THE INVENTORY'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {shopData.items.map((item) => (
                <ShopItemCard
                  key={item.shopItemId}
                  item={item}
                  userWealth={userWealth}
                  onSelect={() => setSelectedItem(item)}
                  onBuy={() => handleBuy(item.shopItemId, item.price)}
                  isLoading={actionLoading === `buy-${item.shopItemId}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shop Stats */}
      <Card variant="default" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>PURCHASE HISTORY</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-6">
            <StatValue
              label="TOTAL PURCHASES"
              value={shopData.stats.totalPurchases}
              valueClassName="text-[var(--color-secondary)]"
            />
            <StatValue
              label="TOTAL SPENT"
              value={shopData.stats.totalSpent}
              prefix="$"
              valueClassName="text-[var(--color-success)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          userWealth={userWealth}
          onClose={() => setSelectedItem(null)}
          onBuy={() => handleBuy(selectedItem.shopItemId, selectedItem.price)}
          isLoading={actionLoading === `buy-${selectedItem.shopItemId}`}
        />
      )}
    </div>
  )
}

// =============================================================================
// SHOP ITEM CARD
// =============================================================================

function ShopItemCard({
  item,
  userWealth,
  onSelect,
  onBuy,
  isLoading,
}: {
  item: ShopItem
  userWealth: number
  onSelect: () => void
  onBuy: () => void
  isLoading: boolean
}) {
  const tierStyle = TIER_STYLES[item.tier] || TIER_STYLES.common
  const canAfford = userWealth >= item.price

  return (
    <div
      className={cn(
        'p-4 border-2 cursor-pointer transition-all duration-150',
        tierStyle.border,
        tierStyle.bg,
        'hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(0,255,241,0.2)]'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span
          className="font-display text-xs uppercase tracking-wider"
          style={{ color: tierStyle.color }}
        >
          {item.tier}
        </span>
        <span className="font-mono text-xs text-[var(--color-muted)] uppercase">
          {item.type}
        </span>
      </div>

      {/* Name */}
      <h3 className="font-display text-sm uppercase tracking-wider mb-3 line-clamp-1">
        {item.itemName}
      </h3>

      {/* Stats */}
      <div className="space-y-1 text-xs font-mono mb-4 min-h-[48px]">
        {item.rob_bonus && (
          <p className="text-[var(--color-destructive)]">+{item.rob_bonus}% ROB</p>
        )}
        {item.defense_bonus && (
          <p className="text-[var(--color-primary)]">+{item.defense_bonus}% DEF</p>
        )}
        {item.insurance_percent && (
          <p className="text-[var(--color-success)]">{item.insurance_percent}% INS</p>
        )}
        {item.revenue_min && (
          <p className="text-[var(--color-warning)]">
            ${item.revenue_min}-{item.revenue_max} REV
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-current/20">
        <span
          className={cn(
            'font-mono font-bold',
            canAfford ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'
          )}
        >
          $<KineticNumber value={item.price} />
        </span>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            onBuy()
          }}
          disabled={isLoading || !canAfford}
          variant={canAfford ? 'default' : 'ghost'}
          size="sm"
        >
          {isLoading ? '...' : 'BUY'}
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// ITEM DETAIL MODAL
// =============================================================================

function ItemDetailModal({
  item,
  userWealth,
  onClose,
  onBuy,
  isLoading,
}: {
  item: ShopItem
  userWealth: number
  onClose: () => void
  onBuy: () => void
  isLoading: boolean
}) {
  const tierStyle = TIER_STYLES[item.tier] || TIER_STYLES.common
  const canAfford = userWealth >= item.price

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        variant="solid"
        className={cn('max-w-md w-full p-6 border-2', tierStyle.border)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span
              className="font-display text-xs uppercase tracking-wider"
              style={{ color: tierStyle.color }}
            >
              {item.tier} {item.type}
            </span>
            <h3 className="font-display text-xl uppercase tracking-wider mt-1">
              {item.itemName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] p-1"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Description */}
        {item.description && (
          <p className="font-mono text-sm text-[var(--color-foreground)] mb-2">
            {item.description}
          </p>
        )}
        {item.flavor_text && (
          <p className="font-mono text-xs text-[var(--color-muted)] italic mb-4">
            "{item.flavor_text}"
          </p>
        )}

        {/* Stats */}
        <div className="space-y-2 font-mono text-sm mb-6">
          {item.rob_bonus && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">ROB BONUS</span>
              <span className="text-[var(--color-destructive)]">+{item.rob_bonus}%</span>
            </div>
          )}
          {item.defense_bonus && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">DEFENSE BONUS</span>
              <span className="text-[var(--color-primary)]">+{item.defense_bonus}%</span>
            </div>
          )}
          {item.insurance_percent && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">INSURANCE</span>
              <span className="text-[var(--color-success)]">{item.insurance_percent}%</span>
            </div>
          )}
          {item.revenue_min && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">REVENUE</span>
              <span className="text-[var(--color-warning)]">
                ${item.revenue_min}-{item.revenue_max}
              </span>
            </div>
          )}
        </div>

        {/* Purchase Section */}
        <div className="border-t border-[var(--color-primary)]/20 pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
              PRICE
            </span>
            <span
              className={cn(
                'font-mono text-xl font-bold',
                canAfford ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'
              )}
            >
              $<KineticNumber value={item.price} />
            </span>
          </div>
          <Button
            onClick={onBuy}
            disabled={isLoading || !canAfford}
            variant={canAfford ? 'default' : 'destructive'}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <InitializingText text="PROCESSING" className="text-xs" />
            ) : canAfford ? (
              'PURCHASE'
            ) : (
              `NEED $${(item.price - userWealth).toLocaleString()} MORE`
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
