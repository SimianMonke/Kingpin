'use client'

import { useEffect, useState } from 'react'

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

interface UserWealth {
  wealth: string
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

  async function handleBuy(shopItemId: number, itemName: string, price: number) {
    if (userWealth < price) {
      setMessage({ type: 'error', text: `Not enough wealth! You need $${price.toLocaleString()}` })
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
        setMessage({ type: 'success', text: json.data.message })
        setUserWealth(Number(json.data.newWealth))
        setSelectedItem(null)
        await fetchData()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to purchase item' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReroll() {
    setActionLoading('reroll')
    setMessage(null)

    try {
      const res = await fetch('/api/users/me/shop/reroll', {
        method: 'POST',
      })

      const json = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: json.data.message })
        await fetchData()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to refresh shop' })
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

  if (!shopData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Failed to load shop</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Shop</h1>
          <p className="text-gray-400 mt-1">
            Personal inventory based on your <span className="text-purple-400">{shopData.playerTier}</span> rank
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Your Wealth</p>
            <p className="text-xl font-bold text-yellow-400">${userWealth.toLocaleString()}</p>
          </div>
          <button
            onClick={handleReroll}
            disabled={actionLoading === 'reroll'}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'reroll' ? 'Refreshing...' : 'Refresh Shop'}
          </button>
        </div>
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

      {/* Accessible Tiers Info */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <p className="text-sm text-gray-400">
          As a <span className="text-purple-400 font-medium">{shopData.playerTier}</span>, you have access to:
          {' '}
          {shopData.accessibleTiers.map((tier, i) => (
            <span key={tier}>
              <span className={TIER_COLORS[tier].split(' ')[0]}>{tier}</span>
              {i < shopData.accessibleTiers.length - 1 && ', '}
            </span>
          ))}
          {' '}items
        </p>
      </div>

      {/* Shop Items */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Available Items ({shopData.items.length})</h2>
        {shopData.items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No items available. Try refreshing the shop!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shopData.items.map((item) => (
              <div
                key={item.shopItemId}
                className={`p-4 rounded-lg border ${TIER_COLORS[item.tier]} ${TIER_BG[item.tier]} cursor-pointer hover:scale-105 transition-transform`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className={`text-xs uppercase ${TIER_COLORS[item.tier].split(' ')[0]}`}>{item.tier}</p>
                  <p className="text-xs text-gray-400 capitalize">{item.type}</p>
                </div>
                <p className="font-semibold mb-2">{item.itemName}</p>
                <div className="space-y-1 text-xs mb-3">
                  {item.rob_bonus && <p className="text-red-400">+{item.rob_bonus}% Rob Bonus</p>}
                  {item.defense_bonus && <p className="text-blue-400">+{item.defense_bonus}% Defense</p>}
                  {item.insurance_percent && <p className="text-green-400">{item.insurance_percent}% Insurance</p>}
                  {item.revenue_min && <p className="text-yellow-400">${item.revenue_min}-{item.revenue_max} Revenue</p>}
                </div>
                <div className="flex items-center justify-between">
                  <p className={`font-bold ${userWealth >= item.price ? 'text-green-400' : 'text-red-400'}`}>
                    ${item.price.toLocaleString()}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBuy(item.shopItemId, item.itemName, item.price)
                    }}
                    disabled={actionLoading === `buy-${item.shopItemId}` || userWealth < item.price}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      userWealth >= item.price
                        ? 'bg-purple-500 hover:bg-purple-600'
                        : 'bg-gray-700 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {actionLoading === `buy-${item.shopItemId}` ? '...' : 'Buy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shop Stats */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Your Shopping History</h2>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-purple-400">{shopData.stats.totalPurchases}</p>
            <p className="text-sm text-gray-400">Total Purchases</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">${shopData.stats.totalSpent.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Total Spent</p>
          </div>
        </div>
      </div>

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
                  {selectedItem.tier} {selectedItem.type}
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
            {selectedItem.flavor_text && (
              <p className="text-gray-500 text-sm italic mb-4">"{selectedItem.flavor_text}"</p>
            )}

            <div className="space-y-2 text-sm mb-4">
              {selectedItem.rob_bonus && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Rob Bonus</span>
                  <span className="text-red-400">+{selectedItem.rob_bonus}%</span>
                </div>
              )}
              {selectedItem.defense_bonus && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Defense Bonus</span>
                  <span className="text-blue-400">+{selectedItem.defense_bonus}%</span>
                </div>
              )}
              {selectedItem.insurance_percent && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Insurance</span>
                  <span className="text-green-400">{selectedItem.insurance_percent}%</span>
                </div>
              )}
              {selectedItem.revenue_min && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Revenue</span>
                  <span className="text-yellow-400">${selectedItem.revenue_min}-{selectedItem.revenue_max}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Price</span>
                <span className={`text-xl font-bold ${userWealth >= selectedItem.price ? 'text-green-400' : 'text-red-400'}`}>
                  ${selectedItem.price.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => handleBuy(selectedItem.shopItemId, selectedItem.itemName, selectedItem.price)}
                disabled={actionLoading === `buy-${selectedItem.shopItemId}` || userWealth < selectedItem.price}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  userWealth >= selectedItem.price
                    ? 'bg-purple-500 hover:bg-purple-600'
                    : 'bg-gray-700 cursor-not-allowed'
                }`}
              >
                {actionLoading === `buy-${selectedItem.shopItemId}`
                  ? 'Purchasing...'
                  : userWealth >= selectedItem.price
                  ? 'Purchase'
                  : `Need $${(selectedItem.price - userWealth).toLocaleString()} more`}
              </button>
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
