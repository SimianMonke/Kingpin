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
  xp: 'XP BONUS',
  wealth: 'WEALTH BONUS',
  rob_success: 'ROB SUCCESS',
  defense: 'DEFENSE',
  crate_drop: 'CRATE DROP',
  shop_discount: 'SHOP DISCOUNT',
  business_revenue: 'BUSINESS REV',
  all_rewards: 'ALL REWARDS',
}

// =============================================================================
// FACTION PAGE
// =============================================================================

export default function FactionPage() {
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
        setMessage({ type: 'success', text: `WELCOME TO ${data.data.factions.name.toUpperCase()}!` })
        await fetchData()
      } else {
        setMessage({ type: 'error', text: data.error?.toUpperCase() || 'FAILED TO JOIN' })
      }
    } catch {
      setMessage({ type: 'error', text: 'NETWORK ERROR' })
    } finally {
      setJoining(null)
    }
  }

  const handleLeave = async () => {
    if (!confirm('CONFIRM LEAVE FACTION? 7-DAY COOLDOWN APPLIES.')) {
      return
    }

    setLeaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/factions/leave', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'YOU HAVE LEFT YOUR FACTION' })
        await fetchData()
      } else {
        setMessage({ type: 'error', text: data.error?.toUpperCase() || 'FAILED TO LEAVE' })
      }
    } catch {
      setMessage({ type: 'error', text: 'NETWORK ERROR' })
    } finally {
      setLeaving(false)
    }
  }

  if (loading) {
    return <PageLoader message="LOADING FACTION DATA" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
          FACTIONS & <span className="text-[var(--color-primary)]">TERRITORIES</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// JOIN A FACTION AND COMPETE FOR TERRITORY CONTROL'}
        </p>
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
          <div className="flex items-center justify-between">
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
            <button
              onClick={() => setMessage(null)}
              className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* Current Faction Status OR Faction Selector */}
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
      <Card variant="solid" className="overflow-hidden">
        <CardHeader className="p-4 border-b border-[var(--color-primary)]/20">
          <CardTitle>TERRITORY MAP</CardTitle>
          <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
            12 TERRITORIES ACROSS LAZARUS CITY
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {territories.map((territory) => (
              <TerritoryCard key={territory.id} territory={territory} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Faction Standings */}
      <Card variant="solid" className="overflow-hidden">
        <CardHeader className="p-4 border-b border-[var(--color-primary)]/20">
          <CardTitle>FACTION STANDINGS</CardTitle>
          <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
            THIS WEEK'S COMPETITION
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--color-primary)]/10">
            {allFactions
              .sort((a, b) => b.territories_controlled - a.territories_controlled)
              .map((faction, index) => (
                <FactionStandingRow key={faction.id} faction={faction} rank={index + 1} />
              ))}
          </div>
        </CardContent>
      </Card>

      {/* How Factions Work */}
      <Card variant="default" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>HOW FACTIONS WORK</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">01.</span>
              <p className="text-[var(--color-muted)]">Join a faction at level 20+ (Associate tier)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">02.</span>
              <p className="text-[var(--color-muted)]">Your activities earn territory points</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">03.</span>
              <p className="text-[var(--color-muted)]">Factions compete for territory control</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">04.</span>
              <p className="text-[var(--color-muted)]">Controlled territories grant buffs to ALL members</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">05.</span>
              <p className="text-[var(--color-muted)]">Weekly rewards distributed based on territories</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">06.</span>
              <p className="text-[var(--color-muted)]">7-day cooldown when switching factions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// CURRENT FACTION CARD
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
  return (
    <Card
      variant="default"
      glow="primary"
      scanlines
      className="overflow-hidden"
      style={{
        borderColor: faction.color_hex || 'var(--color-primary)',
      }}
    >
      <div className="p-6">
        {/* Faction Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2
              className="font-display text-2xl uppercase tracking-wider"
              style={{ color: faction.color_hex || 'var(--color-primary)' }}
            >
              {faction.name}
            </h2>
            {faction.motto && (
              <p className="font-mono text-sm text-[var(--color-muted)] italic mt-1">
                "{faction.motto}"
              </p>
            )}
            {faction.description && (
              <p className="font-mono text-sm text-[var(--color-muted)] mt-2">
                {faction.description}
              </p>
            )}
          </div>
          <Button
            onClick={onLeave}
            disabled={leaving}
            variant="destructive"
            size="sm"
          >
            {leaving ? <InitializingText text="..." className="text-xs" /> : 'LEAVE'}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatValue
            label="MEMBERS"
            value={faction.memberCount}
            valueClassName="text-[var(--color-foreground)]"
          />
          <StatValue
            label="TERRITORIES"
            value={faction.territories_controlled}
            valueClassName="text-[var(--color-success)]"
          />
          <StatValue
            label="YOUR RANK"
            value={rank?.rank || 0}
            prefix="#"
            valueClassName="text-[var(--color-secondary)]"
          />
          <StatValue
            label="YOUR POINTS"
            value={rank?.weeklyScore || 0}
            valueClassName="text-[var(--color-warning)]"
          />
        </div>

        {/* Reward Cooldown Warning */}
        {membership.rewardCooldownUntil && (
          <Card variant="outlined" className="border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5 p-3 mb-6">
            <p className="font-mono text-sm text-[var(--color-warning)]">
              ⚠ REWARD COOLDOWN UNTIL{' '}
              {new Date(membership.rewardCooldownUntil).toLocaleDateString().toUpperCase()}
            </p>
          </Card>
        )}
      </div>

      {/* Active Buffs */}
      {faction.buffs.length > 0 && (
        <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-primary)]/20">
          <h3 className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-3">
            ACTIVE BUFFS
          </h3>
          <div className="flex flex-wrap gap-2">
            {faction.buffs.map((buff, idx) => (
              <span
                key={idx}
                className="flex items-center gap-2 px-3 py-1 font-mono text-sm border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5"
              >
                <span>{BUFF_ICONS[buff.type] ?? '✨'}</span>
                <span>+{buff.value}% {BUFF_LABELS[buff.type] ?? buff.type.toUpperCase()}</span>
                <span className="text-xs text-[var(--color-muted)]">({buff.territoryName})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Territory */}
      {assignedTerritory && (
        <div className="p-4 bg-[var(--color-surface)]/50 border-t border-[var(--color-primary)]/20">
          <h3 className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
            ASSIGNED TERRITORY
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="font-display uppercase tracking-wider">{assignedTerritory.name}</p>
              <p className="font-mono text-xs text-[var(--color-muted)]">
                {assignedTerritory.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// =============================================================================
// FACTION SELECTOR
// =============================================================================

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
    <Card variant="solid" className="overflow-hidden">
      <CardHeader className="p-4 border-b border-[var(--color-primary)]/20">
        <CardTitle>CHOOSE YOUR FACTION</CardTitle>
        <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
          {canJoin
            ? 'JOIN A FACTION TO START EARNING TERRITORY REWARDS'
            : `COOLDOWN ACTIVE UNTIL ${cooldownUntil ? new Date(cooldownUntil).toLocaleDateString().toUpperCase() : 'SOON'}`}
        </p>
      </CardHeader>

      {!canJoin && (
        <div className="p-4 bg-[var(--color-warning)]/5 border-b border-[var(--color-warning)]/30">
          <p className="font-mono text-sm text-[var(--color-warning)]">
            ⚠ COOLDOWN ACTIVE - WAIT BEFORE JOINING
          </p>
        </div>
      )}

      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {factions.map((faction) => (
            <div
              key={faction.id}
              className={cn(
                'p-4 border-2 transition-all',
                canJoin
                  ? 'hover:scale-[1.02] cursor-pointer'
                  : 'opacity-50'
              )}
              style={{
                borderColor: faction.color_hex || 'var(--color-muted)',
                backgroundColor: `${faction.color_hex}10` || 'transparent',
              }}
            >
              <h3
                className="font-display text-lg uppercase tracking-wider"
                style={{ color: faction.color_hex || 'var(--color-foreground)' }}
              >
                {faction.name}
              </h3>
              {faction.motto && (
                <p className="font-mono text-xs text-[var(--color-muted)] italic mb-2">
                  "{faction.motto}"
                </p>
              )}
              {faction.description && (
                <p className="font-mono text-sm text-[var(--color-muted)] mb-4">
                  {faction.description}
                </p>
              )}
              <div className="flex items-center gap-4 font-mono text-sm mb-4">
                <span>👥 {faction.memberCount}</span>
                <span>🏴 {faction.territories_controlled}</span>
              </div>
              <Button
                onClick={() => canJoin && onJoin(faction.name)}
                disabled={!canJoin || joining !== null}
                variant={canJoin ? 'default' : 'ghost'}
                className="w-full"
              >
                {joining === faction.name ? (
                  <InitializingText text="JOINING" className="text-xs" />
                ) : (
                  'JOIN FACTION'
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// TERRITORY CARD
// =============================================================================

function TerritoryCard({ territory }: { territory: TerritoryStatus }) {
  const controllingColor = territory.factions?.color_hex || 'var(--color-muted)'
  const sortedScores = [...territory.scores].sort((a, b) => b.score - a.score)
  const totalScore = sortedScores.reduce((sum, s) => sum + s.score, 0)

  return (
    <div
      className="p-4 border-2"
      style={{
        borderColor: `${controllingColor}50`,
        backgroundColor: `${controllingColor}08`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-display uppercase tracking-wider text-sm">{territory.name}</h3>
          {territory.is_contested && (
            <span className="font-mono text-[10px] text-[var(--color-warning)] px-2 py-0.5 border border-[var(--color-warning)]/30">
              CONTESTED
            </span>
          )}
        </div>
        {territory.buff_type && (
          <div className="flex items-center gap-1 font-mono text-xs">
            <span>{BUFF_ICONS[territory.buff_type] ?? '✨'}</span>
            <span>+{territory.buff_value}%</span>
          </div>
        )}
      </div>

      <p className="font-mono text-xs text-[var(--color-muted)] mb-3">{territory.description}</p>

      <p className="font-mono text-xs mb-3">
        <span className="text-[var(--color-muted)]">CONTROLLED BY: </span>
        <span style={{ color: controllingColor }}>{territory.factions?.name ?? 'NEUTRAL'}</span>
      </p>

      {/* Score Bars */}
      {totalScore > 0 && (
        <div className="space-y-1">
          {sortedScores.slice(0, 3).map((score) => {
            const percent = Math.round((score.score / totalScore) * 100)
            return (
              <div key={score.faction_id} className="flex items-center gap-2 font-mono text-[10px]">
                <div
                  className="w-12 truncate"
                  style={{ color: score.color_hex || 'var(--color-muted)' }}
                >
                  {score.faction_name.split(' ')[1] || score.faction_name}
                </div>
                <div className="flex-1 h-1.5 bg-[var(--color-surface)] border border-[var(--color-primary)]/20">
                  <div
                    className="h-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: score.color_hex || 'var(--color-muted)',
                    }}
                  />
                </div>
                <div className="w-8 text-right text-[var(--color-muted)]">{score.score}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// FACTION STANDING ROW
// =============================================================================

function FactionStandingRow({ faction, rank }: { faction: FactionSummary; rank: number }) {
  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  return (
    <div
      className={cn(
        'p-4 flex items-center gap-4',
        rank === 1 && 'bg-[var(--tier-legendary)]/5'
      )}
    >
      <div className="text-2xl w-10 text-center font-display">{rankBadge}</div>
      <div className="flex-1">
        <p
          className="font-display uppercase tracking-wider"
          style={{ color: faction.color_hex || 'var(--color-foreground)' }}
        >
          {faction.name}
        </p>
        <p className="font-mono text-xs text-[var(--color-muted)]">
          {faction.memberCount} MEMBERS
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-lg font-bold">
          <KineticNumber value={faction.territories_controlled} />
        </p>
        <p className="font-mono text-xs text-[var(--color-muted)]">TERRITORIES</p>
      </div>
    </div>
  )
}
