'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

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
  missionType: string
  objectiveValue: number
  rewardWealth: number
  rewardXp: number
  currentProgress: number
  isCompleted: boolean
  expiresAt: string
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

const CATEGORY_ICONS: Record<string, string> = {
  chat: '💬',
  economy: '💰',
  combat: '⚔️',
  loyalty: '✅',
  exploration: '🔍',
  social: '👥',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'text-green-400 bg-green-400/10 border-green-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  hard: 'text-red-400 bg-red-400/10 border-red-400/30',
}

export default function MissionsPage() {
  const { data: session } = useSession()
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
        // Refresh missions
        await fetchMissions()
      }
    } catch (error) {
      console.error('Failed to claim rewards:', error)
    } finally {
      setClaiming(null)
    }
  }

  const formatTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Unknown'

    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }

    return `${hours}h ${minutes}m`
  }

  const getProgressPercent = (current: number, target: number): number => {
    return Math.min(100, Math.round((current / target) * 100))
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
          <span className="text-gradient">Missions</span>
        </h1>
        <p className="text-gray-400 mt-1">Complete missions for rewards</p>
      </div>

      {/* Claim Result Toast */}
      {claimResult && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 animate-pulse">
          <h3 className="text-lg font-semibold text-green-400 mb-2">
            Rewards Claimed!
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-yellow-400">
              +${(claimResult.totalWealth + claimResult.bonusWealth).toLocaleString()}
            </span>
            <span className="text-purple-400">
              +{claimResult.totalXp + claimResult.bonusXp} XP
            </span>
            {claimResult.crateAwarded && (
              <span className="text-cyan-400">
                +1 {claimResult.crateAwarded} crate
              </span>
            )}
          </div>
          <button
            onClick={() => setClaimResult(null)}
            className="mt-2 text-sm text-gray-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Daily Missions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>📅</span> Daily Missions
            </h2>
            <p className="text-sm text-gray-400">
              Resets in {formatTimeRemaining(missions?.dailyExpiresAt ?? null)}
            </p>
          </div>
          {missions?.canClaimDaily && (
            <button
              onClick={() => handleClaim('daily')}
              disabled={claiming === 'daily'}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              {claiming === 'daily' ? 'Claiming...' : 'Claim All'}
            </button>
          )}
          {missions?.dailyAlreadyClaimed && (
            <span className="px-4 py-2 bg-gray-700 text-gray-400 rounded-lg">
              Claimed
            </span>
          )}
        </div>

        {missions?.daily.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No daily missions available
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {missions?.daily.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}

        {/* Completion Bonus Info */}
        <div className="p-4 bg-gray-900/50 border-t border-gray-700 text-sm text-gray-400">
          <strong>Completion Bonus:</strong> Complete all 3 daily missions for +$500 and +50 XP
        </div>
      </div>

      {/* Weekly Missions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>📆</span> Weekly Missions
            </h2>
            <p className="text-sm text-gray-400">
              Resets in {formatTimeRemaining(missions?.weeklyExpiresAt ?? null)}
            </p>
          </div>
          {missions?.canClaimWeekly && (
            <button
              onClick={() => handleClaim('weekly')}
              disabled={claiming === 'weekly'}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              {claiming === 'weekly' ? 'Claiming...' : 'Claim All'}
            </button>
          )}
          {missions?.weeklyAlreadyClaimed && (
            <span className="px-4 py-2 bg-gray-700 text-gray-400 rounded-lg">
              Claimed
            </span>
          )}
        </div>

        {missions?.weekly.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No weekly missions available
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {missions?.weekly.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}

        {/* Completion Bonus Info */}
        <div className="p-4 bg-gray-900/50 border-t border-gray-700 text-sm text-gray-400">
          <strong>Completion Bonus:</strong> Complete all 2 weekly missions for +$2,000, +200 XP, and a Common crate
        </div>
      </div>

      {/* How Missions Work */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">How Missions Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <span className="text-purple-400">1.</span>
            <p>Complete all daily or weekly missions to unlock rewards</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">2.</span>
            <p>All-or-nothing: you must complete ALL missions to claim</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">3.</span>
            <p>Mission difficulty and rewards scale with your tier</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-purple-400">4.</span>
            <p>Weekly missions include a bonus crate on completion</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MissionCard({ mission }: { mission: UserMission }) {
  const progressPercent = Math.min(100, Math.round((mission.currentProgress / mission.objectiveValue) * 100))

  return (
    <div className={`p-4 ${mission.isCompleted ? 'bg-green-500/5' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Category Icon */}
        <div className="text-2xl">
          {CATEGORY_ICONS[mission.template.category] || '📋'}
        </div>

        {/* Mission Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{mission.template.name}</h3>
            <span
              className={`px-2 py-0.5 text-xs rounded border ${
                DIFFICULTY_COLORS[mission.template.difficulty] || 'text-gray-400'
              }`}
            >
              {mission.template.difficulty}
            </span>
            {mission.isCompleted && (
              <span className="text-green-400 text-sm">✓</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-2">{mission.template.description}</p>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>
                {mission.currentProgress} / {mission.objectiveValue}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  mission.isCompleted ? 'bg-green-500' : 'bg-purple-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Rewards */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-yellow-400">
              +${mission.rewardWealth.toLocaleString()}
            </span>
            <span className="text-purple-400">+{mission.rewardXp} XP</span>
          </div>
        </div>
      </div>
    </div>
  )
}
