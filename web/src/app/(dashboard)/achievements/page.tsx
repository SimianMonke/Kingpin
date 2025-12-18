'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber } from '@/components/ui/kinetic-number'
import { PageLoader } from '@/components/ui/initializing-loader'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_INFO: Record<string, { name: string; icon: string; description: string }> = {
  wealth: { name: 'WEALTH', icon: '💰', description: 'Earn and accumulate riches' },
  experience: { name: 'EXPERIENCE', icon: '📈', description: 'Level up and gain XP' },
  crime: { name: 'CRIME', icon: '🔫', description: 'Master the art of robbery' },
  social: { name: 'SOCIAL', icon: '👥', description: 'Engage with the community' },
  collection: { name: 'COLLECTION', icon: '🎁', description: 'Collect items and titles' },
  dedication: { name: 'DEDICATION', icon: '❤️', description: 'Show your loyalty' },
  special: { name: 'SPECIAL', icon: '⭐', description: 'One-time events' },
  seasonal: { name: 'SEASONAL', icon: '🎄', description: 'Limited time achievements' },
  secret: { name: 'SECRET', icon: '🔒', description: 'Hidden achievements' },
  // Legacy categories for backwards compatibility
  combat: { name: 'COMBAT', icon: '⚔️', description: 'Fight and defend' },
  loyalty: { name: 'LOYALTY', icon: '❤️', description: 'Show your dedication' },
  progression: { name: 'PROGRESSION', icon: '📈', description: 'Level up and advance' },
  activity: { name: 'ACTIVITY', icon: '🎮', description: 'Stay active' },
  juicernaut: { name: 'JUICERNAUT', icon: '👑', description: 'Dominate events' },
  faction: { name: 'FACTION', icon: '🏴', description: 'Faction achievements' },
}

// Category display order
const CATEGORY_ORDER = [
  'wealth',
  'experience',
  'crime',
  'dedication',
  'social',
  'collection',
  'faction',
  'juicernaut',
  'special',
  'seasonal',
  'secret',
  // Legacy
  'combat',
  'loyalty',
  'progression',
  'activity',
]

const TIER_STYLES: Record<string, { color: string; border: string; bg: string; icon: string }> = {
  bronze: {
    color: '#CD7F32',
    border: 'border-[#CD7F32]/50',
    bg: 'bg-[#CD7F32]/5',
    icon: '🥉',
  },
  silver: {
    color: '#C0C0C0',
    border: 'border-[#C0C0C0]/50',
    bg: 'bg-[#C0C0C0]/5',
    icon: '🥈',
  },
  gold: {
    color: 'var(--tier-legendary)',
    border: 'border-[var(--tier-legendary)]/50',
    bg: 'bg-[var(--tier-legendary)]/5',
    icon: '🥇',
  },
  platinum: {
    color: 'var(--color-primary)',
    border: 'border-[var(--color-primary)]/50',
    bg: 'bg-[var(--color-primary)]/5',
    icon: '💎',
  },
  legendary: {
    color: 'var(--color-secondary)',
    border: 'border-[var(--color-secondary)]/50',
    bg: 'bg-[var(--color-secondary)]/5',
    icon: '👑',
  },
}

// Tier display order (for sorting achievements within category)
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'legendary']

// =============================================================================
// ACHIEVEMENT CARD COMPONENT
// =============================================================================

