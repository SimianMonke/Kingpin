'use client'

import { useEffect, useState, useCallback } from 'react'

interface HeistEventInfo {
  id: number
  session_id: number
  event_type: string
  difficulty: string
  prompt: string
  correct_answer?: string
  started_at: string
  time_limit_seconds: number
  ended_at: string | null
  is_active: boolean
  timeRemainingMs: number
  winner?: {
    id: number
    username: string
    platform: string
    response_time_ms: number
    crate_tier: string
  }
}

interface HeistHistory {
  id: number
  event_type: string
  difficulty: string
  prompt: string
  correct_answer: string
  started_at: string
  ended_at: string | null
  winner?: {
    id: number
    username: string
    platform: string
    response_time_ms: number
  }
  crate_tier: string | null
}

interface HeistLeaderboardEntry {
  user_id: number
  username: string
  wins: number
  avgResponseTimeMs: number
}

interface UserHeistStats {
  totalWins: number
  avgResponseTimeMs: number
  cratesByTier: Record<string, number>
  fastestWinMs: number | null
}

interface HeistData {
  active: boolean
  heist: HeistEventInfo | null
  schedule: { next_heist_at: string; timeUntilMs: number } | null
}

interface HistoryData {
  history: HeistHistory[]
  leaderboard?: HeistLeaderboardEntry[]
  userStats?: UserHeistStats
}

const EVENT_TYPE_NAMES: Record<string, string> = {
  quick_grab: 'Quick Grab',
  code_crack: 'Code Crack',
  trivia: 'Trivia',
  word_scramble: 'Word Scramble',
  riddle: 'Riddle',
  math_hack: 'Math Hack',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'text-green-400 bg-green-500/10 border-green-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  hard: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const TIER_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  legendary: 'text-yellow-400',
}

