'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber, CurrencyDisplay, XPDisplay, StatValue } from '@/components/ui/kinetic-number'
import { PageLoader, InitializingText } from '@/components/ui/initializing-loader'
import { FlickerText, GlitchText, DataStream } from '@/components/ui/terminal-overlay'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface UserProfile {
  id: string
  kingpin_name: string | null
  wealth: number
  level: number
  xp: number
  tier: string
  checkInStreak: number
  lastCheckIn: string | null
  created_at: string
  linkedAccounts: {
    kick: { username: string } | null
    twitch: { username: string } | null
    discord: { username: string } | null
  }
}

interface UserStats {
  totalRobberies: number
  successfulRobberies: number
  timesRobbed: number
  itemsOwned: number
  achievementsUnlocked: number
  missionsCompleted: number
  totalDonated: number
  juicernautWins: number
}

interface Mission {
  id: number
  current_progress: number
  objective_value: number
  is_completed: boolean
  template: {
    name: string
    description: string
    difficulty: string
  } | null
}

interface MissionsData {
  daily: Mission[]
  weekly: Mission[]
  dailyExpiresAt: string | null
  weeklyExpiresAt: string | null
}

interface ActiveBuff {
  id: number
  buffType: string
  category: string | null
  multiplier: number
  source: string
  description: string | null
  remainingMinutes: number | null
  expiresAt: string | null
}

interface BuffsData {
  buffs: ActiveBuff[]
  totalActive: number
}

// =============================================================================
// DASHBOARD PAGE
// Bento Grid Layout with Cyberpunk Diegetic Interface
// =============================================================================