function AchievementCard({ achievement }: { achievement: Achievement }) {
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

  // Hidden achievements that aren't completed
  if (achievement.is_hidden && !achievement.is_completed) {
    return (
      <Card variant="solid" className="p-4 opacity-50">
        <div className="flex items-center gap-3">
          <div className="text-2xl">❓</div>
          <div>
            <h3 className="font-display uppercase tracking-wider text-[var(--color-muted)]">
              HIDDEN ACHIEVEMENT
            </h3>
            <p className="font-mono text-sm text-[var(--color-muted)]/70">
              Keep playing to unlock...
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const progressPercent = getProgressPercent(
    achievement.current_progress,
    achievement.requirement_value
  )
  const style = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze

  return (
    <Card
      variant="solid"
      className={cn(
        'p-4 overflow-hidden transition-all duration-200',
        achievement.is_completed && style.border,
        achievement.is_completed && 'border-l-4',
        !achievement.is_completed && 'hover:border-[var(--color-primary)]/30'
      )}
    >
      {/* Header with name and tier */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-display uppercase tracking-wider truncate flex items-center gap-2">
            {achievement.name}
            {achievement.is_completed && (
              <span className="text-[var(--color-success)]">✓</span>
            )}
          </h3>
          <p className="font-mono text-sm text-[var(--color-muted)] mt-1">
            {achievement.description}
          </p>
        </div>
        <span className="text-xl flex-shrink-0">{style.icon}</span>
      </div>

      {/* Progress bar - always show for incomplete achievements */}
      {!achievement.is_completed && (
        <div className="mb-3">
          <div className="flex items-center justify-between font-mono text-xs text-[var(--color-muted)] mb-1">
            <span>PROGRESS</span>
            <span className="tabular-nums">
              {formatValue(achievement.current_progress)} / {formatValue(achievement.requirement_value)}
            </span>
          </div>
          <div className="h-2 bg-[var(--color-surface)] border border-[var(--color-primary)]/20 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                progressPercent >= 100
                  ? 'bg-[var(--color-success)]'
                  : progressPercent >= 75
                  ? 'bg-[var(--color-warning)]'
                  : 'bg-[var(--color-primary)]'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-right font-mono text-xs text-[var(--color-muted)] mt-1">
            {progressPercent}%
          </div>
        </div>
      )}

      {/* Rewards */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
        <span className="text-[var(--color-warning)]">
          +${achievement.reward_wealth.toLocaleString()}
        </span>
        <span className="text-[var(--color-primary)]">
          +{achievement.reward_xp} XP
        </span>
        {achievement.reward_title && (
          <span className="text-[var(--color-secondary)] text-xs px-2 py-0.5 border border-[var(--color-secondary)]/30">
            TITLE: {achievement.reward_title}
          </span>
        )}
      </div>

      {/* Completion Date */}
      {achievement.is_completed && achievement.completed_at && (
        <p className="font-mono text-xs text-[var(--color-muted)] mt-3">
          COMPLETED: {new Date(achievement.completed_at).toLocaleDateString().toUpperCase()}
        </p>
      )}
    </Card>
  )
}

// =============================================================================
// CATEGORY SECTION COMPONENT
// =============================================================================

function CategorySection({
  category,
  onRefSet
}: {
  category: AchievementCategory
  onRefSet: (el: HTMLDivElement | null) => void
}) {
  const info = CATEGORY_INFO[category.category] || {
    name: category.category.toUpperCase(),
    icon: '📋',
    description: 'Achievements'
  }

  // Sort achievements: incomplete first (sorted by progress %), then completed (sorted by completion date)
  const sortedAchievements = [...category.achievements].sort((a, b) => {
    // Completed achievements go last
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1
    }

    // For incomplete, sort by tier order then by progress percentage (descending)
    if (!a.is_completed && !b.is_completed) {
      const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
      if (tierDiff !== 0) return tierDiff

      const aProgress = parseInt(a.current_progress, 10) / parseInt(a.requirement_value, 10)
      const bProgress = parseInt(b.current_progress, 10) / parseInt(b.requirement_value, 10)
      return bProgress - aProgress // Higher progress first
    }

    // For completed, sort by completion date (most recent first)
    if (a.completed_at && b.completed_at) {
      return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    }

    return 0
  })

  const completionPercent = Math.round((category.completedCount / category.totalCount) * 100) || 0

  return (
    <div ref={onRefSet} className="scroll-mt-20">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <h2 className="font-display text-lg uppercase tracking-wider">
              {info.name}
            </h2>
            <p className="font-mono text-xs text-[var(--color-muted)]">
              {info.description}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm">
            <span className="font-bold">{category.completedCount}</span>
            <span className="text-[var(--color-muted)]"> / {category.totalCount}</span>
          </div>
          <div className="w-24 h-1.5 bg-[var(--color-surface)] border border-[var(--color-primary)]/20 mt-1">
            <div
              className={cn(
                'h-full transition-all',
                completionPercent === 100
                  ? 'bg-[var(--color-success)]'
                  : 'bg-[var(--color-primary)]'
              )}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAchievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// ACHIEVEMENTS PAGE
// =============================================================================

export default function AchievementsPage() {
  const [categories, setCategories] = useState<AchievementCategory[]>([])
  const [stats, setStats] = useState<AchievementStats | null>(null)
  const [recentUnlocks, setRecentUnlocks] = useState<RecentUnlock[]>([])
  const [loading, setLoading] = useState(true)
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  useEffect(() => {
    async function fetchAchievements() {
      try {
        const res = await fetch('/api/achievements')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.data.categories)
          setStats(data.data.stats)
          setRecentUnlocks(data.data.recentUnlocks)
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAchievements()
  }, [])

  // Sort categories by predefined order
  const sortedCategories = [...categories].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.category)
    const bIndex = CATEGORY_ORDER.indexOf(b.category)
    // Unknown categories go to the end
    const aOrder = aIndex === -1 ? 999 : aIndex
    const bOrder = bIndex === -1 ? 999 : bIndex
    return aOrder - bOrder
  })

  const scrollToCategory = (categoryName: string) => {
    const ref = sectionRefs.current.get(categoryName)
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (loading) {
    return <PageLoader message="LOADING ACHIEVEMENT DATA" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
          <span className="text-[var(--color-primary)]">ACHIEVEMENTS</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// TRACK PROGRESS AND EARN REWARDS'}
        </p>
      </div>

      {/* Overall Progress */}
      {stats && (
        <Card variant="default" glow="primary" className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Total Progress */}
            <div className="flex-1">
              <h2 className="font-display text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">
                TOTAL PROGRESS
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-[var(--color-surface)] border border-[var(--color-primary)]/30">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-lg font-bold">
                  <KineticNumber value={stats.completed} /> / {stats.total}
                </span>
              </div>
            </div>

            {/* Tier Breakdown */}
            <div className="flex gap-4">
              {Object.entries(stats.byTier).map(([tier, data]) => {
                const style = TIER_STYLES[tier] || TIER_STYLES.bronze
                return (
                  <div key={tier} className="text-center">
                    <div className="text-xl mb-1">{style.icon}</div>
                    <div className="font-mono text-sm">
                      <span className="font-bold">{data.completed}</span>
                      <span className="text-[var(--color-muted)]">/{data.total}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Recent Unlocks */}
      {recentUnlocks.length > 0 && (
        <Card variant="solid" className="p-6">
          <CardHeader className="p-0 pb-4 border-none">
            <CardTitle>RECENT UNLOCKS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentUnlocks.map((unlock, index) => {
                const style = TIER_STYLES[unlock.tier] || TIER_STYLES.bronze
                return (
                  <div
                    key={index}
                    className={cn('flex-shrink-0 px-4 py-2 border-2', style.border, style.bg)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{style.icon}</span>
                      <span className="font-display uppercase tracking-wider text-sm">
                        {unlock.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Quick Navigation */}
      <div className="sticky top-0 z-10 bg-[var(--color-background)]/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map((cat) => {
            const info = CATEGORY_INFO[cat.category] || { name: cat.category.toUpperCase(), icon: '📋', description: '' }
            const isComplete = cat.completedCount === cat.totalCount
            return (
              <Button
                key={cat.category}
                onClick={() => scrollToCategory(cat.category)}
                variant="ghost"
                size="sm"
                className={cn(
                  'transition-all',
                  isComplete && 'text-[var(--color-success)] border-[var(--color-success)]/30'
                )}
              >
                <span className="mr-2">{info.icon}</span>
                {info.name}
                <span className="ml-2 font-mono text-xs opacity-70">
                  {cat.completedCount}/{cat.totalCount}
                </span>
              </Button>
            )
          })}
        </div>
      </div>

      {/* All Categories */}
      <div className="space-y-10">
        {sortedCategories.map((category) => (
          <CategorySection
            key={category.category}
            category={category}
            onRefSet={(el) => {
              if (el) {
                sectionRefs.current.set(category.category, el)
              }
            }}
          />
        ))}
      </div>

      {/* Empty State */}
      {sortedCategories.length === 0 && (
        <div className="text-center py-12">
          <p className="font-mono text-[var(--color-muted)]">{'> NO ACHIEVEMENTS FOUND'}</p>
        </div>
      )}
    </div>
  )
}
