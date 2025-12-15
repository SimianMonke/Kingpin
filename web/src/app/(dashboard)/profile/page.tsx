'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
    kick: { username: string; id: string } | null
    twitch: { username: string; id: string } | null
    discord: { username: string; id: string } | null
  }
  equippedTitle: { id: string; name: string } | null
  faction: { id: string; name: string; color: string } | null
}

type Platform = 'kick' | 'twitch' | 'discord'

// Error and success message mappings
const LINK_MESSAGES: Record<string, { type: 'success' | 'error'; message: string }> = {
  linked: { type: 'success', message: 'Account linked successfully!' },
  already_linked: { type: 'success', message: 'Account is already linked to your profile.' },
  invalid_platform: { type: 'error', message: 'Invalid platform specified.' },
  invalid_state: { type: 'error', message: 'Link session expired. Please try again.' },
  invalid_callback: { type: 'error', message: 'Invalid OAuth callback. Please try again.' },
  platform_mismatch: { type: 'error', message: 'Platform mismatch error. Please try again.' },
  already_linked_other: { type: 'error', message: 'This account is already linked to another user.' },
  oauth_denied: { type: 'error', message: 'OAuth authorization was denied.' },
  link_failed: { type: 'error', message: 'Failed to link account. Please try again.' },
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [kingpinName, setKingpinName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [linkingPlatform, setLinkingPlatform] = useState<Platform | null>(null)
  const [unlinkingPlatform, setUnlinkingPlatform] = useState<Platform | null>(null)
  const [linkMessage, setLinkMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Handle URL parameters for link status messages
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const platform = searchParams.get('platform')

    if (success && LINK_MESSAGES[success]) {
      setLinkMessage(LINK_MESSAGES[success])
      // Clear URL params after reading
      window.history.replaceState({}, '', '/profile')
    } else if (error && LINK_MESSAGES[error]) {
      setLinkMessage(LINK_MESSAGES[error])
      window.history.replaceState({}, '', '/profile')
    }
  }, [searchParams])

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/users/me')
      if (res.ok) {
        const data = await res.json()
        setProfile(data.data)
        setKingpinName(data.data.kingpinName || '')
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!kingpinName.trim()) {
      setNameError('Name cannot be empty')
      return
    }

    if (kingpinName.length < 3 || kingpinName.length > 20) {
      setNameError('Name must be 3-20 characters')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(kingpinName)) {
      setNameError('Only letters, numbers, and underscores allowed')
      return
    }

    setSaving(true)
    setNameError(null)

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingpinName }),
      })

      const data = await res.json()

      if (res.ok) {
        setProfile(data.data)
        setEditingName(false)
      } else {
        setNameError(data.error || 'Failed to update name')
      }
    } catch (error) {
      setNameError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleLinkAccount = (platform: Platform) => {
    setLinkingPlatform(platform)
    setLinkMessage(null) // Clear any previous messages
    // Redirect to secure OAuth linking flow (SEC-01 fix)
    window.location.href = `/api/auth/link/${platform}`
  }

  const handleUnlinkAccount = async (platform: Platform) => {
    // Check if this is the only linked account
    const linkedCount = [
      profile?.linkedAccounts?.kick,
      profile?.linkedAccounts?.twitch,
      profile?.linkedAccounts?.discord,
    ].filter(Boolean).length

    if (linkedCount <= 1) {
      alert('You must have at least one linked account')
      return
    }

    if (!confirm(`Are you sure you want to unlink your ${platform} account?`)) {
      return
    }

    setUnlinkingPlatform(platform)

    try {
      const res = await fetch('/api/users/me/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })

      if (res.ok) {
        await fetchProfile()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to unlink account')
      }
    } catch (error) {
      alert('Network error')
    } finally {
      setUnlinkingPlatform(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

        {/* Kingpin Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Kingpin Name
          </label>
          {editingName ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={kingpinName}
                onChange={(e) => setKingpinName(e.target.value)}
                maxLength={20}
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
                placeholder="Enter your Kingpin name"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateName}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false)
                    setKingpinName(profile?.kingpinName || '')
                    setNameError(null)
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-xl font-semibold text-gradient">
                {profile?.kingpinName || 'Not set'}
              </span>
              <button
                onClick={() => setEditingName(true)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Edit
              </button>
            </div>
          )}
          {nameError && (
            <p className="mt-2 text-sm text-red-400">{nameError}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Your Kingpin name is how other players will see you in leaderboards and chat.
          </p>
        </div>

        {/* Account Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          <div>
            <span className="text-sm text-gray-400">Member Since</span>
            <p className="text-lg">{profile?.createdAt ? formatDate(profile.createdAt) : '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Current Tier</span>
            <p className="text-lg text-purple-400">{profile?.tier || 'Rookie'}</p>
          </div>
        </div>
      </div>

      {/* Equipped Title */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Equipped Title</h2>
          <a href="/achievements" className="text-sm text-purple-400 hover:text-purple-300">
            View All Titles
          </a>
        </div>
        {profile?.equippedTitle ? (
          <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
            <TrophyIcon className="w-6 h-6 text-yellow-400" />
            <span className="text-lg font-semibold">{profile.equippedTitle.name}</span>
          </div>
        ) : (
          <p className="text-gray-400">No title equipped. Unlock titles by earning achievements!</p>
        )}
      </div>

      {/* Faction */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Faction</h2>
          <a href="/faction" className="text-sm text-purple-400 hover:text-purple-300">
            View Faction
          </a>
        </div>
        {profile?.faction ? (
          <div
            className="flex items-center gap-3 p-4 rounded-lg border"
            style={{
              backgroundColor: `${profile.faction.color}10`,
              borderColor: `${profile.faction.color}30`,
            }}
          >
            <SwordsIcon className="w-6 h-6" style={{ color: profile.faction.color }} />
            <span className="text-lg font-semibold" style={{ color: profile.faction.color }}>
              {profile.faction.name}
            </span>
          </div>
        ) : (
          <p className="text-gray-400">Not a member of any faction. Join one to unlock faction warfare!</p>
        )}
      </div>

      {/* Linked Accounts */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Linked Accounts</h2>
        <p className="text-gray-400 text-sm mb-6">
          Link your streaming accounts to play across platforms. Your progress is shared across all linked accounts.
        </p>

        {/* Link status message */}
        {linkMessage && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
              linkMessage.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            <span>{linkMessage.message}</span>
            <button
              onClick={() => setLinkMessage(null)}
              className="text-current hover:opacity-75"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* Kick */}
          <AccountRow
            platform="kick"
            platformName="Kick"
            color="#53fc18"
            account={profile?.linkedAccounts?.kick}
            onLink={() => handleLinkAccount('kick')}
            onUnlink={() => handleUnlinkAccount('kick')}
            isLinking={linkingPlatform === 'kick'}
            isUnlinking={unlinkingPlatform === 'kick'}
            icon={<KickIcon className="w-5 h-5" />}
          />

          {/* Twitch */}
          <AccountRow
            platform="twitch"
            platformName="Twitch"
            color="#9146FF"
            account={profile?.linkedAccounts?.twitch}
            onLink={() => handleLinkAccount('twitch')}
            onUnlink={() => handleUnlinkAccount('twitch')}
            isLinking={linkingPlatform === 'twitch'}
            isUnlinking={unlinkingPlatform === 'twitch'}
            icon={<TwitchIcon className="w-5 h-5" />}
          />

          {/* Discord */}
          <AccountRow
            platform="discord"
            platformName="Discord"
            color="#5865F2"
            account={profile?.linkedAccounts?.discord}
            onLink={() => handleLinkAccount('discord')}
            onUnlink={() => handleUnlinkAccount('discord')}
            isLinking={linkingPlatform === 'discord'}
            isUnlinking={unlinkingPlatform === 'discord'}
            icon={<DiscordIcon className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h2>
        <p className="text-gray-400 text-sm mb-4">
          These actions are irreversible. Please proceed with caution.
        </p>
        <button
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg font-medium transition-colors"
          onClick={() => alert('Account deletion is not yet implemented. Contact support to delete your account.')}
        >
          Delete Account
        </button>
      </div>
    </div>
  )
}

function AccountRow({
  platform,
  platformName,
  color,
  account,
  onLink,
  onUnlink,
  isLinking,
  isUnlinking,
  icon,
}: {
  platform: string
  platformName: string
  color: string
  account: { username: string; id: string } | null | undefined
  onLink: () => void
  onUnlink: () => void
  isLinking: boolean
  isUnlinking: boolean
  icon: React.ReactNode
}) {
  const isLinked = !!account

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        isLinked ? 'border-opacity-30' : 'border-gray-600 bg-gray-700/30'
      }`}
      style={{
        borderColor: isLinked ? color : undefined,
        backgroundColor: isLinked ? `${color}10` : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <div style={{ color: isLinked ? color : '#9ca3af' }}>{icon}</div>
        <div>
          <span className="font-medium" style={{ color: isLinked ? color : '#9ca3af' }}>
            {platformName}
          </span>
          {isLinked && (
            <p className="text-sm text-gray-400">@{account.username}</p>
          )}
        </div>
      </div>
      {isLinked ? (
        <button
          onClick={onUnlink}
          disabled={isUnlinking}
          className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
        >
          {isUnlinking ? 'Unlinking...' : 'Unlink'}
        </button>
      ) : (
        <button
          onClick={onLink}
          disabled={isLinking}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {isLinking ? 'Linking...' : 'Link Account'}
        </button>
      )}
    </div>
  )
}

// Icons
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function SwordsIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function KickIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.08 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z" />
    </svg>
  )
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
