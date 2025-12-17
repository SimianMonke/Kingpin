'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
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
    kick: { username: string; id: string } | null
    twitch: { username: string; id: string } | null
    discord: { username: string; id: string } | null
  }
  equippedTitle: { id: string; name: string } | null
  faction: { id: string; name: string; color: string } | null
}

type Platform = 'kick' | 'twitch' | 'discord'

const LINK_MESSAGES: Record<string, { type: 'success' | 'error'; message: string }> = {
  linked: { type: 'success', message: 'SYSTEM LINK ESTABLISHED' },
  already_linked: { type: 'success', message: 'SYSTEM ALREADY CONNECTED' },
  invalid_platform: { type: 'error', message: 'INVALID PLATFORM IDENTIFIER' },
  invalid_state: { type: 'error', message: 'SESSION EXPIRED - RETRY REQUIRED' },
  invalid_callback: { type: 'error', message: 'OAUTH CALLBACK INVALID' },
  platform_mismatch: { type: 'error', message: 'PLATFORM MISMATCH DETECTED' },
  already_linked_other: { type: 'error', message: 'SYSTEM LINKED TO ANOTHER USER' },
  oauth_denied: { type: 'error', message: 'AUTHORIZATION DENIED' },
  link_failed: { type: 'error', message: 'LINK OPERATION FAILED' },
}

// =============================================================================
// PROFILE PAGE
// Neo-Brutalist Settings Interface
// =============================================================================

