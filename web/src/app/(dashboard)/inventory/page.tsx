'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber, StatValue } from '@/components/ui/kinetic-number'
import { PageLoader, InitializingText } from '@/components/ui/initializing-loader'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface InventoryItem {
  id: number
  item_id: number
  itemName: string
  type: string
  tier: string
  durability: number
  maxDurability: number
  is_equipped: boolean
  slot: string | null
  is_escrowed: boolean
  escrow_expires_at: string | null
  acquired_at: string
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
  sell_price: number | null
  description: string | null
  flavor_text: string | null
}

interface EquippedItems {
  weapon: InventoryItem | null
  armor: InventoryItem | null
  business: InventoryItem | null
  housing: InventoryItem | null
}

interface InventoryStats {
  totalSlots: number
  usedSlots: number
  availableSlots: number
  escrowedCount: number
}

interface InventoryData {
  inventory: InventoryItem[]
  equipped: EquippedItems
  stats: InventoryStats
  escrowed: InventoryItem[]
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

const SLOT_CONFIG: { key: keyof EquippedItems; label: string; icon: string }[] = [
  { key: 'weapon', label: 'WEAPON', icon: '⚔️' },
  { key: 'armor', label: 'ARMOR', icon: '🛡️' },
  { key: 'business', label: 'BUSINESS', icon: '🏢' },
  { key: 'housing', label: 'HOUSING', icon: '🏠' },
]

// =============================================================================
// INVENTORY PAGE
// =============================================================================

export default function InventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)

  useEffect(() => {
    fetchInventory()
  }, [])

  async function fetchInventory() {
    try {
      const res = await fetch('/api/users/me/inventory')
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleEquip(inventoryId: number) {
    setActionLoading(`equip-${inventoryId}`)
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/inventory/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'ITEM EQUIPPED' })
        await fetchInventory()
        setSelectedItem(null)
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'EQUIP FAILED' })
      }
    } catch {
      setMessage({ type: 'error', text: 'EQUIP OPERATION FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleUnequip(slot: string) {
    setActionLoading(`unequip-${slot}`)
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/inventory/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'ITEM UNEQUIPPED' })
        await fetchInventory()
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'UNEQUIP FAILED' })
      }
    } catch {
      setMessage({ type: 'error', text: 'UNEQUIP OPERATION FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSell(inventoryId: number) {
    setActionLoading(`sell-${inventoryId}`)
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/inventory/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: json.data?.message?.toUpperCase() || 'ITEM SOLD' })
        await fetchInventory()
        setSelectedItem(null)
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'SELL FAILED' })
      }
    } catch {
      setMessage({ type: 'error', text: 'SELL OPERATION FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleClaim(inventoryId: number) {
    setActionLoading(`claim-${inventoryId}`)
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/inventory/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'ITEM CLAIMED FROM ESCROW' })
        await fetchInventory()
      } else {
        setMessage({ type: 'error', text: json.error?.toUpperCase() || 'CLAIM FAILED' })
      }
    } catch {
      setMessage({ type: 'error', text: 'CLAIM OPERATION FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <PageLoader message="LOADING INVENTORY DATA" />
  }

  if (!data) {
    return (
      <Card variant="outlined" className="border-[var(--color-destructive)] p-8 text-center">
        <p className="font-mono text-[var(--color-destructive)]">{'> INVENTORY DATA UNAVAILABLE'}</p>
      </Card>
    )
  }

  const unequippedItems = data.inventory.filter((item) => !item.is_equipped)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
            <span className="text-[var(--color-primary)]">INVENTORY</span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// '}
            <KineticNumber value={data.stats.usedSlots} />/{data.stats.totalSlots} SLOTS USED
            {data.stats.escrowedCount > 0 && (
              <span className="text-[var(--color-warning)]">
                {' // '}{data.stats.escrowedCount} IN ESCROW
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <StatValue
            label="AVAILABLE"
            value={data.stats.availableSlots}
            valueClassName="text-[var(--color-success)]"
          />
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

      {/* Equipped Items */}
      <Card variant="default" glow="primary" scanlines className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>EQUIPPED LOADOUT</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SLOT_CONFIG.map(({ key, label, icon }) => {
              const item = data.equipped[key]
              return (
                <EquipmentSlot
                  key={key}
                  slot={key}
                  label={label}
                  icon={icon}
                  item={item}
                  onUnequip={() => handleUnequip(key)}
                  onSelect={() => item && setSelectedItem(item)}
                  isLoading={actionLoading === `unequip-${key}`}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unequipped Items */}
      <Card variant="solid" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>STORAGE ({unequippedItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unequippedItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-mono text-[var(--color-muted)]">{'> STORAGE EMPTY'}</p>
              <p className="font-mono text-xs text-[var(--color-muted)]/70 mt-2">
                {'// VISIT THE BLACK MARKET TO ACQUIRE ITEMS'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {unequippedItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  onSelect={() => setSelectedItem(item)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escrowed Items */}
      {data.escrowed.length > 0 && (
        <Card variant="outlined" className="border-[var(--color-warning)]/50 p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle className="text-[var(--color-warning)]">⚠ ESCROW ({data.escrowed.length})</CardTitle>
            <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
              {'// CLAIM BEFORE EXPIRATION'}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {data.escrowed.map((item) => (
                <EscrowedItemCard
                  key={item.id}
                  item={item}
                  onClaim={() => handleClaim(item.id)}
                  isLoading={actionLoading === `claim-${item.id}`}
                  canClaim={data.stats.availableSlots > 0}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Item Detail Modal */}
      {selectedItem && !selectedItem.is_escrowed && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEquip={() => handleEquip(selectedItem.id)}
          onSell={() => handleSell(selectedItem.id)}
          isEquipping={actionLoading === `equip-${selectedItem.id}`}
          isSelling={actionLoading === `sell-${selectedItem.id}`}
        />
      )}
    </div>
  )
}

// =============================================================================
// EQUIPMENT SLOT
// =============================================================================

function EquipmentSlot({
  slot,
  label,
  icon,
  item,
  onUnequip,
  onSelect,
  isLoading,
}: {
  slot: string
  label: string
  icon: string
  item: InventoryItem | null
  onUnequip: () => void
  onSelect: () => void
  isLoading: boolean
}) {
  const tierStyle = item ? TIER_STYLES[item.tier] || TIER_STYLES.common : null

  return (
    <div>
      <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2 flex items-center gap-2">
        <span>{icon}</span>
        {label}
      </p>
      {item ? (
        <div
          className={cn(
            'p-4 border-2 cursor-pointer transition-all',
            tierStyle?.border,
            tierStyle?.bg,
            'hover:shadow-[0_0_15px_rgba(0,255,241,0.2)]'
          )}
          onClick={onSelect}
        >
          <p className="font-display text-sm uppercase tracking-wider truncate mb-2">
            {item.itemName}
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-mono mb-3">
            {item.rob_bonus && <span className="text-[var(--color-destructive)]">+{item.rob_bonus}% ROB</span>}
            {item.defense_bonus && <span className="text-[var(--color-primary)]">+{item.defense_bonus}% DEF</span>}
            {item.insurance_percent && <span className="text-[var(--color-success)]">{item.insurance_percent}% INS</span>}
            {item.revenue_min && <span className="text-[var(--color-warning)]">${item.revenue_min}-{item.revenue_max}</span>}
          </div>
          {/* Durability Bar */}
          <DurabilityBar current={item.durability} max={item.maxDurability} />
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onUnequip()
            }}
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="w-full mt-3"
          >
            {isLoading ? <InitializingText text="..." className="text-xs" /> : 'UNEQUIP'}
          </Button>
        </div>
      ) : (
        <div className="p-4 border-2 border-dashed border-[var(--color-muted)]/30 bg-[var(--color-surface)]/30 text-center min-h-[120px] flex items-center justify-center">
          <p className="font-mono text-xs text-[var(--color-muted)]">EMPTY</p>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// INVENTORY ITEM CARD
// =============================================================================

function InventoryItemCard({
  item,
  onSelect,
}: {
  item: InventoryItem
  onSelect: () => void
}) {
  const tierStyle = TIER_STYLES[item.tier] || TIER_STYLES.common

  return (
    <div
      className={cn(
        'p-3 border-2 cursor-pointer transition-all',
        tierStyle.border,
        tierStyle.bg,
        'hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(0,255,241,0.2)]'
      )}
      onClick={onSelect}
    >
      <span
        className="font-display text-[10px] uppercase tracking-wider"
        style={{ color: tierStyle.color }}
      >
        {item.tier}
      </span>
      <p className="font-display text-xs uppercase tracking-wider truncate mt-1">
        {item.itemName}
      </p>
      <p className="font-mono text-[10px] text-[var(--color-muted)] uppercase mt-1">
        {item.type}
      </p>
      <DurabilityBar current={item.durability} max={item.maxDurability} className="mt-2" />
    </div>
  )
}

// =============================================================================
// ESCROWED ITEM CARD
// =============================================================================

function EscrowedItemCard({
  item,
  onClaim,
  isLoading,
  canClaim,
}: {
  item: InventoryItem
  onClaim: () => void
  isLoading: boolean
  canClaim: boolean
}) {
  const tierStyle = TIER_STYLES[item.tier] || TIER_STYLES.common

  return (
    <div className={cn('p-3 border-2', tierStyle.border, tierStyle.bg)}>
      <span
        className="font-display text-[10px] uppercase tracking-wider"
        style={{ color: tierStyle.color }}
      >
        {item.tier}
      </span>
      <p className="font-display text-xs uppercase tracking-wider truncate mt-1">
        {item.itemName}
      </p>
      {item.escrow_expires_at && (
        <p className="font-mono text-[10px] text-[var(--color-warning)] mt-2">
          EXP: {new Date(item.escrow_expires_at).toLocaleDateString()}
        </p>
      )}
      <Button
        onClick={onClaim}
        disabled={isLoading || !canClaim}
        variant="warning"
        size="sm"
        className="w-full mt-2"
      >
        {isLoading ? '...' : 'CLAIM'}
      </Button>
    </div>
  )
}

// =============================================================================
// DURABILITY BAR
// =============================================================================

function DurabilityBar({
  current,
  max,
  className,
}: {
  current: number
  max: number
  className?: string
}) {
  const percentage = (current / max) * 100
  const color =
    percentage > 50
      ? 'bg-[var(--color-success)]'
      : percentage > 25
      ? 'bg-[var(--color-warning)]'
      : 'bg-[var(--color-destructive)]'

  return (
    <div className={className}>
      <div className="h-1 bg-[var(--color-surface)] border border-[var(--color-primary)]/20">
        <div className={cn('h-full transition-all', color)} style={{ width: `${percentage}%` }} />
      </div>
      <p className="font-mono text-[10px] text-[var(--color-muted)] mt-1">
        {current}/{max}
      </p>
    </div>
  )
}

// =============================================================================
// ITEM DETAIL MODAL
// =============================================================================

function ItemDetailModal({
  item,
  onClose,
  onEquip,
  onSell,
  isEquipping,
  isSelling,
}: {
  item: InventoryItem
  onClose: () => void
  onEquip: () => void
  onSell: () => void
  isEquipping: boolean
  isSelling: boolean
}) {
  const tierStyle = TIER_STYLES[item.tier] || TIER_STYLES.common

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
        <div className="space-y-2 font-mono text-sm mb-4">
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
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">DURABILITY</span>
            <span>{item.durability}/{item.maxDurability}</span>
          </div>
          {item.sell_price && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">SELL VALUE</span>
              <span className="text-[var(--color-success)]">${item.sell_price.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Durability Bar */}
        <DurabilityBar current={item.durability} max={item.maxDurability} className="mb-4" />

        {/* Actions */}
        {!item.is_equipped && (
          <div className="flex gap-3 pt-4 border-t border-[var(--color-primary)]/20">
            <Button
              onClick={onEquip}
              disabled={isEquipping}
              variant="default"
              className="flex-1"
            >
              {isEquipping ? <InitializingText text="..." className="text-xs" /> : 'EQUIP'}
            </Button>
            <Button
              onClick={onSell}
              disabled={isSelling}
              variant="destructive"
              className="flex-1"
            >
              {isSelling ? (
                <InitializingText text="..." className="text-xs" />
              ) : (
                `SELL $${item.sell_price?.toLocaleString() ?? 0}`
              )}
            </Button>
          </div>
        )}
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
