'use client'

import { useEffect, useState } from 'react'

interface BlackMarketItem {
  marketId: number
  itemId: number
  itemName: string
  itemType: string
  tier: string
  price: number
  originalPrice: number
  discountPercent: number
  stockQuantity: number
  originalStock: number
  isFeatured: boolean
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
  description: string | null
  flavorText: string | null
}

interface MarketData {
  items: BlackMarketItem[]
  rotationId: number
  availableFrom: string
  availableUntil: string
  timeRemaining: string
  featuredItem: BlackMarketItem | null
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

export default function BlackMarketPage() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [userWealth, setUserWealth] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedItem, setSelectedItem] = useState<BlackMarketItem | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  // Update countdown timer
  useEffect(() => {
    if (!marketData?.availableUntil) return

    const interval = setInterval(() => {
      const now = new Date()
      const end = new Date(marketData.availableUntil)
      const diff = end.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining('Rotating...')
        fetchData() // Refresh when rotation happens
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [marketData?.availableUntil])

  async function fetchData() {
    try {
      const [marketRes, userRes] = await Promise.all([
        fetch('/api/market'),
        fetch('/api/users/me'),
      ])

      if (marketRes.ok) {
        const json = await marketRes.json()
        setMarketData(json.data)
      }

      if (userRes.ok) {
        const json = await userRes.json()
        setUserWealth(Number(json.data.wealth))
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuy(marketId: number, itemName: string, price: number) {
    if (userWealth < price) {
      setMessage({ type: 'error', text: `Not enough wealth! You need $${price.toLocaleString()}` })
      return
    }

    setActionLoading(`buy-${marketId}`)
    setMessage(null)

    try {
      const res = await fetch('/api/market/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!marketData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Black Market is currently unavailable</p>
      </div>
    )
  }

  const regularItems = marketData.items.filter((item) => !item.isFeatured)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-500">Black Market</h1>
          <p className="text-gray-400 mt-1">Exclusive deals. Limited stock. No questions.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-gray-400">Next Rotation</p>
            <p className="text-lg font-mono text-red-400">{timeRemaining || marketData.timeRemaining}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Your Wealth</p>
            <p className="text-xl font-bold text-yellow-400">${userWealth.toLocaleString()}</p>
          </div>
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

      {/* Featured Item */}
      {marketData.featuredItem && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <StarIcon className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-yellow-400">Featured Deal</h2>
            {marketData.featuredItem.discountPercent > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                -{marketData.featuredItem.discountPercent}% OFF
              </span>
            )}
          </div>
          <div
            className={`p-6 rounded-lg border-2 ${TIER_COLORS[marketData.featuredItem.tier]} ${TIER_BG[marketData.featuredItem.tier]} cursor-pointer hover:scale-[1.02] transition-transform`}
            onClick={() => setSelectedItem(marketData.featuredItem!)}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className={`text-xs uppercase ${TIER_COLORS[marketData.featuredItem.tier].split(' ')[0]}`}>
                  {marketData.featuredItem.tier} {marketData.featuredItem.itemType}
                </p>
                <h3 className="text-2xl font-bold mt-1">{marketData.featuredItem.itemName}</h3>
                {marketData.featuredItem.description && (
                  <p className="text-gray-400 text-sm mt-2">{marketData.featuredItem.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {marketData.featuredItem.robBonus && (
                    <span className="text-red-400">+{marketData.featuredItem.robBonus}% Rob</span>
                  )}
                  {marketData.featuredItem.defenseBonus && (
                    <span className="text-blue-400">+{marketData.featuredItem.defenseBonus}% Def</span>
                  )}
                  {marketData.featuredItem.insurancePercent && (
                    <span className="text-green-400">{marketData.featuredItem.insurancePercent}% Insurance</span>
                  )}
                  {marketData.featuredItem.revenueMin && (
                    <span className="text-yellow-400">${marketData.featuredItem.revenueMin}-{marketData.featuredItem.revenueMax}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="mb-2">
                  {marketData.featuredItem.discountPercent > 0 && (
                    <p className="text-sm text-gray-500 line-through">
                      ${marketData.featuredItem.originalPrice.toLocaleString()}
                    </p>
                  )}
                  <p className={`text-2xl font-bold ${userWealth >= marketData.featuredItem.price ? 'text-green-400' : 'text-red-400'}`}>
                    ${marketData.featuredItem.price.toLocaleString()}
                  </p>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  {marketData.featuredItem.stockQuantity}/{marketData.featuredItem.originalStock} left
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBuy(marketData.featuredItem!.marketId, marketData.featuredItem!.itemName, marketData.featuredItem!.price)
                  }}
                  disabled={actionLoading === `buy-${marketData.featuredItem.marketId}` || userWealth < marketData.featuredItem.price || marketData.featuredItem.stockQuantity === 0}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    userWealth >= marketData.featuredItem.price && marketData.featuredItem.stockQuantity > 0
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                      : 'bg-gray-700 cursor-not-allowed opacity-50'
                  }`}
                >
                  {actionLoading === `buy-${marketData.featuredItem.marketId}`
                    ? 'Buying...'
                    : marketData.featuredItem.stockQuantity === 0
                    ? 'Sold Out'
                    : 'Buy Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regular Items */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Available Items ({regularItems.length})</h2>
        {regularItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">All items sold out. Check back next rotation!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {regularItems.map((item) => (
              <div
                key={item.marketId}
                className={`p-4 rounded-lg border ${TIER_COLORS[item.tier]} ${TIER_BG[item.tier]} cursor-pointer hover:scale-105 transition-transform ${
                  item.stockQuantity === 0 ? 'opacity-50' : ''
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className={`text-xs uppercase ${TIER_COLORS[item.tier].split(' ')[0]}`}>{item.tier}</p>
                  <p className="text-xs text-gray-400">{item.stockQuantity}/{item.originalStock}</p>
                </div>
                <p className="font-semibold mb-1">{item.itemName}</p>
                <p className="text-xs text-gray-400 capitalize mb-3">{item.itemType}</p>
                <div className="space-y-1 text-xs mb-3">
                  {item.robBonus && <p className="text-red-400">+{item.robBonus}% Rob</p>}
                  {item.defenseBonus && <p className="text-blue-400">+{item.defenseBonus}% Def</p>}
                  {item.insurancePercent && <p className="text-green-400">{item.insurancePercent}% Ins</p>}
                  {item.revenueMin && <p className="text-yellow-400">${item.revenueMin}-{item.revenueMax}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <p className={`font-bold ${userWealth >= item.price ? 'text-green-400' : 'text-red-400'}`}>
                    ${item.price.toLocaleString()}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBuy(item.marketId, item.itemName, item.price)
                    }}
                    disabled={actionLoading === `buy-${item.marketId}` || userWealth < item.price || item.stockQuantity === 0}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      userWealth >= item.price && item.stockQuantity > 0
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-gray-700 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {actionLoading === `buy-${item.marketId}` ? '...' : item.stockQuantity === 0 ? 'Sold' : 'Buy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                <div className="flex items-center gap-2">
                  <p className={`text-xs uppercase ${TIER_COLORS[selectedItem.tier].split(' ')[0]}`}>
                    {selectedItem.tier} {selectedItem.itemType}
                  </p>
                  {selectedItem.isFeatured && selectedItem.discountPercent > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                      -{selectedItem.discountPercent}%
                    </span>
                  )}
                </div>
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
                <span className="text-gray-400">Stock</span>
                <span className={selectedItem.stockQuantity === 0 ? 'text-red-400' : ''}>
                  {selectedItem.stockQuantity}/{selectedItem.originalStock}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Price</span>
                <div className="text-right">
                  {selectedItem.discountPercent > 0 && (
                    <p className="text-sm text-gray-500 line-through">
                      ${selectedItem.originalPrice.toLocaleString()}
                    </p>
                  )}
                  <span className={`text-xl font-bold ${userWealth >= selectedItem.price ? 'text-green-400' : 'text-red-400'}`}>
                    ${selectedItem.price.toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBuy(selectedItem.marketId, selectedItem.itemName, selectedItem.price)}
                disabled={actionLoading === `buy-${selectedItem.marketId}` || userWealth < selectedItem.price || selectedItem.stockQuantity === 0}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  userWealth >= selectedItem.price && selectedItem.stockQuantity > 0
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-gray-700 cursor-not-allowed'
                }`}
              >
                {actionLoading === `buy-${selectedItem.marketId}`
                  ? 'Purchasing...'
                  : selectedItem.stockQuantity === 0
                  ? 'Sold Out'
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
