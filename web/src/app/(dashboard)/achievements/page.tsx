'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

interface Achievement {
  id: number
  name: string
  key: string
  description: string
  category: string
  tier: string
  requirement_type: string
  requirement_value: string
  reward_wealth: number
  reward_xp: number
  reward_title: string | null
  is_hidden: boolean
  current_progress: string
  is_completed: boolean
  completed_at: string | null
}

interface AchievementCategory {
  category: string
  achievements: Achievement[]
  totalCount: number
  completedCount: number
}

interface AchievementStats {
  total: number
  completed: number
  percentage: number
  byTier: Record<string, { total: number; completed: number }>
}

interface RecentUnlock {
  name: string
  key: string
  tier: string
  completed_at: string
}

const CATEGORY_INFO: Record<string, { name: string; icon: string; color: string }> = {
  wealth: { name: 'Wealth', icon: '💰', color: 'text-yellow-400' },
  combat: { name: 'Combat', icon: '⚔️', color: 'text-red-400' },
  loyalty: { name: 'Loyalty', icon: '❤️', color: 'text-pink-400' },
  progression: { name: 'Progression', icon: '📈', color: 'text-green-400' },
  activity: { name: 'Activity', icon: '🎮', color: 'text-blue-400' },
  social: { name: 'Social', icon: '👥', color: 'text-cyan-400' },
  juicernaut: { name: 'Juicernaut', icon: '👑', color: 'text-purple-400' },
  special: { name: 'Special', icon: '⭐', color: 'text-orange-400' },
  faction: { name: 'Faction', icon: '🏴', color: 'text-gray-400' },
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-900 border-amber-600',
  silver: 'from-gray-400 to-gray-600 border-gray-400',
  gold: 'from-yellow-500 to-yellow-700 border-yellow-400',
  platinum: 'from-cyan-400 to-cyan-600 border-cyan-400',
  legendary: 'from-purple-500 to-purple-700 border-purple-400',
}

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  legendary: '👑',
}

export default function AchievementsPage() {
  const { data: session } = useSession()
  const [categories, setCategories] = useState<AchievementCategory[]>([])
  const [stats, setStats] = useState<AchievementStats | null>(null)
  const [recentUnlocks, setRecentUnlocks] = useState<RecentUnlock[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAchievements() {
      try {
        const res = await fetch('/api/achievements')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.data.categories)
          setStats(data.data.stats)
          setRecentUnlocks(data.data.recentUnlocks)
          if (data.data.categories.length > 0) {
            setActiveCategory(data.data.categories[0].category)
          }
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAchievements()
  }, [])

  const getProgressPercent = (current: string, target: string): number => {
    const c = parseInt(current, 10) || 0
    const t = parseInt(target, 10) || 1
    return Math.min(100, Math.round((c / t) * 100))
  }

  const formatValue = (value: string): string => {
    const num = parseInt(value, 10)
    if (isNaN(num)) return value
    return num.toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const activeAchievements = categories.find(c => c.category === activeCategory)?.achievements || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          <span className="text-gradient">Achievements</span>
        </h1>
        <p className="text-gray-400 mt-1">Track your progress and earn rewards</p>
      </div>

      {/* Overall Progress */}
      {stats && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Total Progress */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2">Total Progress</h2>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-lg font-bold">
                  {stats.completed} / {stats.total}
                </span>
              </div>
            </div>

            {/* Tier Breakdown */}
            <div className="flex gap-4">
              {Object.entries(stats.byTier).map(([tier, data]) => (
                <div key={tier} className="text-center">
                  <div className="text-xl mb-1">{TIER_ICONS[tier]}</div>
                  <div className="text-sm">
                    <span className="text-white font-semibold">{data.completed}</span>
                    <span className="text-gray-500">/{data.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Unlocks */}
      {recentUnlocks.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Unlocks</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentUnlocks.map((unlock, index) => (
              <div
                key={index}
                className={`flex-shrink-0 px-4 py-2 rounded-lg border bg-gradient-to-r ${
                  TIER_COLORS[unlock.tier] || 'from-gray-700 to-gray-800 border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{TIER_ICONS[unlock.tier] || '🏅'}</span>
                  <span className="font-semibold">{unlock.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const info = CATEGORY_INFO[cat.category] || { name: cat.category, icon: '📋', color: 'text-gray-400' }
          return (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeCategory === cat.category
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span>{info.icon}</span>
              <span>{info.name}</span>
              <span className="text-xs opacity-75">
                {cat.completedCount}/{cat.totalCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeAchievements.map((achievement) => {
          // Hide locked hidden achievements
          if (achievement.is_hidden && !achievement.is_completed) {
            return (
              <div
                key={achievement.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">❓</div>
                  <div>
                    <h3 className="font-semibold text-gray-500">Hidden Achievement</h3>
                    <p className="text-sm text-gray-600">Keep playing to unlock...</p>
                  </div>
                </div>
              </div>
            )
          }

          const progressPercent = getProgressPercent(
            achievement.current_progress,
            achievement.requirement_value
          )

          return (
            <div
              key={achievement.id}
              className={`relative bg-gray-800/50 border rounded-xl p-4 overflow-hidden ${
                achievement.is_completed
                  ? `border-l-4 ${TIER_COLORS[achievement.tier]?.split(' ')[0] || 'border-gray-600'}`
                  : 'border-gray-700'
              }`}
            >
              {/* Tier Badge */}
              <div className="absolute top-3 right-3">
                <span className="text-xl">{TIER_ICONS[achievement.tier] || '🏅'}</span>
              </div>

              {/* Content */}
              <div className="pr-10">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  {achievement.name}
                  {achievement.is_completed && (
                    <span className="text-green-400">✓</span>
                  )}
                </h3>
                <p className="text-sm text-gray-400 mb-3">{achievement.description}</p>

                {/* Progress */}
                {!achievement.is_completed && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>
                        {formatValue(achievement.current_progress)} / {formatValue(achievement.requirement_value)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Rewards */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-yellow-400">
                    +${achievement.reward_wealth.toLocaleString()}
                  </span>
                  <span className="text-purple-400">
                    +{achievement.reward_xp} XP
                  </span>
                  {achievement.reward_title && (
                    <span className="text-cyan-400 text-xs bg-cyan-400/10 px-2 py-0.5 rounded">
                      Title: {achievement.reward_title}
                    </span>
                  )}
                </div>

                {/* Completion Date */}
                {achievement.is_completed && achievement.completed_at && (
                  <p className="text-xs text-gray-500 mt-2">
                    Completed: {new Date(achievement.completed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {activeAchievements.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No achievements in this category
        </div>
      )}
    </div>
  )
}
