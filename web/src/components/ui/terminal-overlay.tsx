'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// =============================================================================
// TERMINAL OVERLAY
// Global CRT effects: scanlines, vignette, noise
// =============================================================================

interface TerminalOverlayProps {
  /** Enable moving scanlines */
  scanlines?: boolean
  /** Enable CRT vignette effect */
  vignette?: boolean
  /** Enable subtle noise texture */
  noise?: boolean
  /** Overall intensity (0-1) */
  intensity?: number
  /** Disable all effects (respects user preference) */
  disabled?: boolean
}

export function TerminalOverlay({
  scanlines = true,
  vignette = true,
  noise = false,
  intensity = 1,
  disabled = false,
}: TerminalOverlayProps) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  if (disabled || reducedMotion) return null

  return (
    <>
      {/* Scanlines Layer */}
      {scanlines && (
        <div
          className="terminal-scanlines"
          style={{ opacity: intensity * 0.7 }}
          aria-hidden="true"
        />
      )}

      {/* CRT Effect Layer (vignette + color bleed) */}
      {vignette && (
        <div
          className="crt-effect"
          style={{ opacity: intensity }}
          aria-hidden="true"
        />
      )}

      {/* Noise Layer */}
      {noise && (
        <div
          className="fixed inset-0 pointer-events-none z-[9996] noise-animated"
          style={{ opacity: intensity * 0.5 }}
          aria-hidden="true"
        />
      )}
    </>
  )
}

// =============================================================================
// GLITCH TEXT
// Text that occasionally glitches with chromatic aberration
// =============================================================================

interface GlitchTextProps {
  children: React.ReactNode
  className?: string
  /** Intensity of glitch effect: 'subtle' | 'medium' | 'intense' */
  intensity?: 'subtle' | 'medium' | 'intense'
  /** Whether the text should constantly glitch or only on hover */
  mode?: 'idle' | 'hover' | 'always'
}

export function GlitchText({
  children,
  className,
  intensity = 'subtle',
  mode = 'idle',
}: GlitchTextProps) {
  const intensityClasses = {
    subtle: 'idle-glitch-text',
    medium: 'text-flicker',
    intense: 'animate-chromatic-glitch',
  }

  const modeClasses = {
    idle: intensityClasses[intensity],
    hover: 'hover-chromatic',
    always: 'animate-chromatic-glitch',
  }

  // Add random delay for organic feel
  const delays = ['', 'idle-glitch-delay-1', 'idle-glitch-delay-2', 'idle-glitch-delay-3', 'idle-glitch-delay-4']
  const randomDelay = delays[Math.floor(Math.random() * delays.length)]

  return (
    <span className={cn(modeClasses[mode], randomDelay, className)}>
      {children}
    </span>
  )
}

// =============================================================================
// FLICKER TEXT
// Text that subtly flickers like a malfunctioning display
// =============================================================================

interface FlickerTextProps {
  children: React.ReactNode
  className?: string
  /** Delay variant for staggered animations */
  delay?: 0 | 1 | 2 | 3 | 4
}

export function FlickerText({
  children,
  className,
  delay = 0,
}: FlickerTextProps) {
  const delayClasses: Record<number, string> = {
    0: '',
    1: 'text-flicker-delay-1',
    2: 'text-flicker-delay-2',
    3: 'text-flicker-delay-3',
    4: 'text-flicker-delay-4',
  }

  return (
    <span className={cn('text-flicker-subtle', delayClasses[delay], className)}>
      {children}
    </span>
  )
}

// =============================================================================
// LIVING PANEL
// A panel/card that has subtle "breathing" animation
// =============================================================================

interface LivingPanelProps {
  children: React.ReactNode
  className?: string
  /** Glow color variant */
  glow?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'none'
  /** Whether to show idle glitch animation */
  glitch?: boolean
  /** Animation delay for staggered effects */
  delay?: 0 | 1 | 2 | 3 | 4
}

