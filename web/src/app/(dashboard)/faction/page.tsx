'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

// =============================================================================
// TYPES
// =============================================================================

interface FactionBuff {
  type: string
  value: number
  territoryName: string
}

interface FactionTerritory {
  id: number
  name: string
  buff_type: string | null
  buff_value: number | null
  isStarting: boolean
}

interface FactionDetails {
  id: number
  name: string
  description: string | null
  motto: string | null
  color_hex: string | null
  memberCount: number
  territories_controlled: number
  territories: FactionTerritory[]
  buffs: FactionBuff[]
}

interface FactionSummary {
  id: number
  name: string
  description: string | null
  motto: string | null
  color_hex: string | null
  memberCount: number
  territories_controlled: number
  weeklyScore?: number
  rank?: number
}

interface TerritoryScore {
  faction_id: number
  faction_name: string
  color_hex: string | null
  score: number
}

interface TerritoryStatus {
  id: number
  name: string
  description: string | null
  buff_type: string | null
  buff_value: number | null
  is_contested: boolean
  factions: {
    id: number
    name: string
    color_hex: string | null
  } | null
  startingFaction: {
    id: number
    name: string
  } | null
  scores: TerritoryScore[]
}

interface UserFactionData {
  inFaction: boolean
  faction: FactionDetails | null
  membership: {
    joinedAt: string | null
    cooldownUntil: string | null
    rewardCooldownUntil: string | null
    canJoin: boolean
    canEarnRewards?: boolean
  }
  assignedTerritory: TerritoryStatus | null
  rank: {
    rank: number
    total_members: number
    weeklyScore: number
  } | null
}

// =============================================================================
// CONSTANTS
// =============================================================================

const FACTION_COLORS: Record<string, string> = {
  '#DC143C': 'border-red-500 bg-red-500/10 text-red-400',
  '#00CED1': 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
  '#808000': 'border-yellow-600 bg-yellow-600/10 text-yellow-500',
}

const BUFF_ICONS: Record<string, string> = {
  xp: '📈',
  wealth: '💰',
  rob_success: '🎯',
  defense: '🛡️',
  crate_drop: '📦',
  shop_discount: '🏷️',
  business_revenue: '🏢',
  all_rewards: '⭐',
}

