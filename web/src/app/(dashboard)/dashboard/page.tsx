'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber, CurrencyDisplay, XPDisplay, StatValue } from '@/components/ui/kinetic-number'
import { PageLoader, InitializingText } from '@/components/ui/initializing-loader'
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

// =============================================================================
// DASHBOARD PAGE
// Bento Grid Layout with Cyberpunk Diegetic Interface
// =============================================================================

export default function DashboardPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/users/me/stats'),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.data)
        }

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.data)
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
        setCheckInResult({ success: true, message: `+${data.data.xpAwarded} XP, +$${data.data.wealthAwarded}!` })
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

  const xpForNextLevel = (level: number) => Math.floor(100 * Math.pow(1.25, level - 1))
  const xpProgress = profile ? (profile.xp / xpForNextLevel(profile.level + 1)) * 100 : 0

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
            <span className="text-gradient-primary">
              {profile?.kingpin_name || session?.user?.name || 'OPERATOR'}
            </span>
          </h1>
          <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
            {'// EMPIRE OVERVIEW // '}
            <span className="text-[var(--color-primary)]">STATUS: ONLINE</span>
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
              {checkInResult.success ? '✓ SUCCESS' : '✗ ERROR'}
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
        {/* Hero Cell: Avatar/Identity (2x2) */}
        <Card
          variant="default"
          glow="primary"
          scanlines
          className="col-span-2 row-span-2 p-6"
        >
          <div className="h-full flex flex-col">
            {/* Player Identity */}
            <div className="flex items-start gap-4 mb-6">
              {/* Avatar Placeholder */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-[var(--color-primary)] bg-[var(--color-surface)] flex items-center justify-center">
                <span className="font-display text-3xl sm:text-4xl text-[var(--color-primary)]">
                  {(profile?.kingpin_name || 'K')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="font-display text-lg sm:text-xl uppercase tracking-wider text-[var(--color-primary)]">
                  {profile?.kingpin_name || 'UNKNOWN'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <TierBadge tier={profile?.tier || 'Rookie'} />
                  <span className="font-mono text-sm text-[var(--color-muted)]">
                    LVL {profile?.level || 1}
                  </span>
                </div>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  EXPERIENCE
                </span>
                <span className="font-mono text-xs text-[var(--color-primary)]">
                  <KineticNumber value={profile?.xp || 0} /> / {xpForNextLevel((profile?.level || 0) + 1)}
                </span>
              </div>
              <div className="h-2 bg-[var(--color-surface)] border border-[var(--color-primary)]/30">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-500"
                  style={{ width: `${Math.min(xpProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Check-in Streak */}
            <div className="mt-auto flex items-center gap-3 p-3 bg-[var(--color-surface)]/50 border border-[var(--color-warning)]/30">
              <FlameIcon className="w-6 h-6 text-[var(--color-warning)]" />
              <div>
                <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                  STREAK
                </span>
                <span className="font-mono text-lg text-[var(--color-warning)]">
                  <KineticNumber value={profile?.checkInStreak || 0} suffix=" DAYS" />
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Cash Cell (1x1) */}
        <Card variant="solid" className="p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <DollarIcon className="w-5 h-5 text-[var(--color-warning)]" />
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
              WEALTH
            </span>
          </div>
          <CurrencyDisplay value={profile?.wealth || 0} size="lg" />
        </Card>

        {/* Level Cell (1x1) */}
        <Card variant="solid" className="p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <StarIcon className="w-5 h-5 text-[var(--color-primary)]" />
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
              LEVEL
            </span>
          </div>
          <span className="font-mono text-3xl font-bold text-[var(--color-primary)]">
            <KineticNumber value={profile?.level || 1} />
          </span>
        </Card>

        {/* Linked Accounts (2x1) */}
        <Card variant="solid" className="col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
              LINKED SYSTEMS
            </span>
            <Link
              href="/profile"
              className="font-mono text-xs text-[var(--color-primary)] hover:underline"
            >
              MANAGE →
            </Link>
          </div>
          <div className="flex gap-2">
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
        </Card>

        {/* Criminal Record (2x1) */}
        <Card variant="default" className="col-span-2 lg:col-span-2 p-4">
          <CardHeader className="p-0 pb-3 border-none">
            <CardTitle className="text-sm">CRIMINAL RECORD</CardTitle>
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
        <Card variant="default" className="col-span-2 lg:col-span-2 p-4">
          <CardHeader className="p-0 pb-3 border-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">PROGRESS</CardTitle>
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
      <Card variant="solid" className="p-4">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle className="text-sm">QUICK ACTIONS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickActionLink href="/inventory" icon={<BackpackIcon />} label="INVENTORY" />
            <QuickActionLink href="/shop" icon={<StoreIcon />} label="SHOP" />
            <QuickActionLink href="/missions" icon={<TargetIcon />} label="MISSIONS" />
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
        'touch-target'
      )}
    >
      <span className="text-[var(--color-primary)]">{icon}</span>
      <span className="font-display text-xs uppercase tracking-wider">{label}</span>
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

function TargetIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