export default function EventsPage() {
  const [heistData, setHeistData] = useState<HeistData | null>(null)
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)

  const fetchHeistData = useCallback(async () => {
    try {
      const res = await fetch('/api/heist')
      if (res.ok) {
        const json = await res.json()
        setHeistData(json.data)
        if (json.data.heist?.is_active) {
          setTimeRemaining(Math.ceil(json.data.heist.timeRemainingMs / 1000))
        }
      }
    } catch (error) {
      console.error('Failed to fetch heist:', error)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/heist/history?leaderboard=true')
      if (res.ok) {
        const json = await res.json()
        setHistoryData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }, [])

  useEffect(() => {
    async function loadData() {
      await Promise.all([fetchHeistData(), fetchHistory()])
      setLoading(false)
    }
    loadData()
  }, [fetchHeistData, fetchHistory])

  // Poll for active heist updates
  useEffect(() => {
    const interval = setInterval(fetchHeistData, 5000)
    return () => clearInterval(interval)
  }, [fetchHeistData])

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          fetchHeistData()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, fetchHeistData])

  async function handleSubmitAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || submitting) return

    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/heist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answer.trim() }),
      })

      const json = await res.json()

      if (res.ok) {
        if (json.data.winner) {
          setResult({
            type: 'success',
            message: `Correct! You won a ${json.data.tier} crate! (${json.data.response_time_ms}ms)`,
          })
          fetchHistory()
        } else if (json.data.alreadyWon) {
          setResult({
            type: 'info',
            message: 'This heist has already been won!',
          })
        } else if (json.data.expired) {
          setResult({
            type: 'info',
            message: 'Time expired!',
          })
        } else {
          setResult({
            type: 'error',
            message: 'Incorrect answer. Try again!',
          })
        }
        fetchHeistData()
      } else {
        setResult({ type: 'error', message: json.error })
      }
    } catch (error) {
      setResult({ type: 'error', message: 'Failed to submit answer' })
    } finally {
      setSubmitting(false)
      setAnswer('')
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatResponseTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const activeHeist = heistData?.heist?.is_active ? heistData.heist : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Heist Alerts</h1>
        <p className="text-gray-400 mt-1">
          Random events during streams. First correct answer wins a crate!
        </p>
      </div>

      {/* Active Heist */}
      {activeHeist ? (
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 rounded-xl p-6 animate-pulse-slow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <span className="font-bold text-lg text-purple-400">HEIST ALERT!</span>
              <span
                className={`px-2 py-1 rounded text-xs border ${
                  DIFFICULTY_COLORS[activeHeist.difficulty]
                }`}
              >
                {activeHeist.difficulty.toUpperCase()}
              </span>
              <span className="text-gray-400 text-sm">
                {EVENT_TYPE_NAMES[activeHeist.event_type] || activeHeist.event_type}
              </span>
            </div>
            <div className="text-2xl font-mono font-bold text-yellow-400">
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Prompt */}
          <div className="bg-black/30 rounded-lg p-6 mb-6">
            <p className="text-xl text-center font-medium">{activeHeist.prompt}</p>
          </div>

          {/* Answer Form */}
          <form onSubmit={handleSubmitAnswer} className="flex gap-3">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || !answer.trim()}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Checking...' : 'Submit'}
            </button>
          </form>

          {/* Result Message */}
          {result && (
            <div
              className={`mt-4 p-3 rounded-lg ${
                result.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : result.type === 'error'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
              }`}
            >
              {result.message}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">No Active Heist</h2>
          <p className="text-gray-400 mb-4">
            Heist alerts trigger randomly during live streams (every 60-120 minutes).
          </p>
          {heistData?.schedule && (
            <p className="text-sm text-purple-400">
              Next heist in approximately {Math.ceil(heistData.schedule.timeUntilMs / 60000)}{' '}
              minutes
            </p>
          )}
        </div>
      )}

      {/* User Stats */}
      {historyData?.userStats && historyData.userStats.totalWins > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Your Heist Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">
                {historyData.userStats.totalWins}
              </p>
              <p className="text-sm text-gray-400">Total Wins</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">
                {formatResponseTime(historyData.userStats.fastestWinMs || 0)}
              </p>
              <p className="text-sm text-gray-400">Fastest Win</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">
                {formatResponseTime(historyData.userStats.avgResponseTimeMs)}
              </p>
              <p className="text-sm text-gray-400">Avg Response</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center gap-2 text-sm">
                {Object.entries(historyData.userStats.cratesByTier).map(([tier, count]) =>
                  count > 0 ? (
                    <span key={tier} className={TIER_COLORS[tier]}>
                      {count} {tier}
                    </span>
                  ) : null
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">Crates Won</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {historyData?.leaderboard && historyData.leaderboard.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Heist Leaderboard</h2>
          <div className="space-y-2">
            {historyData.leaderboard.map((entry, index) => (
              <div
                key={entry.user_id}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : index === 1
                        ? 'bg-gray-400/20 text-gray-300'
                        : index === 2
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-medium">{entry.username}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-purple-400">{entry.wins} wins</span>
                  <span className="text-gray-400">
                    avg {formatResponseTime(entry.avgResponseTimeMs)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent History */}
      {historyData?.history && historyData.history.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Heists</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Difficulty</th>
                  <th className="pb-3 font-medium">Winner</th>
                  <th className="pb-3 font-medium">Prize</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {historyData.history.map((heist) => (
                  <tr key={heist.id} className="border-b border-gray-800">
                    <td className="py-3">
                      {EVENT_TYPE_NAMES[heist.event_type] || heist.event_type}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          DIFFICULTY_COLORS[heist.difficulty]
                        }`}
                      >
                        {heist.difficulty}
                      </span>
                    </td>
                    <td className="py-3">
                      {heist.winner ? (
                        <span className="text-green-400">{heist.winner.username}</span>
                      ) : (
                        <span className="text-gray-500">No winner</span>
                      )}
                    </td>
                    <td className="py-3">
                      {heist.crate_tier ? (
                        <span className={TIER_COLORS[heist.crate_tier]}>
                          {heist.crate_tier} crate
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-400">
                      {heist.winner
                        ? formatResponseTime(heist.winner.response_time_ms)
                        : 'Expired'}
                    </td>
                    <td className="py-3 text-gray-400">{formatDate(heist.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">How Heist Alerts Work</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-400">
          <div>
            <h3 className="text-white font-medium mb-2">Event Types</h3>
            <ul className="space-y-1">
              <li>
                <span className="text-green-400">Quick Grab / Code Crack</span> - Easy (45s)
              </li>
              <li>
                <span className="text-yellow-400">Trivia / Word Scramble</span> - Medium (90s)
              </li>
              <li>
                <span className="text-red-400">Riddle / Math Hack</span> - Hard (120s)
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-medium mb-2">Crate Rewards by Difficulty</h3>
            <ul className="space-y-1">
              <li>
                <span className="text-green-400">Easy:</span> 70% Common, 25% Uncommon, 5% Rare
              </li>
              <li>
                <span className="text-yellow-400">Medium:</span> 50% Common, 35% Uncommon, 13%
                Rare, 2% Legendary
              </li>
              <li>
                <span className="text-red-400">Hard:</span> 30% Common, 40% Uncommon, 25% Rare,
                5% Legendary
              </li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.9;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