const BUFF_LABELS: Record<string, string> = {
  xp: 'XP Bonus',
  wealth: 'Wealth Bonus',
  rob_success: 'Rob Success',
  defense: 'Defense',
  crate_drop: 'Crate Drop Rate',
  shop_discount: 'Shop Discount',
  business_revenue: 'Business Revenue',
  all_rewards: 'All Rewards',
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function FactionPage() {
  const { data: session } = useSession()
  const [userFaction, setUserFaction] = useState<UserFactionData | null>(null)
  const [allFactions, setAllFactions] = useState<FactionSummary[]>([])
  const [territories, setTerritories] = useState<TerritoryStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = async () => {
    try {
      const [userRes, factionsRes, territoriesRes] = await Promise.all([
        fetch('/api/factions/my-faction'),
        fetch('/api/factions'),
        fetch('/api/factions/territories'),
      ])

      if (userRes.ok) {
        const data = await userRes.json()
        setUserFaction(data.data)
      }

      if (factionsRes.ok) {
        const data = await factionsRes.json()
        setAllFactions(data.data.factions)
      }

      if (territoriesRes.ok) {
        const data = await territoriesRes.json()
        setTerritories(data.data.territories)
      }
    } catch (error) {
      console.error('Failed to fetch faction data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleJoin = async (faction_name: string) => {
    setJoining(faction_name)
    setMessage(null)

    try {
      const res = await fetch('/api/factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faction_name }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `Welcome to ${data.data.factions.name}!` })
        await fetchData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to join faction' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to join faction' })
    } finally {
      setJoining(null)
    }
  }

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave your faction? You will have a 7-day cooldown before joining another.')) {
      return
    }

    setLeaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/factions/leave', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'You have left your faction.' })
        await fetchData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to leave faction' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to leave faction' })
    } finally {
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          <span className="text-gradient">Factions & Territories</span>
        </h1>
        <p className="text-gray-400 mt-1">
          Join a faction and compete for territory control
        </p>
      </div>

      {/* Message Toast */}
      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'bg-red-500/20 border-red-500/50 text-red-400'
          }`}
        >
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-4 text-sm opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Faction Status */}
      {userFaction?.inFaction && userFaction.faction ? (
        <CurrentFactionCard
          faction={userFaction.faction}
          membership={userFaction.membership}
          assignedTerritory={userFaction.assignedTerritory}
          rank={userFaction.rank}
          onLeave={handleLeave}
          leaving={leaving}
        />
      ) : (
        <FactionSelector
          factions={allFactions}
          canJoin={userFaction?.membership.canJoin ?? true}
          cooldownUntil={userFaction?.membership.cooldownUntil ?? null}
          onJoin={handleJoin}
          joining={joining}
        />
      )}

      {/* Territory Map */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Territory Map</h2>
          <p className="text-sm text-gray-400">12 territories across Lazarus City</p>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {territories.map((territory) => (
            <TerritoryCard key={territory.id} territory={territory} />
          ))}
        </div>
      </div>

      {/* Faction Standings */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Faction Standings</h2>
          <p className="text-sm text-gray-400">This week's competition</p>
        </div>
        <div className="divide-y divide-gray-700">
          {allFactions
            .sort((a, b) => (b.territories_controlled - a.territories_controlled))
            .map((faction, index) => (
              <FactionStandingRow key={faction.id} faction={faction} rank={index + 1} />
            ))}
        </div>
      </div>

      {/* How Factions Work */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">How Factions Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <span className="text-purple-400">1.</span>
            <p>Join a faction at level 20+ (Associate tier)</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">2.</span>
            <p>Your activities (!play, !rob, !checkin, missions) earn territory points</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">3.</span>
            <p>Factions compete for territory control based on daily scores</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">4.</span>
            <p>Controlled territories grant buffs to ALL faction members</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">5.</span>
            <p>Weekly rewards distributed based on territories held</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">6.</span>
            <p>7-day cooldown when switching factions</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function CurrentFactionCard({
  faction,
  membership,
  assignedTerritory,
  rank,
  onLeave,
  leaving,
}: {
  faction: FactionDetails
  membership: UserFactionData['membership']
  assignedTerritory: TerritoryStatus | null
  rank: UserFactionData['rank']
  onLeave: () => void
  leaving: boolean
}) {
  const colorClass = FACTION_COLORS[faction.color_hex ?? ''] || 'border-gray-500 bg-gray-500/10'

  return (
    <div className={`border rounded-xl overflow-hidden ${colorClass}`}>
      {/* Faction Header */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{faction.name}</h2>
            {faction.motto && (
              <p className="text-sm opacity-70 italic mt-1">"{faction.motto}"</p>
            )}
            {faction.description && (
              <p className="text-gray-400 mt-2">{faction.description}</p>
            )}
          </div>
          <button
            onClick={onLeave}
            disabled={leaving}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg border border-red-500/30 transition-colors disabled:opacity-50"
          >
            {leaving ? 'Leaving...' : 'Leave'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-2xl font-bold">{faction.memberCount}</div>
            <div className="text-xs text-gray-400">Members</div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-2xl font-bold">{faction.territories_controlled}</div>
            <div className="text-xs text-gray-400">Territories</div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-2xl font-bold">#{rank?.rank ?? '-'}</div>
            <div className="text-xs text-gray-400">Your Rank</div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-2xl font-bold">{rank?.weeklyScore ?? 0}</div>
            <div className="text-xs text-gray-400">Your Points</div>
          </div>
        </div>

        {/* Reward Cooldown Warning */}
        {membership.rewardCooldownUntil && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
            Reward cooldown active until{' '}
            {new Date(membership.rewardCooldownUntil).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Active Buffs */}
      {faction.buffs.length > 0 && (
        <div className="p-4 bg-black/20 border-t border-white/10">
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Active Buffs</h3>
          <div className="flex flex-wrap gap-2">
            {faction.buffs.map((buff, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-sm"
              >
                <span>{BUFF_ICONS[buff.type] ?? '✨'}</span>
                <span>+{buff.value}% {BUFF_LABELS[buff.type] ?? buff.type}</span>
                <span className="text-xs text-gray-500">({buff.territoryName})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Territory */}
      {assignedTerritory && (
        <div className="p-4 bg-black/30 border-t border-white/10">
          <h3 className="text-sm font-semibold mb-2 text-gray-300">Your Assigned Territory</h3>
          <div className="flex items-center gap-3">
            <span className="text-xl">📍</span>
            <div>
              <div className="font-semibold">{assignedTerritory.name}</div>
              <div className="text-xs text-gray-400">{assignedTerritory.description}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FactionSelector({
  factions,
  canJoin,
  cooldownUntil,
  onJoin,
  joining,
}: {
  factions: FactionSummary[]
  canJoin: boolean
  cooldownUntil: string | null
  onJoin: (name: string) => void
  joining: string | null
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Choose Your Faction</h2>
        <p className="text-sm text-gray-400">
          {canJoin
            ? 'Join a faction to start earning territory rewards'
            : `Cooldown active until ${cooldownUntil ? new Date(cooldownUntil).toLocaleDateString() : 'soon'}`}
        </p>
      </div>

      {!canJoin && (
        <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400 text-sm">
          You must wait for your cooldown to expire before joining a faction.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {factions.map((faction) => {
          const colorClass = FACTION_COLORS[faction.color_hex ?? ''] || 'border-gray-600'
          return (
            <div
              key={faction.id}
              className={`border rounded-xl p-4 ${colorClass} transition-all ${
                canJoin ? 'hover:scale-[1.02] cursor-pointer' : 'opacity-50'
              }`}
            >
              <h3 className="text-lg font-bold">{faction.name}</h3>
              {faction.motto && (
                <p className="text-xs italic opacity-70 mb-2">"{faction.motto}"</p>
              )}
              {faction.description && (
                <p className="text-sm text-gray-400 mb-4">{faction.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm mb-4">
                <span>👥 {faction.memberCount}</span>
                <span>🏴 {faction.territories_controlled}</span>
              </div>
              <button
                onClick={() => canJoin && onJoin(faction.name)}
                disabled={!canJoin || joining !== null}
                className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                  canJoin
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {joining === faction.name ? 'Joining...' : 'Join Faction'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TerritoryCard({ territory }: { territory: TerritoryStatus }) {
  const controllingColor = territory.factions?.color_hex
    ? FACTION_COLORS[territory.factions.color_hex]
    : 'border-gray-600 bg-gray-600/10'

  // Get leading faction from scores
  const sortedScores = [...territory.scores].sort((a, b) => b.score - a.score)
  const leadingFaction = sortedScores[0]
  const totalScore = sortedScores.reduce((sum, s) => sum + s.score, 0)

  return (
    <div className={`border rounded-lg p-4 ${controllingColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold">{territory.name}</h3>
          {territory.is_contested && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
              CONTESTED
            </span>
          )}
        </div>
        {territory.buff_type && (
          <div className="flex items-center gap-1 text-sm">
            <span>{BUFF_ICONS[territory.buff_type] ?? '✨'}</span>
            <span>+{territory.buff_value}%</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">{territory.description}</p>

      {/* Control Status */}
      <div className="text-sm mb-3">
        <span className="text-gray-500">Controlled by: </span>
        <span className="font-semibold">
          {territory.factions?.name ?? 'Neutral'}
        </span>
      </div>

      {/* Score Bars */}
      {totalScore > 0 && (
        <div className="space-y-1">
          {sortedScores.slice(0, 3).map((score) => {
            const percent = Math.round((score.score / totalScore) * 100)
            const barColor = score.color_hex === '#DC143C' ? 'bg-red-500'
              : score.color_hex === '#00CED1' ? 'bg-cyan-500'
              : 'bg-yellow-600'
            return (
              <div key={score.faction_id} className="flex items-center gap-2 text-xs">
                <div className="w-16 truncate text-gray-400">{score.faction_name.split(' ')[1] || score.faction_name}</div>
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="w-8 text-right text-gray-500">{score.score}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FactionStandingRow({ faction, rank }: { faction: FactionSummary; rank: number }) {
  const colorClass = FACTION_COLORS[faction.color_hex ?? ''] || ''
  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  return (
    <div className={`p-4 flex items-center gap-4 ${rank === 1 ? 'bg-yellow-500/5' : ''}`}>
      <div className="text-2xl w-10 text-center">{rankBadge}</div>
      <div className="flex-1">
        <div className={`font-semibold ${colorClass.includes('text-') ? colorClass.split(' ').find(c => c.startsWith('text-')) : 'text-white'}`}>
          {faction.name}
        </div>
        <div className="text-xs text-gray-400">
          {faction.memberCount} members
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold">{faction.territories_controlled}</div>
        <div className="text-xs text-gray-400">territories</div>
      </div>
    </div>
  )
}
