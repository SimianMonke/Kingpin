'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber } from '@/components/ui/kinetic-number'
import { PageLoader, InitializingText } from '@/components/ui/initializing-loader'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface MissionTemplate {
  id: string
  name: string
  description: string
  category: string
  difficulty: string
  objectiveType: string
}

interface UserMission {
  id: number
  templateId: string
  mission_type: string
  objective_value: number
  reward_wealth: number
  reward_xp: number
  current_progress: number
  is_completed: boolean
  expires_at: string
  template: MissionTemplate
}

interface ActiveMissions {
  daily: UserMission[]
  weekly: UserMission[]
  dailyExpiresAt: string | null
  weeklyExpiresAt: string | null
  canClaimDaily: boolean
  canClaimWeekly: boolean
  dailyAlreadyClaimed: boolean
  weeklyAlreadyClaimed: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_ICONS: Record<string, string> = {
  chat: '💬',
  economy: '💰',
  combat: '⚔️',
  loyalty: '✅',
  exploration: '🔍',
  social: '👥',
}

const DIFFICULTY_STYLES: Record<string, { color: string; border: string }> = {
  easy: { color: 'var(--color-success)', border: 'border-[var(--color-success)]' },
  medium: { color: 'var(--color-warning)', border: 'border-[var(--color-warning)]' },
  hard: { color: 'var(--color-destructive)', border: 'border-[var(--color-destructive)]' },
}

// =============================================================================
// MISSIONS PAGE
// =============================================================================

export default function MissionsPage() {
  const [missions, setMissions] = useState<ActiveMissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<'daily' | 'weekly' | null>(null)
  const [claimResult, setClaimResult] = useState<{
    type: 'daily' | 'weekly'
    totalWealth: number
    totalXp: number
    bonusWealth: number
    bonusXp: number
    crateAwarded: string | null
  } | null>(null)

  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/missions')
      if (res.ok) {
        const data = await res.json()
        setMissions(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch missions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMissions()
  }, [])

  const handleClaim = async (type: 'daily' | 'weekly') => {
    setClaiming(type)
    try {
      const res = await fetch('/api/missions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      if (res.ok) {
        const data = await res.json()
        setClaimResult({
          type,
          totalWealth: data.data.totalWealth,
          totalXp: data.data.totalXp,
          bonusWealth: data.data.bonusWealth,
          bonusXp: data.data.bonusXp,
          crateAwarded: data.data.crateAwarded,
        })
        await fetchMissions()
      }
    } catch (error) {
      console.error('Failed to claim rewards:', error)
    } finally {
      setClaiming(null)
    }
  }

  const formatTimeRemaining = (expires_at: string | null): string => {
    if (!expires_at) return 'UNKNOWN'

    const now = new Date()
    const expires = new Date(expires_at)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return 'EXPIRED'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}D ${hours % 24}H`
    }

    return `${hours}H ${minutes}M`
  }

  if (loading) {
    return <PageLoader message="LOADING MISSION DATA" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
          <span className="text-[var(--color-primary)]">MISSIONS</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// COMPLETE OBJECTIVES FOR REWARDS'}
        </p>
      </div>

      {/* Claim Result */}
      {claimResult && (
        <Card
          variant="outlined"
          className="border-[var(--color-success)] bg-[var(--color-success)]/5 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-display text-[var(--color-success)]">✓ REWARDS CLAIMED</span>
              <span className="font-mono text-[var(--color-warning)]">
                +$<KineticNumber value={claimResult.totalWealth + claimResult.bonusWealth} />
              </span>
              <span className="font-mono text-[var(--color-primary)]">
                +<KineticNumber value={claimResult.totalXp + claimResult.bonusXp} /> XP
              </span>
              {claimResult.crateAwarded && (
                <span className="font-mono text-[var(--color-secondary)]">
                  +1 {claimResult.crateAwarded.toUpperCase()} CRATE
                </span>
              )}
            </div>
            <button
              onClick={() => setClaimResult(null)}
              className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* Daily Missions */}
      <Card variant="solid" className="overflow-hidden">
        <CardHeader className="p-4 border-b border-[var(--color-primary)]/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>📅</span> DAILY MISSIONS
            </CardTitle>
            <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
              RESETS IN {formatTimeRemaining(missions?.dailyExpiresAt ?? null)}
            </p>
          </div>
          {missions?.canClaimDaily && (
            <Button
              onClick={() => handleClaim('daily')}
              disabled={claiming === 'daily'}
              variant="success"
            >
              {claiming === 'daily' ? <InitializingText text="CLAIM" className="text-xs" /> : 'CLAIM ALL'}
            </Button>
          )}
          {missions?.dailyAlreadyClaimed && (
            <span className="font-mono text-sm text-[var(--color-muted)] px-4 py-2 border border-[var(--color-muted)]/30">
              CLAIMED
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {missions?.daily.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-mono text-[var(--color-muted)]">{'> NO DAILY MISSIONS AVAILABLE'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-primary)]/10">
              {missions?.daily.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          )}
          <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-primary)]/20">
            <p className="font-mono text-xs text-[var(--color-muted)]">
              {'// COMPLETION BONUS: +$500, +50 XP'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Missions */}
      <Card variant="solid" className="overflow-hidden">
        <CardHeader className="p-4 border-b border-[var(--color-primary)]/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>📆</span> WEEKLY MISSIONS
            </CardTitle>
            <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
              RESETS IN {formatTimeRemaining(missions?.weeklyExpiresAt ?? null)}
            </p>
          </div>
          {missions?.canClaimWeekly && (
            <Button
              onClick={() => handleClaim('weekly')}
              disabled={claiming === 'weekly'}
              variant="success"
            >
              {claiming === 'weekly' ? <InitializingText text="CLAIM" className="text-xs" /> : 'CLAIM ALL'}
            </Button>
          )}
          {missions?.weeklyAlreadyClaimed && (
            <span className="font-mono text-sm text-[var(--color-muted)] px-4 py-2 border border-[var(--color-muted)]/30">
              CLAIMED
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {missions?.weekly.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-mono text-[var(--color-muted)]">{'> NO WEEKLY MISSIONS AVAILABLE'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-primary)]/10">
              {missions?.weekly.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          )}
          <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-primary)]/20">
            <p className="font-mono text-xs text-[var(--color-muted)]">
              {'// COMPLETION BONUS: +$2,000, +200 XP, +1 COMMON CRATE'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How Missions Work */}
      <Card variant="default" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>HOW MISSIONS WORK</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">01.</span>
              <p className="text-[var(--color-muted)]">Complete all daily or weekly missions to unlock rewards</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">02.</span>
              <p className="text-[var(--color-muted)]">All-or-nothing: you must complete ALL missions to claim</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">03.</span>
              <p className="text-[var(--color-muted)]">Mission difficulty and rewards scale with your tier</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-primary)]">04.</span>
              <p className="text-[var(--color-muted)]">Weekly missions include a bonus crate on completion</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// MISSION CARD
// =============================================================================

function MissionCard({ mission }: { mission: UserMission }) {
  const progressPercent = Math.min(100, Math.round((mission.current_progress / mission.objective_value) * 100))
  const diffStyle = DIFFICULTY_STYLES[mission.template.difficulty] || DIFFICULTY_STYLES.easy

  return (
    <div className={cn('p-4', mission.is_completed && 'bg-[var(--color-success)]/5')}>
      <div className="flex items-start gap-4">
        {/* Category Icon */}
        <div className="text-2xl">
          {CATEGORY_ICONS[mission.template.category] || '📋'}
        </div>

        {/* Mission Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display uppercase tracking-wider truncate">
              {mission.template.name}
            </h3>
            <span
              className={cn('px-2 py-0.5 font-mono text-[10px] uppercase border', diffStyle.border)}
              style={{ color: diffStyle.color }}
            >
              {mission.template.difficulty}
            </span>
            {mission.is_completed && (
              <span className="text-[var(--color-success)]">✓</span>
            )}
          </div>
          <p className="font-mono text-sm text-[var(--color-muted)] mb-3">
            {mission.template.description}
          </p>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between font-mono text-xs text-[var(--color-muted)] mb-1">
              <span>PROGRESS</span>
              <span>
                <KineticNumber value={mission.current_progress} /> / {mission.objective_value}
              </span>
            </div>
            <div className="h-2 bg-[var(--color-surface)] border border-[var(--color-primary)]/20">
              <div
                className={cn(
                  'h-full transition-all',
                  mission.is_completed ? 'bg-[var(--color-success)]' : 'bg-[var(--color-primary)]'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Rewards */}
          <div className="flex items-center gap-4 font-mono text-sm">
            <span className="text-[var(--color-warning)]">
              +${mission.reward_wealth.toLocaleString()}
            </span>
            <span className="text-[var(--color-primary)]">
              +{mission.reward_xp} XP
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
