'use client'

import { useEffect, useState } from 'react'

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

const TIER_GLOW: Record<string, string> = {
  common: '',
  uncommon: 'shadow-green-500/20',
  rare: 'shadow-blue-500/30',
  legendary: 'shadow-yellow-500/50 shadow-lg',
}

const DROP_TYPE_ICONS: Record<string, string> = {
  weapon: '/icons/weapon.png',
  armor: '/icons/armor.png',
  wealth: '/icons/wealth.png',
  title: '/icons/title.png',
}

const TIER_ORDER = ['legendary', 'rare', 'uncommon', 'common']

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
        // Show animation
        setIsAnimating(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        setIsAnimating(false)
        setOpenResult(json.data)
        await fetchCrates()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to open crate' })
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

        // Build summary message
        let summary = `Opened ${stats.opened} crate${stats.opened !== 1 ? 's' : ''}!`
        if (stats.stoppedEarly) {
          summary += ` (Stopped: ${stats.stopReason})`
        }

        setMessage({ type: 'success', text: summary })

        // Show last result if any
        if (results.length > 0) {
          setOpenResult(results[results.length - 1])
        }

        await fetchCrates()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to open crates' })
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
        setMessage({ type: 'success', text: 'Crate claimed from escrow!' })
        await fetchCrates()
      } else {
        setMessage({ type: 'error', text: json.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to claim crate' })
    } finally {
      setActionLoading(null)
    }
  }

  function formatTimeRemaining(expires_at: string): string {
    const diff = new Date(expires_at).getTime() - Date.now()
    if (diff <= 0) return 'Expired'

    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
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
        <p className="text-gray-400">Failed to load crates</p>
      </div>
    )
  }

  const regularCrates = data.crates.filter(c => !c.is_escrowed)
  const escrowedCrates = data.crates.filter(c => c.is_escrowed)

  // Group crates by tier
  const cratesByTier: Record<string, CrateInfo[]> = {}
  for (const tier of TIER_ORDER) {
    const tierCrates = regularCrates.filter(c => c.tier === tier)
    if (tierCrates.length > 0) {
      cratesByTier[tier] = tierCrates
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Crates</h1>
          <p className="text-gray-400 mt-1">
            {data.stats.total}/{data.stats.maxCrates} crates
            {data.stats.escrowedCount > 0 && ` | ${data.stats.escrowedCount} in escrow`}
          </p>
        </div>
        {data.stats.total > 1 && data.canOpen && (
          <button
            onClick={handleOpenAll}
            disabled={actionLoading === 'open-all'}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {actionLoading === 'open-all' ? 'Opening...' : `Open All (${Math.min(data.stats.total, 10)})`}
          </button>
        )}
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

      {/* Cannot Open Warning */}
      {!data.canOpen && data.canOpenReason && data.stats.total > 0 && (
        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
          {data.canOpenReason}
        </div>
      )}

      {/* Crates by Tier */}
      {data.stats.total === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-semibold mb-2">No Crates</h2>
          <p className="text-gray-400">
            Earn crates by playing, completing missions, or reaching check-in milestones!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIER_ORDER.map(tier => {
            const count = data.stats.byTier[tier] || 0
            if (count === 0) return null

            const tierCrates = cratesByTier[tier] || []
            const firstCrate = tierCrates[0]

            return (
              <div
                key={tier}
                className={`relative p-6 rounded-xl border-2 ${TIER_COLORS[tier]} ${TIER_BG[tier]} ${TIER_GLOW[tier]} transition-all hover:scale-[1.02]`}
              >
                {/* Tier Badge */}
                <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase ${TIER_BG[tier]} border ${TIER_COLORS[tier]}`}>
                  {tier}
                </div>

                {/* Crate Visual */}
                <div className="flex flex-col items-center py-8">
                  <div className="text-6xl mb-2">📦</div>
                  <div className="text-3xl font-bold">x{count}</div>
                </div>

                {/* Drop Chances */}
                <div className="text-xs text-gray-400 space-y-1 mb-4">
                  {tier === 'common' && (
                    <>
                      <p>40% Weapon | 40% Armor</p>
                      <p>20% Wealth</p>
                    </>
                  )}
                  {tier === 'uncommon' && (
                    <>
                      <p>38% Weapon | 38% Armor</p>
                      <p>22% Wealth | 2% Title</p>
                    </>
                  )}
                  {tier === 'rare' && (
                    <>
                      <p>35% Weapon | 35% Armor</p>
                      <p>25% Wealth | 5% Title</p>
                    </>
                  )}
                  {tier === 'legendary' && (
                    <>
                      <p>30% Weapon | 30% Armor</p>
                      <p>30% Wealth | 10% Title</p>
                    </>
                  )}
                </div>

                {/* Open Button */}
                <button
                  onClick={() => handleOpenCrate(firstCrate?.id, tier)}
                  disabled={!data.canOpen || actionLoading === `open-${tier}` || actionLoading === `open-${firstCrate?.id}`}
                  className={`w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                    tier === 'legendary'
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
                      : tier === 'rare'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                      : tier === 'uncommon'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                >
                  {actionLoading?.startsWith('open-') ? 'Opening...' : 'Open'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Escrowed Crates */}
      {escrowedCrates.length > 0 && (
        <div className="bg-gray-800/50 border border-orange-500/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2 text-orange-400">
            Escrow ({escrowedCrates.length}/{data.stats.maxEscrow})
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Claim these crates before they expire! Escrow expires in 1 hour.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {escrowedCrates.map(crate => (
              <div
                key={crate.id}
                className={`p-4 rounded-lg border ${TIER_COLORS[crate.tier]} ${TIER_BG[crate.tier]}`}
              >
                <p className="text-xs uppercase opacity-70">{crate.tier}</p>
                <div className="text-3xl my-2">📦</div>
                {crate.escrow_expires_at && (
                  <p className="text-xs text-orange-400 mb-2">
                    {formatTimeRemaining(crate.escrow_expires_at)}
                  </p>
                )}
                <button
                  onClick={() => handleClaim(crate.id)}
                  disabled={actionLoading === `claim-${crate.id}` || data.stats.total >= data.stats.maxCrates}
                  className="w-full py-1 px-2 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors disabled:opacity-50"
                >
                  {actionLoading === `claim-${crate.id}` ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opening Animation Overlay */}
      {isAnimating && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center animate-pulse">
            <div className="text-8xl mb-4 animate-bounce">📦</div>
            <p className="text-2xl font-bold">Opening...</p>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {openResult && !isAnimating && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setOpenResult(null)}
        >
          <div
            className={`bg-gray-900 border-2 rounded-xl p-8 max-w-md w-full text-center ${
              TIER_COLORS[openResult.crate_tier]
            } ${TIER_GLOW[openResult.crate_tier]}`}
            onClick={e => e.stopPropagation()}
          >
            <p className={`text-sm uppercase font-bold ${TIER_COLORS[openResult.crate_tier].split(' ')[0]} mb-2`}>
              {openResult.crate_tier} Crate
            </p>

            {/* Reward Display */}
            <div className="my-8">
              {openResult.reward.item && (
                <>
                  <div className="text-6xl mb-4">
                    {openResult.drop_type === 'weapon' ? '⚔️' : '🛡️'}
                  </div>
                  <h3 className={`text-2xl font-bold ${TIER_COLORS[openResult.reward.item.tier].split(' ')[0]}`}>
                    {openResult.reward.item.name}
                  </h3>
                  <p className="text-gray-400 capitalize">{openResult.reward.item.tier} {openResult.reward.item.type}</p>
                  {openResult.reward.item.toEscrow && (
                    <p className="text-orange-400 text-sm mt-2">Sent to item escrow (inventory full)</p>
                  )}
                </>
              )}

              {openResult.reward.wealth && (
                <>
                  <div className="text-6xl mb-4">💰</div>
                  <h3 className="text-2xl font-bold text-green-400">
                    ${openResult.reward.wealth.amount.toLocaleString()}
                  </h3>
                  <p className="text-gray-400">Wealth Gained</p>
                </>
              )}

              {openResult.reward.title && (
                <>
                  <div className="text-6xl mb-4">👑</div>
                  {openResult.reward.title.isDuplicate ? (
                    <>
                      <h3 className="text-xl font-bold text-gray-400 line-through mb-2">
                        [{openResult.reward.title.title}]
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">Already owned!</p>
                      <h3 className="text-2xl font-bold text-green-400">
                        ${openResult.reward.title.duplicateValue?.toLocaleString()}
                      </h3>
                      <p className="text-gray-400">Converted to wealth</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold text-purple-400">
                        [{openResult.reward.title.title}]
                      </h3>
                      <p className="text-gray-400">New Title Unlocked!</p>
                    </>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setOpenResult(null)}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