export default function DashboardPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [missions, setMissions] = useState<MissionsData | null>(null)
  const [buffs, setBuffs] = useState<BuffsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, statsRes, missionsRes, buffsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/users/me/stats'),
          fetch('/api/missions'),
          fetch('/api/users/me/buffs'),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.data)
        }

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.data)
        }

        if (missionsRes.ok) {
          const data = await missionsRes.json()
          setMissions(data.data)
        }

        if (buffsRes.ok) {
          const data = await buffsRes.json()
          setBuffs(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleCheckIn = async () => {
    setCheckingIn(true)
    setCheckInResult(null)

    try {
      const res = await fetch('/api/users/me/checkin', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setCheckInResult({ success: true, message: `+${data.data.xp_earned} XP, +$${data.data.wealth_earned}!` })
        const profileRes = await fetch('/api/users/me')
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile(profileData.data)
        }
      } else {
        setCheckInResult({ success: false, message: data.error || 'Check-in failed' })
      }
    } catch {
      setCheckInResult({ success: false, message: 'NETWORK ERROR' })
    } finally {
      setCheckingIn(false)
    }
  }

  const canCheckIn = () => {
    if (!profile?.lastCheckIn) return true
    const lastCheckIn = new Date(profile.lastCheckIn)
    const now = new Date()
    return lastCheckIn.toDateString() !== now.toDateString()
  }

  // XP calculation helpers (matching formulas.ts)
  const xpForLevel = (level: number) => Math.floor(100 * Math.pow(1.25, level - 1))
  const totalXpForLevel = (level: number) => {
    let total = 0
    for (let i = 1; i <= level; i++) {
      total += xpForLevel(i)
    }
    return total
  }

  // Calculate XP progress within current level
  const getXpProgress = () => {
    if (!profile) return { current: 0, required: 100, percentage: 0 }
    const xpToReachCurrentLevel = totalXpForLevel(profile.level - 1)
    const xpNeededForThisLevel = xpForLevel(profile.level)
    const progressInLevel = profile.xp - xpToReachCurrentLevel
    return {
      current: Math.max(0, progressInLevel),
      required: xpNeededForThisLevel,
      percentage: Math.min(100, (progressInLevel / xpNeededForThisLevel) * 100),
    }
  }
  const xpProgressData = getXpProgress()

  if (loading) {
    return <PageLoader message="LOADING EMPIRE DATA" />
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[var(--color-foreground)]">
            Welcome back,{' '}
            <span className="text-gradient-primary hover-text-glitch idle-glitch-text">
              {profile?.kingpin_name || session?.user?.name || 'OPERATOR'}
            </span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// EMPIRE OVERVIEW // '}
            <FlickerText delay={2}>
              <span className="text-[var(--color-primary)]">STATUS: ONLINE</span>
            </FlickerText>
          </p>
        </div>
        <Button
          onClick={handleCheckIn}
          disabled={checkingIn || !canCheckIn()}
          variant={canCheckIn() ? 'default' : 'ghost'}
          size="lg"
          className={cn(
            canCheckIn() && 'glow-primary'
          )}
        >
          {checkingIn ? (
            <InitializingText text="PROCESSING" className="text-xs" />
          ) : canCheckIn() ? (
            'DAILY CHECK-IN'
          ) : (
            'CHECKED IN'
          )}
        </Button>
      </div>

      {/* Check-in Result Alert */}
      {checkInResult && (
        <Card
          variant="outlined"
          className={cn(
            'p-4',
            checkInResult.success
              ? 'border-[var(--color-success)] bg-[var(--color-success)]/5'
              : 'border-[var(--color-destructive)] bg-[var(--color-destructive)]/5 error-state'
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'font-display uppercase text-sm',
                checkInResult.success
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-destructive)]'
              )}
            >
              {checkInResult.success ? (
                '✓ SUCCESS'
              ) : (
                <GlitchText intensity="medium" mode="always">✗ ERROR</GlitchText>
              )}
            </span>
            <span className="font-mono">{checkInResult.message}</span>
            {checkInResult.success && profile && (
              <span className="text-[var(--color-muted)] font-mono text-sm ml-auto">
                STREAK: {profile.checkInStreak} DAYS
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ===== BENTO GRID LAYOUT ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero Cell: Player Summary (2x2) */}
        <Card
          variant="default"
          glow="primary"
          scanlines
          className="col-span-2 row-span-2 p-6 card-glitch-1"
        >
          <div className="h-full flex flex-col">
            {/* Player Identity */}
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar Placeholder */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-[var(--color-primary)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                <span className="font-display text-2xl sm:text-3xl text-[var(--color-primary)]">
                  {(profile?.kingpin_name || 'K')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-base sm:text-lg uppercase tracking-wider text-[var(--color-primary)] truncate">
                  {profile?.kingpin_name || 'UNKNOWN'}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <TierBadge tier={profile?.tier || 'Rookie'} />
                  <span className="font-mono text-sm text-[var(--color-muted)]">
                    LVL {profile?.level || 1}
                  </span>
                </div>
                {/* Wealth in header area */}
                <div className="mt-2 flex items-center gap-2">
                  <DollarIcon className="w-4 h-4 text-[var(--color-warning)]" />
                  <CurrencyDisplay value={profile?.wealth || 0} size="sm" />
                </div>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  EXPERIENCE
                </span>
                <span className="font-mono text-xs text-[var(--color-primary)]">
                  <KineticNumber value={xpProgressData.current} /> / {xpProgressData.required}
                </span>
              </div>
              <div className="h-2 bg-[var(--color-surface)] border border-[var(--color-primary)]/30">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-500"
                  style={{ width: `${xpProgressData.percentage}%` }}
                />
              </div>
            </div>

            {/* Check-in Streak */}
            <div className="flex items-center gap-3 p-2 bg-[var(--color-surface)]/50 border border-[var(--color-warning)]/30 mb-4">
              <FlameIcon className="w-5 h-5 text-[var(--color-warning)]" />
              <div className="flex-1">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  STREAK
                </span>
                <span className="font-mono text-base text-[var(--color-warning)] ml-2">
                  <KineticNumber value={profile?.checkInStreak || 0} suffix=" DAYS" />
                </span>
              </div>
            </div>

            {/* Linked Systems */}
            <div className="mt-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  LINKED SYSTEMS
                </span>
                <Link
                  href="/profile"
                  className="font-mono text-xs text-[var(--color-primary)] hover:underline"
                >
                  MANAGE
                </Link>
              </div>
              <div className="flex gap-2 flex-wrap">
                <AccountIndicator
                  platform="KICK"
                  connected={!!profile?.linkedAccounts?.kick}
                  color="#53fc18"
                />
                <AccountIndicator
                  platform="TWITCH"
                  connected={!!profile?.linkedAccounts?.twitch}
                  color="#9146FF"
                />
                <AccountIndicator
                  platform="DISCORD"
                  connected={!!profile?.linkedAccounts?.discord}
                  color="#5865F2"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Daily Mission Progress (1x1) */}
        <Card variant="solid" className="p-4 flex flex-col hover-card-glitch">
          <div className="flex items-center gap-2 mb-3">
            <TargetIcon className="w-5 h-5 text-[var(--color-success)]" />
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] hover-text-glitch">
              DAILY MISSIONS
            </span>
          </div>
          <MissionProgressDisplay missions={missions?.daily || []} type="daily" />
        </Card>

        {/* Weekly Mission Progress (1x1) */}
        <Card variant="solid" className="p-4 flex flex-col hover-card-glitch">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-[var(--color-secondary)]" />
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] hover-text-glitch">
              WEEKLY MISSIONS
            </span>
          </div>
          <MissionProgressDisplay missions={missions?.weekly || []} type="weekly" />
        </Card>

        {/* Active Buffs (2x1) */}
        <Card variant="solid" className="col-span-2 p-4 hover-card-glitch">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ZapIcon className="w-5 h-5 text-[var(--color-primary)]" />
              <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                ACTIVE BUFFS
              </span>
            </div>
            <Link
              href="/shop"
              className="font-mono text-xs text-[var(--color-primary)] hover:underline"
            >
              SHOP →
            </Link>
          </div>
          <ActiveBuffsDisplay buffs={buffs?.buffs || []} />
        </Card>

        {/* Criminal Record (2x1) */}
        <Card variant="default" className="col-span-2 lg:col-span-2 p-4 card-glitch-5 hover-card-glitch">
          <CardHeader className="p-0 pb-3 border-none">
            <CardTitle className="text-sm hover-text-glitch">CRIMINAL RECORD</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatValue
                label="ROBBERIES"
                value={stats?.totalRobberies || 0}
                valueClassName="text-[var(--color-secondary)]"
              />
              <StatValue
                label="SUCCESS RATE"
                value={stats?.totalRobberies ? Math.round((stats.successfulRobberies / stats.totalRobberies) * 100) : 0}
                suffix="%"
                valueClassName="text-[var(--color-success)]"
              />
              <StatValue
                label="TIMES ROBBED"
                value={stats?.timesRobbed || 0}
                valueClassName="text-[var(--color-destructive)]"
              />
              <StatValue
                label="ITEMS OWNED"
                value={stats?.itemsOwned || 0}
                valueClassName="text-[var(--color-primary)]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Progress (2x1) */}
        <Card variant="default" className="col-span-2 lg:col-span-2 p-4 hover-card-glitch">
          <CardHeader className="p-0 pb-3 border-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm hover-text-glitch">PROGRESS</CardTitle>
              <Link
                href="/achievements"
                className="font-mono text-xs text-[var(--color-primary)] hover:underline"
              >
                VIEW ALL →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatValue
                label="ACHIEVEMENTS"
                value={stats?.achievementsUnlocked || 0}
                valueClassName="text-[var(--color-warning)]"
              />
              <StatValue
                label="MISSIONS"
                value={stats?.missionsCompleted || 0}
                valueClassName="text-[var(--color-success)]"
              />
              <StatValue
                label="DONATED"
                value={stats?.totalDonated || 0}
                prefix="$"
                valueClassName="text-[var(--color-secondary)]"
              />
              <StatValue
                label="JUICERNAUT"
                value={stats?.juicernautWins || 0}
                valueClassName="text-[var(--color-primary)]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="solid" className="p-4 card-glitch">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle className="text-sm hover-text-glitch">QUICK ACTIONS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickActionLink href="/inventory" icon={<BackpackIcon />} label="INVENTORY" />
            <QuickActionLink href="/shop" icon={<StoreIcon />} label="SHOP" />
            <QuickActionLink href="/shop#stream-actions" icon={<BroadcastIcon />} label="STREAM ACTIONS" />
            <QuickActionLink href="/crates" icon={<BoxIcon />} label="CRATES" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function TierBadge({ tier }: { tier: string }) {
  const tierColors: Record<string, string> = {
    Rookie: 'var(--tier-common)',
    Enforcer: 'var(--tier-uncommon)',
    Capo: 'var(--tier-rare)',
    Boss: 'var(--tier-rare)',
    Kingpin: 'var(--tier-legendary)',
  }
  const color = tierColors[tier] || 'var(--tier-common)'

  return (
    <span
      className="font-display text-xs uppercase tracking-wider px-2 py-0.5 border"
      style={{ color, borderColor: color }}
    >
      {tier}
    </span>
  )
}

function AccountIndicator({
  platform,
  connected,
  color,
}: {
  platform: string
  connected: boolean
  color: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 border font-mono text-xs uppercase',
        connected ? 'opacity-100' : 'opacity-40'
      )}
      style={{
        borderColor: connected ? color : 'var(--color-muted)',
        color: connected ? color : 'var(--color-muted)',
      }}
    >
      <div
        className="w-2 h-2"
        style={{ backgroundColor: connected ? color : 'var(--color-muted)' }}
      />
      {platform}
    </div>
  )
}

function QuickActionLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-2 p-4',
        'bg-[var(--color-surface)] border-2 border-[var(--color-primary)]/20',
        'hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5',
        'transition-all duration-150',
        'touch-target',
        'hover-card-glitch'
      )}
    >
      <span className="text-[var(--color-primary)]">{icon}</span>
      <span className="font-display text-xs uppercase tracking-wider hover-text-glitch">{label}</span>
    </Link>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  )
}

function BackpackIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function StoreIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function BroadcastIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  )
}

// =============================================================================
// MISSION PROGRESS DISPLAY
// =============================================================================

function MissionProgressDisplay({
  missions,
  type,
}: {
  missions: Mission[]
  type: 'daily' | 'weekly'
}) {
  const accentColor = type === 'daily' ? 'var(--color-success)' : 'var(--color-secondary)'

  if (missions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
        <span className="font-mono text-xs text-[var(--color-muted)]">
          NO {type.toUpperCase()} MISSIONS
        </span>
        <Link
          href="/missions"
          className="font-mono text-xs text-[var(--color-primary)] hover:underline mt-1"
        >
          VIEW MISSIONS →
        </Link>
      </div>
    )
  }

  const completed = missions.filter((m) => m.is_completed).length
  const total = missions.length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Individual Mission Progress */}
      <div className="flex-1 space-y-2 overflow-hidden">
        {missions.slice(0, 3).map((mission, idx) => {
          const progress = Math.min((mission.current_progress / mission.objective_value) * 100, 100)
          const missionName = mission.template?.name || `Mission ${idx + 1}`

          return (
            <div key={mission.id} className="space-y-1">
              {/* Mission Name & Progress Numbers */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-[var(--color-foreground)] truncate flex-1" title={missionName}>
                  {missionName.length > 16 ? missionName.slice(0, 16) + '...' : missionName}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-muted)] shrink-0">
                  {mission.current_progress}/{mission.objective_value}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 bg-[var(--color-surface)] border border-[var(--color-border)]">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    mission.is_completed && "animate-pulse"
                  )}
                  style={{
                    width: `${progress}%`,
                    backgroundColor: mission.is_completed ? accentColor : `color-mix(in srgb, ${accentColor} 70%, transparent)`
                  }}
                />
              </div>
            </div>
          )
        })}

        {/* Show overflow indicator if more than 3 missions */}
        {missions.length > 3 && (
          <div className="text-center">
            <span className="font-mono text-[10px] text-[var(--color-muted)]">
              +{missions.length - 3} more
            </span>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between pt-2 mt-auto border-t border-[var(--color-border)]">
        <span className={cn(
          "font-display text-[10px] uppercase tracking-wider",
          completed === total ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"
        )}>
          {completed === total ? (
            <span className="flex items-center gap-1">
              <CheckIcon className="w-3 h-3" />
              ALL DONE
            </span>
          ) : (
            `${completed}/${total} DONE`
          )}
        </span>
        <Link
          href="/missions"
          className="font-mono text-[10px] text-[var(--color-primary)] hover:underline"
        >
          VIEW →
        </Link>
      </div>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

// =============================================================================
// ACTIVE BUFFS DISPLAY
// =============================================================================

function ActiveBuffsDisplay({ buffs }: { buffs: ActiveBuff[] }) {
  if (buffs.length === 0) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="font-mono text-xs text-[var(--color-muted)]">
          NO ACTIVE BUFFS
        </span>
      </div>
    )
  }

  // Show up to 4 buffs
  const displayBuffs = buffs.slice(0, 4)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {displayBuffs.map((buff) => (
        <div
          key={buff.id}
          className="flex flex-col items-center p-2 bg-[var(--color-surface)] border border-[var(--color-primary)]/30"
        >
          <div className="flex items-center gap-1 mb-1">
            <ZapIcon className="w-3 h-3 text-[var(--color-primary)]" />
            <span className="font-mono text-xs font-bold text-[var(--color-primary)]">
              {buff.multiplier > 1 ? `+${Math.round((buff.multiplier - 1) * 100)}%` : `${Math.round(buff.multiplier * 100)}%`}
            </span>
          </div>
          <span className="font-display text-[10px] uppercase tracking-wider text-[var(--color-muted)] text-center truncate w-full">
            {buff.category || buff.buffType}
          </span>
          {buff.remainingMinutes !== null && (
            <span className="font-mono text-[10px] text-[var(--color-warning)]">
              {buff.remainingMinutes < 60
                ? `${buff.remainingMinutes}m`
                : `${Math.floor(buff.remainingMinutes / 60)}h`}
            </span>
          )}
        </div>
      ))}
      {buffs.length > 4 && (
        <div className="flex items-center justify-center p-2 bg-[var(--color-surface)] border border-[var(--color-primary)]/30">
          <span className="font-mono text-xs text-[var(--color-primary)]">
            +{buffs.length - 4} MORE
          </span>
        </div>
      )}
    </div>
  )
}
