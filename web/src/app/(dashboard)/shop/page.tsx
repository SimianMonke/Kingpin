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

// Shop Item Types
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

// Consumable Types
interface ConsumableType {
  id: string
  name: string
  category: string
  cost: number
  isDurationBuff: boolean
  durationHours: number | null
  buffKey: string | null
  buffValue: number | null
  isSingleUse: boolean
  maxOwned: number | null
  description: string | null
  flavorText: string | null
  icon: string | null
  sortOrder: number
}

interface UserBuff {
  id: number
  buffType: string
  category: string | null
  multiplier: number
  source: string
  description: string | null
  expiresAt: string | null
  remainingMinutes: number | null
  isActive: boolean
}

interface UserConsumableItem {
  consumableId: string
  name: string
  category: string
  quantity: number
  maxOwned: number | null
  description: string | null
  icon: string | null
}

interface SupplyDepotData {
  catalog: {
    durationBuffs: ConsumableType[]
    singleUseItems: ConsumableType[]
    all: ConsumableType[]
  }
  userBuffs: UserBuff[]
  userInventory: UserConsumableItem[]
  stats: {
    totalSpent: number
    activeBuffCount: number
    inventoryItemCount: number
  }
}

// Stream Action Types
interface StreamActionType {
  id: string
  name: string
  description: string | null
  category: string
  cost: number
  cooldownSeconds: number
  limitPerStream: number | null
  queueBehavior: 'overwrite' | 'queue'
  maxCharacters: number | null
  sortOrder: number
}

interface ActionAvailability {
  available: boolean
  reason?: string
  cooldownRemaining?: number
  usedThisStream?: number
  limitPerStream?: number | null
}

interface StreamActionsData {
  actions: StreamActionType[]
  categories: Record<string, StreamActionType[]>
  streamLive: boolean
  lumiaOnline: boolean
  lumiaLatency: number | null
  actionStatus: Record<string, ActionAvailability>
  audioQueue: {
    length: number
    isProcessing: boolean
  }
  categoryOrder: string[]
}

type ShopTab = 'market' | 'supplies' | 'stream'

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

const CATEGORY_ICONS: Record<string, string> = {
  xp: '⚡',
  combat: '⚔️',
  economy: '💰',
  utility: '🔧',
  lights: '💡',
  fog: '🌫️',
  sound: '🔊',
  tts: '🗣️',
}

// =============================================================================
// SHOP PAGE
// =============================================================================

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState<ShopTab>('market')
  const [userWealth, setUserWealth] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Shop data states
  const [shopData, setShopData] = useState<ShopData | null>(null)
  const [supplyData, setSupplyData] = useState<SupplyDepotData | null>(null)
  const [streamData, setStreamData] = useState<StreamActionsData | null>(null)

  useEffect(() => {
    fetchUserData()
    fetchShopData()
  }, [])

  useEffect(() => {
    if (activeTab === 'supplies' && !supplyData) {
      fetchSupplyData()
    } else if (activeTab === 'stream' && !streamData) {
      fetchStreamData()
    }
  }, [activeTab, supplyData, streamData])

  async function fetchUserData() {
    try {
      const res = await fetch('/api/users/me')
      if (res.ok) {
        const json = await res.json()
        setUserWealth(Number(json.data.wealth))
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    }
  }

  async function fetchShopData() {
    try {
      const res = await fetch('/api/users/me/shop')
      if (res.ok) {
        const json = await res.json()
        setShopData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch shop data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSupplyData() {
    try {
      const res = await fetch('/api/shop/supplies')
      if (res.ok) {
        const json = await res.json()
        setSupplyData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch supply data:', error)
    }
  }

  async function fetchStreamData() {
    try {
      const res = await fetch('/api/shop/stream-actions')
      if (res.ok) {
        const json = await res.json()
        setStreamData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch stream actions:', error)
    }
  }

  if (loading) {
    return <PageLoader message="LOADING SHOP INVENTORY" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
            THE <span className="text-[var(--color-primary)]">SHOP</span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// UNDERGROUND MARKETS & SERVICES'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
            AVAILABLE FUNDS
          </p>
          <CurrencyDisplay value={userWealth} size="lg" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b-2 border-[var(--color-primary)]/20 pb-2">
        <TabButton
          active={activeTab === 'market'}
          onClick={() => setActiveTab('market')}
          label="BLACK MARKET"
          icon="🏪"
        />
        <TabButton
          active={activeTab === 'supplies'}
          onClick={() => setActiveTab('supplies')}
          label="SUPPLY DEPOT"
          icon="💊"
        />
        <TabButton
          active={activeTab === 'stream'}
          onClick={() => setActiveTab('stream')}
          label="STREAM CONTROL"
          icon="📡"
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'market' && (
        <BlackMarketTab
          shopData={shopData}
          userWealth={userWealth}
          setUserWealth={setUserWealth}
          onRefresh={fetchShopData}
        />
      )}
      {activeTab === 'supplies' && (
        <SupplyDepotTab
          supplyData={supplyData}
          userWealth={userWealth}
          setUserWealth={setUserWealth}
          onRefresh={fetchSupplyData}
        />
      )}
      {activeTab === 'stream' && (
        <StreamActionsTab
          streamData={streamData}
          userWealth={userWealth}
          setUserWealth={setUserWealth}
          onRefresh={fetchStreamData}
        />
      )}
    </div>
  )
}

// =============================================================================
// TAB BUTTON
// =============================================================================

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 font-display text-xs sm:text-sm uppercase tracking-wider transition-all duration-150',
        'border-2 border-b-0',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
          : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-muted)]/30'
      )}
    >
      <span className="mr-2">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// =============================================================================