export default function ProfilePage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [kingpin_name, setKingpinName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [linkingPlatform, setLinkingPlatform] = useState<Platform | null>(null)
  const [unlinkingPlatform, setUnlinkingPlatform] = useState<Platform | null>(null)
  const [linkMessage, setLinkMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success && LINK_MESSAGES[success]) {
      setLinkMessage(LINK_MESSAGES[success])
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
        setKingpinName(data.data.kingpin_name || '')
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!kingpin_name.trim()) {
      setNameError('NAME CANNOT BE EMPTY')
      return
    }

    if (kingpin_name.length < 3 || kingpin_name.length > 20) {
      setNameError('NAME MUST BE 3-20 CHARACTERS')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(kingpin_name)) {
      setNameError('INVALID CHARACTERS DETECTED')
      return
    }

    setSaving(true)
    setNameError(null)

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingpin_name }),
      })

      const data = await res.json()

      if (res.ok) {
        setProfile(data.data)
        setEditingName(false)
      } else {
        setNameError(data.error || 'UPDATE FAILED')
      }
    } catch {
      setNameError('NETWORK ERROR')
    } finally {
      setSaving(false)
    }
  }

  const handleLinkAccount = (platform: Platform) => {
    setLinkingPlatform(platform)
    setLinkMessage(null)
    window.location.href = `/api/auth/link/${platform}`
  }

  const handleUnlinkAccount = async (platform: Platform) => {
    const linkedCount = [
      profile?.linkedAccounts?.kick,
      profile?.linkedAccounts?.twitch,
      profile?.linkedAccounts?.discord,
    ].filter(Boolean).length

    if (linkedCount <= 1) {
      setLinkMessage({ type: 'error', message: 'MINIMUM ONE LINK REQUIRED' })
      return
    }

    if (!confirm(`CONFIRM UNLINK: ${platform.toUpperCase()}?`)) {
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
        setLinkMessage({ type: 'success', message: `${platform.toUpperCase()} UNLINKED` })
      } else {
        const data = await res.json()
        setLinkMessage({ type: 'error', message: data.error || 'UNLINK FAILED' })
      }
    } catch {
      setLinkMessage({ type: 'error', message: 'NETWORK ERROR' })
    } finally {
      setUnlinkingPlatform(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).toUpperCase()
  }

  if (loading) {
    return <PageLoader message="LOADING PROFILE DATA" />
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[var(--color-foreground)]">
          PROFILE <span className="text-[var(--color-primary)]">SETTINGS</span>
        </h1>
        <p className="text-[var(--color-muted)] font-mono text-sm mt-1">
          {'// USER CONFIGURATION INTERFACE'}
        </p>
      </div>

      {/* Status Message */}
      {linkMessage && (
        <Card
          variant="outlined"
          className={cn(
            'p-4',
            linkMessage.type === 'success'
              ? 'border-[var(--color-success)] bg-[var(--color-success)]/5'
              : 'border-[var(--color-destructive)] bg-[var(--color-destructive)]/5 error-state'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'font-display uppercase text-sm',
                  linkMessage.type === 'success'
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-destructive)]'
                )}
              >
                {linkMessage.type === 'success' ? '✓ SUCCESS' : '✗ ERROR'}
              </span>
              <span className="font-mono text-sm">{linkMessage.message}</span>
            </div>
            <button
              onClick={() => setLinkMessage(null)}
              className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] p-1"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Identity Card */}
      <Card variant="default" glow="primary" scanlines className="p-6">
        <CardHeader className="p-0 pb-6 border-none">
          <CardTitle>USER IDENTITY</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-6">
          {/* Kingpin Name */}
          <div className="space-y-3">
            <Label error={!!nameError}>KINGPIN NAME</Label>
            {editingName ? (
              <div className="space-y-3">
                <Input
                  value={kingpin_name}
                  onChange={(e) => setKingpinName(e.target.value)}
                  maxLength={20}
                  error={!!nameError}
                  placeholder="ENTER KINGPIN NAME"
                />
                {nameError && (
                  <p className="font-mono text-xs text-[var(--color-destructive)]">
                    {'> '}{nameError}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={handleUpdateName}
                    disabled={saving}
                    variant="success"
                    size="sm"
                  >
                    {saving ? <InitializingText text="SAVING" className="text-xs" /> : 'SAVE'}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingName(false)
                      setKingpinName(profile?.kingpin_name || '')
                      setNameError(null)
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    CANCEL
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-primary)]/30">
                <span className="font-mono text-xl text-[var(--color-primary)]">
                  {profile?.kingpin_name || 'NOT_SET'}
                </span>
                <Button onClick={() => setEditingName(true)} variant="outline" size="sm">
                  EDIT
                </Button>
              </div>
            )}
            <p className="font-mono text-xs text-[var(--color-muted)]">
              {'// DISPLAYED ON LEADERBOARDS AND IN CHAT'}
            </p>
          </div>

          {/* Account Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--color-primary)]/20">
            <div className="space-y-1">
              <Label>MEMBER SINCE</Label>
              <p className="font-mono text-lg text-[var(--color-foreground)]">
                {profile?.created_at ? formatDate(profile.created_at) : '---'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>CURRENT TIER</Label>
              <TierBadge tier={profile?.tier || 'Rookie'} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipped Title */}
      <Card variant="solid" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <div className="flex items-center justify-between">
            <CardTitle>EQUIPPED TITLE</CardTitle>
            <a
              href="/achievements"
              className="font-mono text-xs text-[var(--color-primary)] hover:underline"
            >
              VIEW ALL →
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {profile?.equippedTitle ? (
            <div className="flex items-center gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-warning)]/30">
              <TrophyIcon className="w-6 h-6 text-[var(--color-warning)]" />
              <span className="font-display text-lg uppercase tracking-wider text-[var(--color-warning)]">
                {profile.equippedTitle.name}
              </span>
            </div>
          ) : (
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-muted)]/30">
              <p className="font-mono text-sm text-[var(--color-muted)]">
                {'> NO TITLE EQUIPPED'}
              </p>
              <p className="font-mono text-xs text-[var(--color-muted)]/70 mt-1">
                {'// UNLOCK TITLES BY EARNING ACHIEVEMENTS'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Faction */}
      <Card variant="solid" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <div className="flex items-center justify-between">
            <CardTitle>FACTION ALLEGIANCE</CardTitle>
            <a
              href="/faction"
              className="font-mono text-xs text-[var(--color-primary)] hover:underline"
            >
              VIEW FACTION →
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {profile?.faction ? (
            <div
              className="flex items-center gap-4 p-4 border"
              style={{
                backgroundColor: `${profile.faction.color}10`,
                borderColor: `${profile.faction.color}50`,
              }}
            >
              <SwordsIcon className="w-6 h-6" style={{ color: profile.faction.color }} />
              <span
                className="font-display text-lg uppercase tracking-wider"
                style={{ color: profile.faction.color }}
              >
                {profile.faction.name}
              </span>
            </div>
          ) : (
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-muted)]/30">
              <p className="font-mono text-sm text-[var(--color-muted)]">
                {'> NO FACTION ALLEGIANCE'}
              </p>
              <p className="font-mono text-xs text-[var(--color-muted)]/70 mt-1">
                {'// JOIN A FACTION TO UNLOCK FACTION WARFARE'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <Card variant="solid" className="p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle>LINKED SYSTEMS</CardTitle>
          <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
            {'// CONNECT PLATFORM ACCOUNTS FOR CROSS-SYSTEM ACCESS'}
          </p>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <AccountRow
            platform="kick"
            platformName="KICK"
            color="#53fc18"
            account={profile?.linkedAccounts?.kick}
            onLink={() => handleLinkAccount('kick')}
            onUnlink={() => handleUnlinkAccount('kick')}
            isLinking={linkingPlatform === 'kick'}
            isUnlinking={unlinkingPlatform === 'kick'}
            icon={<KickIcon />}
          />
          <AccountRow
            platform="twitch"
            platformName="TWITCH"
            color="#9146FF"
            account={profile?.linkedAccounts?.twitch}
            onLink={() => handleLinkAccount('twitch')}
            onUnlink={() => handleUnlinkAccount('twitch')}
            isLinking={linkingPlatform === 'twitch'}
            isUnlinking={unlinkingPlatform === 'twitch'}
            icon={<TwitchIcon />}
          />
          <AccountRow
            platform="discord"
            platformName="DISCORD"
            color="#5865F2"
            account={profile?.linkedAccounts?.discord}
            onLink={() => handleLinkAccount('discord')}
            onUnlink={() => handleUnlinkAccount('discord')}
            isLinking={linkingPlatform === 'discord'}
            isUnlinking={unlinkingPlatform === 'discord'}
            icon={<DiscordIcon />}
          />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card variant="outlined" className="border-[var(--color-destructive)]/50 p-6">
        <CardHeader className="p-0 pb-4 border-none">
          <CardTitle className="text-[var(--color-destructive)]">⚠ DANGER ZONE</CardTitle>
          <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
            {'// IRREVERSIBLE OPERATIONS - PROCEED WITH CAUTION'}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Button
            variant="destructive"
            onClick={() => alert('Account deletion not yet implemented. Contact support.')}
          >
            DELETE ACCOUNT
          </Button>
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
      className="inline-block font-display text-lg uppercase tracking-wider px-3 py-1 border-2"
      style={{ color, borderColor: color }}
    >
      {tier}
    </span>
  )
}

