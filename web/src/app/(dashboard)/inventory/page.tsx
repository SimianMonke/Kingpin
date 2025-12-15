'use client'

import { useEffect, useState } from 'react'

interface InventoryItem {
  id: number
  itemId: number
  itemName: string
  itemType: string
  tier: string
  durability: number
  maxDurability: number
  isEquipped: boolean
  slot: string | null
  isEscrowed: boolean
  escrowExpiresAt: string | null
  acquiredAt: string
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
  sellPrice: number | null
  description: string | null
  flavorText: string | null
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

const TIER_COLORS: Record<string, string> = {
  common: 'text-gray-400 border-gray-600',
  uncommon: 'text-green-400 border-green-600',
  rare: 'text-blue-400 border-blue-600',
  legendary: 'text-yellow-400 border-yellow-600',
}

const TIER_BG: Record<string, string> = {
  common: 'bg-gray-500/10',
  uncommon: 'bg-green-500/10',
  rare: 'bg-blue-500/10',
  legendary: 'bg-yellow-500/10',
}

const SLOT_NAMES: Record<string, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  business: 'Business',
  housing: 'Housing',
}

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
        setMessage({ type: 'success', text: json.data.message })
        await fetchInventory()
        setSelectedItem(null)
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to equip item' })
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
        setMessage({ type: 'success', text: json.data.message })
        await fetchInventory()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to unequip item' })
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
        setMessage({ type: 'success', text: json.data.message })
        await fetchInventory()
        setSelectedItem(null)
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to sell item' })
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
        setMessage({ type: 'success', text: 'Item claimed from escrow!' })
        await fetchInventory()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to claim item' })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Failed to load inventory</p>
      </div>
    )
  }

  const unequippedItems = data.inventory.filter(item => !item.isEquipped)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="text-gray-400 mt-1">
          {data.stats.usedSlots}/{data.stats.totalSlots} slots used
          {data.stats.escrowedCount > 0 && ` | ${data.stats.escrowedCount} in escrow`}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Equipped Items */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Equipped</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['weapon', 'armor', 'business', 'housing'] as const).map((slot) => {
            const item = data.equipped[slot]
            return (
              <div key={slot} className="relative">
                <p className="text-xs text-gray-500 mb-2 uppercase">{SLOT_NAMES[slot]}</p>
                {item ? (
                  <div
                    className={`p-4 rounded-lg border-2 ${TIER_COLORS[item.tier]} ${TIER_BG[item.tier]} cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <p className="font-medium truncate">{item.itemName}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      {item.robBonus && <span className="text-red-400">+{item.robBonus}% Rob</span>}
                      {item.defenseBonus && <span className="text-blue-400">+{item.defenseBonus}% Def</span>}
                      {item.insurancePercent && <span className="text-green-400">{item.insurancePercent}% Ins</span>}
                      {item.revenueMin && <span className="text-yellow-400">${item.revenueMin}-{item.revenueMax}</span>}
                    </div>
                    <div className="mt-2">
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-yellow-500"
                          style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.durability}/{item.maxDurability}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnequip(slot)
                      }}
                      disabled={actionLoading === `unequip-${slot}`}
                      className="mt-2 w-full py-1 px-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
                    >
                      {actionLoading === `unequip-${slot}` ? 'Unequipping...' : 'Unequip'}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border-2 border-dashed border-gray-700 bg-gray-800/30 text-center">
                    <p className="text-gray-500 text-sm">Empty</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Unequipped Items */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Items ({unequippedItems.length})</h2>
        {unequippedItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No items in inventory. Visit the shop to buy some!</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {unequippedItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${TIER_COLORS[item.tier]} ${TIER_BG[item.tier]} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setSelectedItem(item)}
              >
                <p className="text-xs uppercase opacity-70">{item.tier}</p>
                <p className="font-medium truncate mt-1">{item.itemName}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{item.itemType}</p>
                <div className="mt-2">
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-yellow-500"
                      style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Escrowed Items */}
      {data.escrowed.length > 0 && (
        <div className="bg-gray-800/50 border border-orange-500/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2 text-orange-400">Escrow</h2>
          <p className="text-sm text-gray-400 mb-4">Claim these items before they expire!</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.escrowed.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${TIER_COLORS[item.tier]} ${TIER_BG[item.tier]}`}
              >
                <p className="text-xs uppercase opacity-70">{item.tier}</p>
                <p className="font-medium truncate mt-1">{item.itemName}</p>
                {item.escrowExpiresAt && (
                  <p className="text-xs text-orange-400 mt-2">
                    Expires: {new Date(item.escrowExpiresAt).toLocaleString()}
                  </p>
                )}
                <button
                  onClick={() => handleClaim(item.id)}
                  disabled={actionLoading === `claim-${item.id}` || data.stats.availableSlots === 0}
                  className="mt-2 w-full py-1 px-2 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors disabled:opacity-50"
                >
                  {actionLoading === `claim-${item.id}` ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className={`bg-gray-900 border ${TIER_COLORS[selectedItem.tier]} rounded-xl p-6 max-w-md w-full`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className={`text-xs uppercase ${TIER_COLORS[selectedItem.tier].split(' ')[0]}`}>
                  {selectedItem.tier} {selectedItem.itemType}
                </p>
                <h3 className="text-xl font-bold mt-1">{selectedItem.itemName}</h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-white">
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            {selectedItem.description && (
              <p className="text-gray-300 text-sm mb-2">{selectedItem.description}</p>
            )}
            {selectedItem.flavorText && (
              <p className="text-gray-500 text-sm italic mb-4">"{selectedItem.flavorText}"</p>
            )}

            <div className="space-y-2 text-sm mb-4">
              {selectedItem.robBonus && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Rob Bonus</span>
                  <span className="text-red-400">+{selectedItem.robBonus}%</span>
                </div>
              )}
              {selectedItem.defenseBonus && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Defense Bonus</span>
                  <span className="text-blue-400">+{selectedItem.defenseBonus}%</span>
                </div>
              )}
              {selectedItem.insurancePercent && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Insurance</span>
                  <span className="text-green-400">{selectedItem.insurancePercent}%</span>
                </div>
              )}
              {selectedItem.revenueMin && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Revenue</span>
                  <span className="text-yellow-400">${selectedItem.revenueMin}-{selectedItem.revenueMax}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Durability</span>
                <span>{selectedItem.durability}/{selectedItem.maxDurability}</span>
              </div>
              {selectedItem.sellPrice && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Sell Price</span>
                  <span className="text-green-400">${selectedItem.sellPrice.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!selectedItem.isEquipped && (
                <>
                  <button
                    onClick={() => handleEquip(selectedItem.id)}
                    disabled={actionLoading === `equip-${selectedItem.id}`}
                    className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading === `equip-${selectedItem.id}` ? 'Equipping...' : 'Equip'}
                  </button>
                  <button
                    onClick={() => handleSell(selectedItem.id)}
                    disabled={actionLoading === `sell-${selectedItem.id}`}
                    className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading === `sell-${selectedItem.id}` ? 'Selling...' : `Sell ($${selectedItem.sellPrice?.toLocaleString() ?? 0})`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
