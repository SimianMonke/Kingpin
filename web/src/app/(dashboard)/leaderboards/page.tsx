'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber } from '@/components/ui/kinetic-number'
import { PageLoader } from '@/components/ui/initializing-loader'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string
  kingpin_name: string | null
  level: number
  status_tier: string
  value: string | number
}

interface UserRanks {
  daily: { rank: number; value: string; totalEntries: number } | null
  weekly: { rank: number; value: string; totalEntries: number } | null
  monthly: { rank: number; value: string; totalEntries: number } | null
  lifetime: { rank: number; value: string; totalEntries: number } | null
}

interface HallOfFameRecord {
  record_type: string
  user_id: number
  username: string
  kingpin_name: string | null
  record_value: string
  achieved_at: string
  previousHolderUsername: string | null
  previous_value: string | null
  display_name: string
  icon: string
}

type Period = 'daily' | 'weekly' | 'monthly' | 'lifetime'
type Metric = 'wealth_earned' | 'xp_earned' | 'play_count' | 'rob_success_count'

// =============================================================================
// CONSTANTS
// =============================================================================

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'DAILY' },
  { value: 'weekly', label: 'WEEKLY' },
  { value: 'monthly', label: 'MONTHLY' },
  { value: 'lifetime', label: 'ALL-TIME' },
]

const METRICS: { value: Metric; label: string; icon: string }[] = [
  { value: 'wealth_earned', label: 'WEALTH', icon: '💰' },
  { value: 'xp_earned', label: 'XP', icon: '⭐' },
  { value: 'play_count', label: 'GRINDERS', icon: '🎮' },
  { value: 'rob_success_count', label: 'ROB MASTERS', icon: '🔫' },
]

const TIER_COLORS: Record<string, string> = {
  Punk: 'var(--tier-common)',
  Associate: 'var(--tier-uncommon)',
  Soldier: 'var(--tier-uncommon)',
  Captain: 'var(--tier-rare)',
  Underboss: 'var(--tier-rare)',
  Kingpin: 'var(--tier-legendary)',
}

// =============================================================================
// LEADERBOARDS PAGE
// =============================================================================

export default function LeaderboardsPage() {
  const { data: session } = useSession()
  const [period, setPeriod] = useState<Period>('daily')
  const [metric, setMetric] = useState<Metric>('wealth_earned')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userRanks, setUserRanks] = useState<UserRanks | null>(null)
  const [records, setRecords] = useState<HallOfFameRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
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
  }, [metric, period])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

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
    if (metricType === 'wealth_earned') {
      return '$' + num.toLocaleString()
    }
    return num.toLocaleString()
  }

  const getRankDisplay = (rank: number): { text: string; class: string } => {
    if (rank === 1) return { text: '1ST', class: 'text-[var(--tier-legendary)] text-2xl' }
    if (rank === 2) return { text: '2ND', class: 'text-[var(--color-muted)] text-xl' }
    if (rank === 3) return { text: '3RD', class: 'text-[#CD7F32] text-xl' }
    return { text: `#${rank}`, class: 'text-[var(--color-muted)]' }
  }

  if (loading && leaderboard.length === 0) {
    return <PageLoader message="LOADING LEADERBOARD DATA" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
          <span className="text-[var(--color-primary)]">LEADERBOARDS</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// RANKING THE STREETS'}
        </p>
      </div>

      {/* Your Rank Summary */}
      {userRanks && (
        <Card variant="default" glow="primary" className="p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle>YOUR RANKINGS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PERIODS.map((p) => {
                const rank = userRanks[p.value]
                return (
                  <div
                    key={p.value}
                    className={cn(
                      'text-center p-4 border-2 transition-all',
                      period === p.value
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-muted)]/20'
                    )}
                  >
                    <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
                      {p.label}
                    </p>
                    {rank ? (
                      <>
                        <p className="font-mono text-2xl font-bold text-[var(--color-secondary)]">
                          #<KineticNumber value={rank.rank} />
                        </p>
                        <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
                          {formatValue(rank.value, metric)}
                        </p>
                      </>
                    ) : (
                      <p className="font-mono text-[var(--color-muted)]">—</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Metric Tabs */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <Button
              key={m.value}
              onClick={() => setMetric(m.value)}
              variant={metric === m.value ? 'default' : 'ghost'}
              size="sm"
            >
              <span className="mr-2">{m.icon}</span>
              {m.label}
            </Button>
          ))}
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 sm:ml-auto">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3 py-2 font-display text-xs uppercase tracking-wider transition-colors',
                period === p.value
                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card variant="solid" className="overflow-hidden">
        <CardHeader className="p-4 border-b border-[var(--color-primary)]/20">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>{METRICS.find((m) => m.value === metric)?.icon}</span>
            {PERIODS.find((p) => p.value === period)?.label}{' '}
            {METRICS.find((m) => m.value === metric)?.label} LEADERS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-mono text-[var(--color-muted)]">{'> NO ENTRIES FOR THIS PERIOD'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-primary)]/10">
              {leaderboard.map((entry) => {
                const isCurrentUser = session?.user?.id === entry.user_id
                const rankDisplay = getRankDisplay(entry.rank)
                const tierColor = TIER_COLORS[entry.status_tier] || 'var(--tier-common)'

                return (
                  <div
                    key={entry.user_id}
                    className={cn(
                      'flex items-center gap-4 p-4 transition-colors',
                      isCurrentUser
                        ? 'bg-[var(--color-secondary)]/10 border-l-4 border-[var(--color-secondary)]'
                        : 'hover:bg-[var(--color-surface)]'
                    )}
                  >
                    {/* Rank */}
                    <div className="w-16 text-center">
                      <span className={cn('font-display font-bold', rankDisplay.class)}>
                        {rankDisplay.text}
                      </span>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-display uppercase tracking-wider truncate">
                        {entry.kingpin_name || entry.username}
                        {isCurrentUser && (
                          <span className="ml-2 font-mono text-xs text-[var(--color-secondary)]">
                            (YOU)
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className="font-display text-xs uppercase tracking-wider"
                          style={{ color: tierColor }}
                        >
                          {entry.status_tier}
                        </span>
                        <span className="text-[var(--color-muted)]">•</span>
                        <span className="font-mono text-xs text-[var(--color-muted)]">
                          LVL {entry.level}
                        </span>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold text-[var(--color-warning)]">
                        {formatValue(entry.value, metric)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hall of Fame */}
      {records.length > 0 && (
        <Card variant="default" scanlines className="p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle className="flex items-center gap-2">
              <span>🏆</span> HALL OF FAME
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.map((record) => (
                <div
                  key={record.record_type}
                  className="p-4 border-2 border-[var(--tier-legendary)]/30 bg-[var(--tier-legendary)]/5"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{record.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                        {record.display_name}
                      </p>
                      <p className="font-display uppercase tracking-wider truncate mt-1">
                        {record.kingpin_name || record.username}
                      </p>
                      <p className="font-mono font-bold text-[var(--tier-legendary)] mt-1">
                        {formatRecordValue(record.record_type, record.record_value)}
                      </p>
                      {record.previousHolderUsername && (
                        <p className="font-mono text-[10px] text-[var(--color-muted)] mt-2">
                          PREV: {record.previousHolderUsername} (
                          {formatRecordValue(record.record_type, record.previous_value!)})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatRecordValue(record_type: string, value: string): string {
  const num = parseInt(value, 10)
  if (record_type.includes('wealth') || record_type.includes('rob')) {
    return '$' + num.toLocaleString()
  }
  if (record_type.includes('streak')) {
    return num + ' DAYS'
  }
  return num.toLocaleString()
}
