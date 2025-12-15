'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  kingpinName: string | null
  level: number
  statusTier: string
  value: string | number
}

interface UserRanks {
  daily: { rank: number; value: string; totalEntries: number } | null
  weekly: { rank: number; value: string; totalEntries: number } | null
  monthly: { rank: number; value: string; totalEntries: number } | null
  lifetime: { rank: number; value: string; totalEntries: number } | null
}

interface HallOfFameRecord {
  recordType: string
  userId: number
  username: string
  kingpinName: string | null
  recordValue: string
  achievedAt: string
  previousHolderUsername: string | null
  previousValue: string | null
  displayName: string
  icon: string
}

type Period = 'daily' | 'weekly' | 'monthly' | 'lifetime'
type Metric = 'wealthEarned' | 'xpEarned' | 'playCount' | 'robSuccessCount'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'lifetime', label: 'All-Time' },
]

const METRICS: { value: Metric; label: string; icon: string }[] = [
  { value: 'wealthEarned', label: 'Wealth', icon: '💰' },
  { value: 'xpEarned', label: 'XP', icon: '⭐' },
  { value: 'playCount', label: 'Grinders', icon: '🎮' },
  { value: 'robSuccessCount', label: 'Rob Masters', icon: '🔫' },
]

export default function LeaderboardsPage() {
  const { data: session } = useSession()
  const [period, setPeriod] = useState<Period>('daily')
  const [metric, setMetric] = useState<Metric>('wealthEarned')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userRanks, setUserRanks] = useState<UserRanks | null>(null)
  const [records, setRecords] = useState<HallOfFameRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch leaderboard when period or metric changes
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      try {
        const res = await fetch(`/api/leaderboards?metric=${metric}&period=${period}&limit=25`)
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data.data.entries)
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [period, metric])

  // Fetch user ranks and hall of fame on mount
  useEffect(() => {
    async function fetchUserData() {
      try {
        const [rankRes, recordsRes] = await Promise.all([
          fetch(`/api/leaderboards/rank?metric=${metric}`),
          fetch('/api/leaderboards/records'),
        ])

        if (rankRes.ok) {
          const data = await rankRes.json()
          setUserRanks(data.data.ranks)
        }

        if (recordsRes.ok) {
          const data = await recordsRes.json()
          setRecords(data.data.records)
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      }
    }
    fetchUserData()
  }, [metric])

  const formatValue = (value: string | number, metricType: Metric): string => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value
    if (metricType === 'wealthEarned') {
      return '$' + num.toLocaleString()
    }
    return num.toLocaleString()
  }

  const getRankMedal = (rank: number): string => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getTierColor = (tier: string): string => {
    const colors: Record<string, string> = {
      Rookie: 'text-gray-400',
      Associate: 'text-green-400',
      Soldier: 'text-blue-400',
      Captain: 'text-purple-400',
      Underboss: 'text-orange-400',
      Kingpin: 'text-yellow-400',
    }
    return colors[tier] || 'text-gray-400'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          <span className="text-gradient">Leaderboards</span>
        </h1>
        <p className="text-gray-400 mt-1">See who's running the streets</p>
      </div>

      {/* Your Rank Summary */}
      {userRanks && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Your Rankings</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PERIODS.map((p) => {
              const rank = userRanks[p.value]
              return (
                <div key={p.value} className="text-center">
                  <p className="text-gray-400 text-sm mb-1">{p.label}</p>
                  {rank ? (
                    <>
                      <p className="text-2xl font-bold text-purple-400">#{rank.rank}</p>
                      <p className="text-xs text-gray-500">{formatValue(rank.value, metric)}</p>
                    </>
                  ) : (
                    <p className="text-gray-500">-</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Metric Tabs */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                metric === m.value
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 sm:ml-auto">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">
            {METRICS.find((m) => m.value === metric)?.icon}{' '}
            {PERIODS.find((p) => p.value === period)?.label}{' '}
            {METRICS.find((m) => m.value === metric)?.label} Leaders
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No entries yet for this period
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {leaderboard.map((entry) => {
              const isCurrentUser = session?.user?.id === entry.userId
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 p-4 ${
                    isCurrentUser ? 'bg-purple-500/10' : 'hover:bg-gray-800/50'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-12 text-center">
                    <span className={`text-lg font-bold ${entry.rank <= 3 ? 'text-2xl' : 'text-gray-400'}`}>
                      {getRankMedal(entry.rank)}
                    </span>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {entry.kingpinName || entry.username}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-purple-400">(You)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={getTierColor(entry.statusTier)}>
                        {entry.statusTier}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">Lv.{entry.level}</span>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-400">
                      {formatValue(entry.value, metric)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Hall of Fame */}
      {records.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🏆</span> Hall of Fame
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((record) => (
              <div
                key={record.recordType}
                className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{record.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-400">{record.displayName}</p>
                    <p className="font-semibold truncate">
                      {record.kingpinName || record.username}
                    </p>
                    <p className="text-yellow-400 font-bold">
                      {formatRecordValue(record.recordType, record.recordValue)}
                    </p>
                    {record.previousHolderUsername && (
                      <p className="text-xs text-gray-500 mt-1">
                        Previous: {record.previousHolderUsername} ({formatRecordValue(record.recordType, record.previousValue!)})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRecordValue(recordType: string, value: string): string {
  const num = parseInt(value, 10)
  if (recordType.includes('wealth') || recordType.includes('rob')) {
    return '$' + num.toLocaleString()
  }
  if (recordType.includes('streak')) {
    return num + ' days'
  }
  return num.toLocaleString()
}