function AccountRow({
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
      className={cn(
        'flex items-center justify-between p-4 border-2 transition-colors',
        isLinked ? '' : 'opacity-60'
      )}
      style={{
        borderColor: isLinked ? color : 'var(--color-muted)',
        backgroundColor: isLinked ? `${color}08` : 'var(--color-surface)',
      }}
    >
      <div className="flex items-center gap-4">
        <div style={{ color: isLinked ? color : 'var(--color-muted)' }}>
          {icon}
        </div>
        <div>
          <span
            className="font-display uppercase tracking-wider"
            style={{ color: isLinked ? color : 'var(--color-muted)' }}
          >
            {platformName}
          </span>
          {isLinked && (
            <p className="font-mono text-sm text-[var(--color-muted)]">
              @{account.username}
            </p>
          )}
        </div>
      </div>
      {isLinked ? (
        <Button
          onClick={onUnlink}
          disabled={isUnlinking}
          variant="ghost"
          size="sm"
        >
          {isUnlinking ? <InitializingText text="..." className="text-xs" /> : 'UNLINK'}
        </Button>
      ) : (
        <Button
          onClick={onLink}
          disabled={isLinking}
          variant="outline"
          size="sm"
          style={{ borderColor: color, color }}
        >
          {isLinking ? <InitializingText text="..." className="text-xs" /> : 'LINK'}
        </Button>
      )}
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

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

function KickIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.08 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z" />
    </svg>
  )
}

function TwitchIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