export function LivingPanel({
  children,
  className,
  glow = 'none',
  glitch = true,
  delay = 0,
}: LivingPanelProps) {
  const glowClasses = {
    primary: 'glow-primary animate-pulse-glow',
    secondary: 'glow-secondary',
    success: 'glow-success',
    warning: '',
    destructive: 'glow-destructive',
    none: '',
  }

  const delayClasses: Record<number, string> = {
    0: '',
    1: 'idle-glitch-delay-1',
    2: 'idle-glitch-delay-2',
    3: 'idle-glitch-delay-3',
    4: 'idle-glitch-delay-4',
  }

  return (
    <div
      className={cn(
        glitch && 'idle-glitch',
        glowClasses[glow],
        delayClasses[delay],
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// DATA STREAM
// Scrolling hex/binary data stream for loading states
// =============================================================================

interface DataStreamProps {
  className?: string
  /** Type of data to display */
  type?: 'hex' | 'binary' | 'mixed'
  /** Number of visible lines */
  lines?: number
  /** Speed of scroll in ms */
  speed?: number
  /** Color variant */
  color?: 'primary' | 'success' | 'secondary'
}

export function DataStream({
  className,
  type = 'hex',
  lines = 3,
  speed = 100,
  color = 'primary',
}: DataStreamProps) {
  const [data, setData] = useState<string[]>([])

  const generateLine = React.useCallback(() => {
    if (type === 'hex') {
      return Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase()
      ).join(' ')
    } else if (type === 'binary') {
      return Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 2)
      ).join('')
    } else {
      // Mixed
      const chars = '0123456789ABCDEF!@#$%^&*<>[]{}|'
      return Array.from({ length: 24 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('')
    }
  }, [type])

  useEffect(() => {
    // Initialize with some data
    setData(Array.from({ length: lines }, generateLine))

    const interval = setInterval(() => {
      setData((prev) => {
        const newData = [...prev.slice(1), generateLine()]
        return newData
      })
    }, speed)

    return () => clearInterval(interval)
  }, [lines, speed, generateLine])

  const colorClasses = {
    primary: 'text-[var(--color-primary)]',
    success: 'text-[var(--color-success)]',
    secondary: 'text-[var(--color-secondary)]',
  }

  return (
    <div
      className={cn(
        'font-mono text-xs overflow-hidden',
        colorClasses[color],
        className
      )}
      aria-hidden="true"
    >
      {data.map((line, i) => (
        <div
          key={i}
          className={cn(
            'transition-opacity duration-200',
            i === data.length - 1 ? 'opacity-100' : 'opacity-40'
          )}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// BOOT ANIMATION WRAPPER
// Wrap content to give it a boot/power-on animation
// =============================================================================

interface BootAnimationProps {
  children: React.ReactNode
  className?: string
  /** Type of boot animation */
  type?: 'flicker' | 'scan' | 'glow'
  /** Delay before animation starts */
  delay?: number
}

export function BootAnimation({
  children,
  className,
  type = 'flicker',
  delay = 0,
}: BootAnimationProps) {
  const typeClasses = {
    flicker: 'boot-flicker',
    scan: 'boot-scan',
    glow: 'power-on',
  }

  const delayClasses: Record<number, string> = {
    0: '',
    1: 'boot-delay-1',
    2: 'boot-delay-2',
    3: 'boot-delay-3',
    4: 'boot-delay-4',
    5: 'boot-delay-5',
  }

  return (
    <div
      className={cn(
        typeClasses[type],
        delayClasses[Math.min(delay, 5) as keyof typeof delayClasses],
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// SIGNAL INTERFERENCE
// Heavy glitch effect for errors and critical alerts
// =============================================================================

interface SignalInterferenceProps {
  children: React.ReactNode
  className?: string
  /** Whether the interference is active */
  active?: boolean
  /** Intensity level */
  intensity?: 'normal' | 'critical'
}

export function SignalInterference({
  children,
  className,
  active = false,
  intensity = 'normal',
}: SignalInterferenceProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (active) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 500)
      return () => clearTimeout(timer)
    }
  }, [active])

  return (
    <div
      className={cn(
        isAnimating && (intensity === 'critical' ? 'signal-critical' : 'signal-interference'),
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// HOVER GLITCH BUTTON WRAPPER
// Add glitch effect to any interactive element on hover
// =============================================================================

interface HoverGlitchProps {
  children: React.ReactNode
  className?: string
  /** Type of hover effect */
  effect?: 'glitch' | 'scan' | 'chromatic'
}

export function HoverGlitch({
  children,
  className,
  effect = 'glitch',
}: HoverGlitchProps) {
  const effectClasses = {
    glitch: 'hover-glitch',
    scan: 'hover-scan',
    chromatic: 'hover-chromatic',
  }

  return (
    <span className={cn(effectClasses[effect], className)}>
      {children}
    </span>
  )
}
