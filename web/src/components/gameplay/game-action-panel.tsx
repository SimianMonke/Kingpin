'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KineticNumber, CurrencyDisplay, XPDisplay } from '@/components/ui/kinetic-number'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

export interface ActionResult {
  success: boolean
  message: string
  wealth?: number
  xp?: number
  event?: string
  details?: Record<string, unknown>
}

export interface GameActionPanelProps {
  title: string
  description: string
  icon: React.ReactNode
  actionLabel: string
  onAction: () => Promise<ActionResult>
  cooldownSeconds?: number
  cooldownEndTime?: Date | null
  disabled?: boolean
  disabledReason?: string
  children?: React.ReactNode
  accentColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive'
}

// =============================================================================
// COOLDOWN HOOK
// =============================================================================

export function useCooldown(endTime: Date | null | undefined) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!endTime) {
      setRemaining(0)
      return
    }

    const calculateRemaining = () => {
      const now = new Date().getTime()
      const end = new Date(endTime).getTime()
      const diff = Math.max(0, Math.ceil((end - now) / 1000))
      setRemaining(diff)
    }

    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  return {
    remaining,
    isOnCooldown: remaining > 0,
    formatted: formatTime(remaining),
  }
}

// =============================================================================
// GAME ACTION PANEL
// =============================================================================

export function GameActionPanel({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  cooldownSeconds = 0,
  cooldownEndTime,
  disabled = false,
  disabledReason,
  children,
  accentColor = 'primary',
}: GameActionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [localCooldownEnd, setLocalCooldownEnd] = useState<Date | null>(cooldownEndTime || null)

  const cooldown = useCooldown(localCooldownEnd)

  const colorVar = `var(--color-${accentColor})`

  const handleAction = useCallback(async () => {
    if (loading || cooldown.isOnCooldown || disabled) return

    setLoading(true)
    setResult(null)
    setShowResult(false)

    try {
      const actionResult = await onAction()
      setResult(actionResult)
      setShowResult(true)

      // Set local cooldown if specified
      if (cooldownSeconds > 0 && actionResult.success) {
        const newCooldownEnd = new Date(Date.now() + cooldownSeconds * 1000)
        setLocalCooldownEnd(newCooldownEnd)
      }

      // Auto-hide result after 5 seconds
      setTimeout(() => setShowResult(false), 5000)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Action failed',
      })
      setShowResult(true)
    } finally {
      setLoading(false)
    }
  }, [loading, cooldown.isOnCooldown, disabled, onAction, cooldownSeconds])

  const isDisabled = disabled || loading || cooldown.isOnCooldown

  return (
    <Card
      variant="default"
      glow={!isDisabled ? accentColor : undefined}
      className={cn(
        'relative overflow-hidden transition-all',
        isDisabled && 'opacity-75'
      )}
    >
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none scanlines opacity-5" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 border"
              style={{ borderColor: colorVar, color: colorVar }}
            >
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg" style={{ color: colorVar }}>
                {title}
              </CardTitle>
              <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
                {description}
              </p>
            </div>
          </div>

          {/* Cooldown Timer */}
          {cooldown.isOnCooldown && (
            <div className="text-right">
              <span className="font-display text-xs uppercase tracking-wider text-[var(--color-muted)]">
                COOLDOWN
              </span>
              <div className="font-mono text-lg text-[var(--color-warning)]">
                {cooldown.formatted}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Custom Content (e.g., options, toggles) */}
        {children}

        {/* Action Button */}
        <Button
          onClick={handleAction}
          disabled={isDisabled}
          variant="default"
          size="lg"
          className={cn(
            'w-full font-display uppercase tracking-wider',
            !isDisabled && 'glow-primary'
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner />
              PROCESSING...
            </span>
          ) : cooldown.isOnCooldown ? (
            `WAIT ${cooldown.formatted}`
          ) : disabled ? (
            disabledReason || 'UNAVAILABLE'
          ) : (
            actionLabel
          )}
        </Button>

        {/* Result Display */}
        {showResult && result && (
          <ResultDisplay result={result} accentColor={accentColor} />
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// RESULT DISPLAY
// =============================================================================

function ResultDisplay({
  result,
  accentColor,
}: {
  result: ActionResult
  accentColor: string
}) {
  const bgColor = result.success
    ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]'
    : 'bg-[var(--color-destructive)]/10 border-[var(--color-destructive)]'

  const textColor = result.success
    ? 'text-[var(--color-success)]'
    : 'text-[var(--color-destructive)]'

  return (
    <div
      className={cn(
        'p-4 border-2 animate-in fade-in slide-in-from-bottom-2 duration-300',
        bgColor
      )}
    >
      {/* Status Header */}
      <div className="flex items-center gap-2 mb-2">
        {result.success ? (
          <CheckIcon className="w-5 h-5 text-[var(--color-success)]" />
        ) : (
          <XIcon className="w-5 h-5 text-[var(--color-destructive)]" />
        )}
        <span className={cn('font-display uppercase tracking-wider', textColor)}>
          {result.success ? 'SUCCESS' : 'FAILED'}
        </span>
      </div>

      {/* Event Name */}
      {result.event && (
        <p className="font-display text-sm uppercase tracking-wider text-[var(--color-foreground)] mb-2">
          {result.event}
        </p>
      )}

      {/* Message */}
      <p className="font-mono text-sm text-[var(--color-muted)]">
        {result.message}
      </p>

      {/* Rewards */}
      {(result.wealth !== undefined || result.xp !== undefined) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
          {result.wealth !== undefined && (
            <div className="flex items-center gap-2">
              <span className="font-display text-xs uppercase text-[var(--color-muted)]">
                WEALTH
              </span>
              <span
                className={cn(
                  'font-mono text-lg font-bold',
                  result.wealth >= 0
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-destructive)]'
                )}
              >
                {result.wealth >= 0 ? '+' : ''}
                <CurrencyDisplay value={result.wealth} size="sm" />
              </span>
            </div>
          )}
          {result.xp !== undefined && (
            <div className="flex items-center gap-2">
              <span className="font-display text-xs uppercase text-[var(--color-muted)]">
                XP
              </span>
              <span className="font-mono text-lg font-bold text-[var(--color-primary)]">
                +<KineticNumber value={result.xp} />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
