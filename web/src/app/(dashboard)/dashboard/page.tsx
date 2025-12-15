'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface UserProfile {
  id: string
  kingpinName: string | null
  wealth: number
  level: number
  xp: number
  tier: string
  checkInStreak: number
  lastCheckIn: string | null
  createdAt: string
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
        // Refresh profile to get updated values
        const profileRes = await fetch('/api/users/me')
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile(profileData.data)
        }
      } else {
        setCheckInResult({ success: false, message: data.error || 'Check-in failed' })
      }
    } catch (error) {
      setCheckInResult({ success: false, message: 'Network error' })
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, <span className="text-gradient">{profile?.kingpinName || session?.user?.name || 'Player'}</span>
          </h1>
          <p className="text-gray-400 mt-1">Here's your empire overview</p>
        </div>
        <button
          onClick={handleCheckIn}
          disabled={checkingIn || !canCheckIn()}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            canCheckIn()
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
              : 'bg-gray-700 cursor-not-allowed'
          }`}
        >
          {checkingIn ? 'Checking in...' : canCheckIn() ? 'Daily Check-in' : 'Already Checked In'}
        </button>
      </div>

      {/* Check-in Result */}
      {checkInResult && (
        <div
          className={`p-4 rounded-lg ${
            checkInResult.success
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {checkInResult.message}
          {checkInResult.success && profile && (
            <span className="ml-2 text-gray-400">Streak: {profile.checkInStreak} days</span>
          )}
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wealth */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <DollarIcon className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">Wealth</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">${profile?.wealth.toLocaleString() || 0}</p>
        </div>

        {/* Level */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <StarIcon className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-sm">Level</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{profile?.level || 1}</p>
          <div className="mt-2">
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                style={{ width: `${Math.min(xpProgress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{profile?.xp || 0} / {xpForNextLevel((profile?.level || 0) + 1)} XP</p>
          </div>
        </div>

        {/* Tier */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <CrownIcon className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-gray-400 text-sm">Rank</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{profile?.tier || 'Rookie'}</p>
        </div>

        {/* Check-in Streak */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <FlameIcon className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-gray-400 text-sm">Streak</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{profile?.checkInStreak || 0} days</p>
        </div>
      </div>

      {/* Stats & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Criminal Record */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Criminal Record</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="Robberies" value={stats?.totalRobberies || 0} />
            <StatItem label="Success Rate" value={`${stats?.totalRobberies ? Math.round((stats.successfulRobberies / stats.totalRobberies) * 100) : 0}%`} />
            <StatItem label="Times Robbed" value={stats?.timesRobbed || 0} />
            <StatItem label="Items Owned" value={stats?.itemsOwned || 0} />
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Progress</h2>
            <Link href="/achievements" className="text-sm text-purple-400 hover:text-purple-300">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="Achievements" value={`${stats?.achievementsUnlocked || 0}/90+`} />
            <StatItem label="Missions Done" value={stats?.missionsCompleted || 0} />
            <StatItem label="Total Donated" value={`$${stats?.totalDonated || 0}`} />
            <StatItem label="Juicernaut Wins" value={stats?.juicernautWins || 0} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionLink href="/inventory" icon={<BackpackIcon className="w-5 h-5" />} label="Inventory" />
          <QuickActionLink href="/shop" icon={<StoreIcon className="w-5 h-5" />} label="Shop" />
          <QuickActionLink href="/missions" icon={<TargetIcon className="w-5 h-5" />} label="Missions" />
          <QuickActionLink href="/crates" icon={<BoxIcon className="w-5 h-5" />} label="Open Crates" />
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Linked Accounts</h2>
          <Link href="/profile" className="text-sm text-purple-400 hover:text-purple-300">
            Manage
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          <AccountBadge
            platform="Kick"
            username={profile?.linkedAccounts?.kick?.username}
            color="#53fc18"
          />
          <AccountBadge
            platform="Twitch"
            username={profile?.linkedAccounts?.twitch?.username}
            color="#9146FF"
          />
          <AccountBadge
            platform="Discord"
            username={profile?.linkedAccounts?.discord?.username}
            color="#5865F2"
          />
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function QuickActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
    >
      {icon}
      <span className="text-sm">{label}</span>
    </Link>
  )
}

function AccountBadge({ platform, username, color }: { platform: string; username?: string; color: string }) {
  const isLinked = !!username
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
        isLinked ? 'border-opacity-30' : 'border-gray-600 opacity-50'
      }`}
      style={{ borderColor: isLinked ? color : undefined, backgroundColor: isLinked ? `${color}10` : undefined }}
    >
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isLinked ? color : '#6b7280' }} />
      <span style={{ color: isLinked ? color : '#9ca3af' }}>{platform}</span>
      {isLinked && <span className="text-gray-400 text-sm">@{username}</span>}
    </div>
  )
}

// Icons
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

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l3.3-5.5a1 1 0 011.7 0l2.5 4.167 2.5-4.167a1 1 0 011.7 0l3.3 5.5M4.5 12.75v4.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-4.5" />
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

function BackpackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}