// BLACK MARKET TAB
// =============================================================================

function BlackMarketTab({
  shopData,
  userWealth,
  setUserWealth,
  onRefresh,
}: {
  shopData: ShopData | null
  userWealth: number
  setUserWealth: (v: number) => void
  onRefresh: () => void
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)

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
        await onRefresh()
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
        await onRefresh()
      } else {
        setMessage({ type: 'error', text: json.error.toUpperCase() })
      }
    } catch {
      setMessage({ type: 'error', text: 'REFRESH FAILED' })
    } finally {
      setActionLoading(null)
    }
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
      {/* Sub-header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-[var(--color-muted)] font-mono text-sm">
          {'// TIER: '}
          <span className="text-[var(--color-secondary)]">{shopData.playerTier.toUpperCase()}</span>
          {' // PERSONAL INVENTORY'}
        </p>
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

      {/* Message */}
      {message && <MessageCard message={message} />}

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
// SUPPLY DEPOT TAB
// =============================================================================

function SupplyDepotTab({
  supplyData,
  userWealth,
  setUserWealth,
  onRefresh,
}: {
  supplyData: SupplyDepotData | null
  userWealth: number
  setUserWealth: (v: number) => void
  onRefresh: () => void
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handlePurchase(consumableId: string, cost: number) {
    if (userWealth < cost) {
      setMessage({ type: 'error', text: `INSUFFICIENT FUNDS - NEED $${cost.toLocaleString()}` })
      return
    }

    setActionLoading(consumableId)
    setMessage(null)

    try {
      const res = await fetch('/api/shop/supplies/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumableId }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: json.data.message.toUpperCase() })
        setUserWealth(Number(json.data.newWealth))
        await onRefresh()
      } else {
        setMessage({ type: 'error', text: json.error.toUpperCase() })
      }
    } catch {
      setMessage({ type: 'error', text: 'TRANSACTION FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  if (!supplyData) {
    return (
      <div className="flex items-center justify-center py-12">
        <InitializingText text="LOADING SUPPLY DEPOT" className="text-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && <MessageCard message={message} />}

      {/* Active Buffs */}
      {supplyData.userBuffs.length > 0 && (
        <Card variant="solid" className="p-6 border-[var(--color-success)]/50">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle className="text-[var(--color-success)]">ACTIVE BUFFS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {supplyData.userBuffs.map((buff) => (
                <div
                  key={buff.id}
                  className="p-4 border-2 border-[var(--color-success)]/30 bg-[var(--color-success)]/5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-xs uppercase tracking-wider text-[var(--color-success)]">
                      {buff.category || 'BUFF'}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-muted)]">
                      {buff.remainingMinutes !== null
                        ? `${Math.floor(buff.remainingMinutes / 60)}h ${buff.remainingMinutes % 60}m`
                        : 'PERMANENT'}
                    </span>
                  </div>
                  <p className="font-mono text-sm">{buff.multiplier}x {buff.buffType.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Inventory (Single-Use Items) */}
      {supplyData.userInventory.length > 0 && (
        <Card variant="solid" className="p-6 border-[var(--color-warning)]/50">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle className="text-[var(--color-warning)]">YOUR SUPPLIES</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {supplyData.userInventory.map((item) => (
                <div
                  key={item.consumableId}
                  className="p-4 border-2 border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{item.icon || '📦'}</span>
                    <span className="font-display text-lg text-[var(--color-warning)]">x{item.quantity}</span>
                  </div>
                  <p className="font-display text-xs uppercase tracking-wider line-clamp-2">{item.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duration Buffs Section */}
      {supplyData.catalog.durationBuffs.length > 0 && (
        <Card variant="solid" className="p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle>TEMPORARY BUFFS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {supplyData.catalog.durationBuffs.map((consumable) => (
                <ConsumableCard
                  key={consumable.id}
                  consumable={consumable}
                  userWealth={userWealth}
                  onPurchase={() => handlePurchase(consumable.id, consumable.cost)}
                  isLoading={actionLoading === consumable.id}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single-Use Items Section */}
      {supplyData.catalog.singleUseItems.length > 0 && (
        <Card variant="solid" className="p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle>SINGLE-USE ITEMS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {supplyData.catalog.singleUseItems.map((consumable) => {
                const owned = supplyData.userInventory.find(i => i.consumableId === consumable.id)
                return (
                  <ConsumableCard
                    key={consumable.id}
                    consumable={consumable}
                    userWealth={userWealth}
                    ownedQuantity={owned?.quantity}
                    onPurchase={() => handlePurchase(consumable.id, consumable.cost)}
                    isLoading={actionLoading === consumable.id}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Card variant="default" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>SUPPLY STATS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-3 gap-6">
            <StatValue
              label="TOTAL SPENT"
              value={supplyData.stats.totalSpent}
              prefix="$"
              valueClassName="text-[var(--color-success)]"
            />
            <StatValue
              label="ACTIVE BUFFS"
              value={supplyData.stats.activeBuffCount}
              valueClassName="text-[var(--color-primary)]"
            />
            <StatValue
              label="ITEMS OWNED"
              value={supplyData.stats.inventoryItemCount}
              valueClassName="text-[var(--color-warning)]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// STREAM ACTIONS TAB
// =============================================================================

function StreamActionsTab({
  streamData,
  userWealth,
  setUserWealth,
  onRefresh,
}: {
  streamData: StreamActionsData | null
  userWealth: number
  setUserWealth: (v: number) => void
  onRefresh: () => void
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ttsText, setTtsText] = useState<Record<string, string>>({})

  async function handleTrigger(actionId: string, cost: number, payload?: { text?: string }) {
    if (userWealth < cost) {
      setMessage({ type: 'error', text: `INSUFFICIENT FUNDS - NEED $${cost.toLocaleString()}` })
      return
    }

    setActionLoading(actionId)
    setMessage(null)

    try {
      const res = await fetch('/api/shop/stream-actions/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, payload }),
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: json.data.message.toUpperCase() })
        setUserWealth(userWealth - cost)
        setTtsText(prev => ({ ...prev, [actionId]: '' }))
        await onRefresh()
      } else {
        setMessage({ type: 'error', text: json.error.toUpperCase() })
      }
    } catch {
      setMessage({ type: 'error', text: 'TRIGGER FAILED' })
    } finally {
      setActionLoading(null)
    }
  }

  if (!streamData) {
    return (
      <div className="flex items-center justify-center py-12">
        <InitializingText text="LOADING STREAM CONTROL" className="text-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card
        variant="solid"
        className={cn(
          'p-4 border-2',
          streamData.streamLive && streamData.lumiaOnline
            ? 'border-[var(--color-success)] bg-[var(--color-success)]/5'
            : 'border-[var(--color-destructive)] bg-[var(--color-destructive)]/5'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'w-3 h-3 rounded-full',
                  streamData.streamLive ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-destructive)]'
                )}
              />
              <span className="font-mono text-sm">
                STREAM: {streamData.streamLive ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'w-3 h-3 rounded-full',
                  streamData.lumiaOnline ? 'bg-[var(--color-success)]' : 'bg-[var(--color-destructive)]'
                )}
              />
              <span className="font-mono text-sm">
                LUMIA: {streamData.lumiaOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          {streamData.audioQueue.length > 0 && (
            <div className="font-mono text-sm text-[var(--color-warning)]">
              📢 AUDIO QUEUE: {streamData.audioQueue.length} pending
            </div>
          )}
        </div>
      </Card>

      {/* Message */}
      {message && <MessageCard message={message} />}

      {/* Stream Offline Warning */}
      {!streamData.streamLive && (
        <Card variant="outlined" className="border-[var(--color-warning)] p-6 text-center">
          <p className="font-display text-lg uppercase tracking-wider text-[var(--color-warning)]">
            STREAM IS OFFLINE
          </p>
          <p className="font-mono text-sm text-[var(--color-muted)] mt-2">
            {'// STREAM ACTIONS REQUIRE AN ACTIVE STREAM'}
          </p>
        </Card>
      )}

      {/* Actions by Category */}
      {streamData.categoryOrder.map((category) => {
        const categoryActions = streamData.categories[category]
        if (!categoryActions || categoryActions.length === 0) return null

        return (
          <Card key={category} variant="solid" className="p-6">
            <CardHeader className="p-0 pb-4 border-none">
              <CardTitle>
                <span className="mr-2">{CATEGORY_ICONS[category] || '🎬'}</span>
                {category.toUpperCase()} ACTIONS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryActions.map((action) => {
                  const status = streamData.actionStatus[action.id]
                  return (
                    <StreamActionCard
                      key={action.id}
                      action={action}
                      status={status}
                      userWealth={userWealth}
                      streamLive={streamData.streamLive}
                      lumiaOnline={streamData.lumiaOnline}
                      ttsText={ttsText[action.id] || ''}
                      onTtsTextChange={(text) => setTtsText(prev => ({ ...prev, [action.id]: text }))}
                      onTrigger={(payload) => handleTrigger(action.id, action.cost, payload)}
                      isLoading={actionLoading === action.id}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// =============================================================================
// COMPONENT CARDS
// =============================================================================

function MessageCard({ message }: { message: { type: 'success' | 'error'; text: string } }) {
  return (
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
  )
}

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
      <h3 className="font-display text-sm uppercase tracking-wider mb-3 line-clamp-1">
        {item.itemName}
      </h3>
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

function ConsumableCard({
  consumable,
  userWealth,
  ownedQuantity,
  onPurchase,
  isLoading,
}: {
  consumable: ConsumableType
  userWealth: number
  ownedQuantity?: number
  onPurchase: () => void
  isLoading: boolean
}) {
  const canAfford = userWealth >= consumable.cost
  const atMax = consumable.maxOwned !== null && (ownedQuantity ?? 0) >= consumable.maxOwned

  return (
    <div
      className={cn(
        'p-4 border-2 transition-all duration-150',
        'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5',
        'hover:border-[var(--color-primary)]/60'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{consumable.icon || CATEGORY_ICONS[consumable.category] || '📦'}</span>
        {consumable.durationHours && (
          <span className="font-mono text-xs text-[var(--color-muted)]">
            {consumable.durationHours}h
          </span>
        )}
        {ownedQuantity !== undefined && ownedQuantity > 0 && (
          <span className="font-display text-xs text-[var(--color-warning)]">
            OWNED: {ownedQuantity}{consumable.maxOwned && `/${consumable.maxOwned}`}
          </span>
        )}
      </div>
      <h3 className="font-display text-sm uppercase tracking-wider mb-2">
        {consumable.name}
      </h3>
      {consumable.description && (
        <p className="font-mono text-xs text-[var(--color-muted)] mb-3 line-clamp-2">
          {consumable.description}
        </p>
      )}
      {consumable.buffValue && (
        <p className="font-mono text-sm text-[var(--color-success)] mb-3">
          {consumable.buffValue}x MULTIPLIER
        </p>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-primary)]/20">
        <span
          className={cn(
            'font-mono font-bold',
            canAfford ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'
          )}
        >
          $<KineticNumber value={consumable.cost} />
        </span>
        <Button
          onClick={onPurchase}
          disabled={isLoading || !canAfford || atMax}
          variant={canAfford && !atMax ? 'default' : 'ghost'}
          size="sm"
        >
          {isLoading ? '...' : atMax ? 'MAX' : 'BUY'}
        </Button>
      </div>
    </div>
  )
}

function StreamActionCard({
  action,
  status,
  userWealth,
  streamLive,
  lumiaOnline,
  ttsText,
  onTtsTextChange,
  onTrigger,
  isLoading,
}: {
  action: StreamActionType
  status: ActionAvailability
  userWealth: number
  streamLive: boolean
  lumiaOnline: boolean
  ttsText: string
  onTtsTextChange: (text: string) => void
  onTrigger: (payload?: { text?: string }) => void
  isLoading: boolean
}) {
  const canAfford = userWealth >= action.cost
  const isAvailable = status?.available && streamLive && lumiaOnline
  const isTTS = action.category === 'tts'

  let unavailableReason = ''
  if (!streamLive) {
    unavailableReason = 'STREAM OFFLINE'
  } else if (!lumiaOnline) {
    unavailableReason = 'LUMIA OFFLINE'
  } else if (status?.reason === 'cooldown') {
    unavailableReason = `COOLDOWN: ${status.cooldownRemaining}s`
  } else if (status?.reason === 'limit_reached') {
    unavailableReason = `LIMIT: ${status.usedThisStream}/${status.limitPerStream}`
  } else if (!canAfford) {
    unavailableReason = 'INSUFFICIENT FUNDS'
  }

  function handleTrigger() {
    if (isTTS) {
      if (!ttsText.trim()) return
      onTrigger({ text: ttsText })
    } else {
      onTrigger()
    }
  }

  return (
    <div
      className={cn(
        'p-4 border-2 transition-all duration-150',
        isAvailable && canAfford
          ? 'border-[var(--color-secondary)]/50 bg-[var(--color-secondary)]/5'
          : 'border-[var(--color-muted)]/30 bg-[var(--color-muted)]/5 opacity-60'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{CATEGORY_ICONS[action.category] || '🎬'}</span>
        {action.limitPerStream && status && (
          <span className="font-mono text-xs text-[var(--color-muted)]">
            {status.usedThisStream ?? 0}/{action.limitPerStream}
          </span>
        )}
      </div>
      <h3 className="font-display text-sm uppercase tracking-wider mb-2">
        {action.name}
      </h3>
      {action.description && (
        <p className="font-mono text-xs text-[var(--color-muted)] mb-3 line-clamp-2">
          {action.description}
        </p>
      )}

      {/* TTS Input */}
      {isTTS && (
        <div className="mb-3">
          <input
            type="text"
            value={ttsText}
            onChange={(e) => onTtsTextChange(e.target.value)}
            maxLength={action.maxCharacters ?? 200}
            placeholder="Enter your message..."
            className={cn(
              'w-full px-3 py-2 font-mono text-sm',
              'bg-transparent border-2 border-[var(--color-primary)]/30',
              'focus:border-[var(--color-primary)] focus:outline-none',
              'placeholder:text-[var(--color-muted)]/50'
            )}
            disabled={!isAvailable || !canAfford}
          />
          {action.maxCharacters && (
            <p className="font-mono text-xs text-[var(--color-muted)] mt-1 text-right">
              {ttsText.length}/{action.maxCharacters}
            </p>
          )}
        </div>
      )}

      {/* Unavailable Reason */}
      {unavailableReason && (
        <p className="font-mono text-xs text-[var(--color-destructive)] mb-3">
          {'> '}{unavailableReason}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-current/20">
        <span
          className={cn(
            'font-mono font-bold',
            canAfford ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'
          )}
        >
          $<KineticNumber value={action.cost} />
        </span>
        <Button
          onClick={handleTrigger}
          disabled={isLoading || !isAvailable || !canAfford || (isTTS && !ttsText.trim())}
          variant={isAvailable && canAfford ? 'default' : 'ghost'}
          size="sm"
        >
          {isLoading ? '...' : action.queueBehavior === 'queue' ? 'QUEUE' : 'TRIGGER'}
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

        {item.description && (
          <p className="font-mono text-sm text-[var(--color-foreground)] mb-2">
            {item.description}
          </p>
        )}
        {item.flavor_text && (
          <p className="font-mono text-xs text-[var(--color-muted)] italic mb-4">
            &quot;{item.flavor_text}&quot;
          </p>
        )}

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
