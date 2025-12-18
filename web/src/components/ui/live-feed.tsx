'use client'

import * as React from 'react'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

// =============================================================================
// LIVE FEED COMPONENT
// Terminal-styled scrolling feed of recent player actions
// =============================================================================

export interface FeedEvent {
  id: number
  username: string
  eventType: string
  description: string
  wealthChange?: number
  xpChange?: number
  success?: boolean
  timestamp: string
}

interface LiveFeedProps {
  className?: string
  maxItems?: number
  pollInterval?: number
}

// Event type styling map
const EVENT_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  play: { icon: '▶', color: 'text-[var(--color-success)]', label: 'PLAY' },
  rob_success: { icon: '💀', color: 'text-[var(--color-warning)]', label: 'ROB' },
  rob_fail: { icon: '🛡', color: 'text-[var(--color-destructive)]', label: 'BLOCKED' },
  mission_complete: { icon: '✓', color: 'text-[var(--color-primary)]', label: 'MISSION' },
  heist_win: { icon: '⚡', color: 'text-[var(--color-secondary)]', label: 'HEIST' },
  gambling_win: { icon: '🎰', color: 'text-[var(--color-warning)]', label: 'WIN' },
  gambling_loss: { icon: '💸', color: 'text-[var(--color-destructive)]', label: 'LOSS' },
  level_up: { icon: '⬆', color: 'text-[var(--color-primary)]', label: 'LEVEL' },
  crate_open: { icon: '📦', color: 'text-[var(--color-secondary)]', label: 'CRATE' },
  checkin: { icon: '✔', color: 'text-[var(--color-success)]', label: 'CHECK-IN' },
  default: { icon: '●', color: 'text-[var(--color-muted)]', label: 'EVENT' },
}

function getEventStyle(eventType: string) {
  // Normalize event type
  const normalized = eventType.toLowerCase().replace(/\s+/g, '_')

  if (normalized.includes('rob') && normalized.includes('success')) return EVENT_STYLES.rob_success
  if (normalized.includes('rob')) return EVENT_STYLES.rob_fail
  if (normalized.includes('mission')) return EVENT_STYLES.mission_complete
  if (normalized.includes('heist')) return EVENT_STYLES.heist_win
  if (normalized.includes('play')) return EVENT_STYLES.play
  if (normalized.includes('win') || normalized.includes('jackpot')) return EVENT_STYLES.gambling_win
  if (normalized.includes('loss') || normalized.includes('lose')) return EVENT_STYLES.gambling_loss
  if (normalized.includes('level')) return EVENT_STYLES.level_up
  if (normalized.includes('crate')) return EVENT_STYLES.crate_open
  if (normalized.includes('checkin') || normalized.includes('check')) return EVENT_STYLES.checkin

  return EVENT_STYLES.default
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return `${diffSec}s`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  return `${Math.floor(diffSec / 86400)}d`
}

function formatWealthChange(amount: number | undefined): string {
  if (!amount) return ''
  const prefix = amount > 0 ? '+' : ''
  return `${prefix}$${Math.abs(amount).toLocaleString()}`
}

export function LiveFeed({ className, maxItems = 5, pollInterval = 10000 }: LiveFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/feed/live?limit=${maxItems}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch live feed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, pollInterval)
    return () => clearInterval(interval)
  }, [maxItems, pollInterval])

  return (
    <div
      ref={containerRef}
      className={cn(
        'glass-panel scanlines relative overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[var(--color-success)] animate-pulse" />
          <h3 className="font-display text-sm tracking-widest text-[var(--color-primary)]">
            LIVE FEED
          </h3>
        </div>
        {lastUpdate && (
          <span className="text-xs text-[var(--color-muted)] font-data">
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Feed Content */}
      <div className="divide-y divide-[var(--color-border)]">
        {isLoading ? (
          <div className="p-4">
            <div className="loading-terminal text-sm" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-[var(--color-muted)] text-sm font-data">
              {'>'} NO RECENT ACTIVITY_
            </span>
          </div>
        ) : (
          events.map((event, index) => {
            const style = getEventStyle(event.eventType)
            return (
              <div
                key={event.id}
                className={cn(
                  'px-4 py-3 hover:bg-[var(--color-surface)]/50 transition-colors',
                  'animate-in fade-in-0',
                  index === 0 && 'bg-[var(--color-primary)]/5'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  {/* Event Icon */}
                  <span className={cn('text-lg', style.color)}>
                    {style.icon}
                  </span>

                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-[10px] font-display px-1.5 py-0.5 border',
                        style.color,
                        'border-current'
                      )}>
                        {style.label}
                      </span>
                      <span className="text-xs text-[var(--color-muted)] font-data">
                        {formatTimeAgo(event.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm text-[var(--color-foreground)] font-data truncate">
                      <span className="text-[var(--color-primary)]">
                        {event.username}
                      </span>
                      {' '}
                      <span className="text-[var(--color-muted)]">
                        {event.description}
                      </span>
                    </p>

                    {/* Wealth/XP Changes */}
                    {(event.wealthChange !== undefined && event.wealthChange !== 0) && (
                      <span className={cn(
                        'text-xs font-data mt-1 inline-block',
                        event.wealthChange > 0
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-destructive)]'
                      )}>
                        {formatWealthChange(event.wealthChange)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-2 border-t-2 border-[var(--color-border)] bg-[var(--color-void)]/50">
        <span className="text-[10px] text-[var(--color-muted)] font-data terminal-cursor">
          {'>'} MONITORING NETWORK ACTIVITY
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// MINI FEED - Compact version for sidebars/small spaces
// =============================================================================

interface MiniFeedProps {
  className?: string
  maxItems?: number
}

export function MiniFeed({ className, maxItems = 3 }: MiniFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([])

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/feed/live?limit=${maxItems}`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events || [])
        }
      } catch (error) {
        console.error('Failed to fetch mini feed:', error)
      }
    }

    fetchEvents()
    const interval = setInterval(fetchEvents, 15000)
    return () => clearInterval(interval)
  }, [maxItems])

  return (
    <div className={cn('space-y-2', className)}>
      {events.map((event) => {
        const style = getEventStyle(event.eventType)
        return (
          <div
            key={event.id}
            className="flex items-center gap-2 text-xs font-data"
          >
            <span className={style.color}>{style.icon}</span>
            <span className="text-[var(--color-primary)] truncate max-w-[80px]">
              {event.username}
            </span>
            <span className="text-[var(--color-muted)] truncate flex-1">
              {event.description}
            </span>
          </div>
        )
      })}
    </div>
  )
}
