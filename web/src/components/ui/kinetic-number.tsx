'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// =============================================================================
// KINETIC NUMBER COMPONENT
// Animated number ticker that makes data feel "live"
// =============================================================================

interface KineticNumberProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  formatFn?: (value: number) => string
}

export function KineticNumber({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  formatFn,
}: KineticNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValueRef = useRef(0)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = previousValueRef.current
    const endValue = value
    const diff = endValue - startValue

    if (diff === 0) {
      setDisplayValue(endValue)
      return
    }

    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out-expo)
      const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const currentValue = startValue + diff * easeOutExpo

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        previousValueRef.current = endValue
        startTimeRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration])

  const formattedValue = formatFn
    ? formatFn(displayValue)
    : decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString()

  return (
    <span
      className={cn(
        'kinetic-number font-data tabular-nums',
        className
      )}
    >
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  )
}

// =============================================================================
// CURRENCY DISPLAY
// Pre-configured kinetic number for currency values
// =============================================================================

interface CurrencyDisplayProps {
  value: number
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function CurrencyDisplay({
  value,
  className,
  size = 'md',
}: CurrencyDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }

  return (
    <KineticNumber
      value={value}
      prefix="$"
      className={cn(
        sizeClasses[size],
        'text-[var(--color-warning)] font-bold',
        className
      )}
    />
  )
}

// =============================================================================
// XP DISPLAY
// Pre-configured kinetic number for XP values
// =============================================================================

interface XPDisplayProps {
  value: number
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function XPDisplay({
  value,
  className,
  size = 'md',
}: XPDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }

  return (
    <KineticNumber
      value={value}
      suffix=" XP"
      className={cn(
        sizeClasses[size],
        'text-[var(--color-primary)] font-bold',
        className
      )}
    />
  )
}

// =============================================================================
// STAT VALUE
// Generic stat display with kinetic animation
// =============================================================================

interface StatValueProps {
  value: number
  label?: string
  prefix?: string
  suffix?: string
  className?: string
  valueClassName?: string
  labelClassName?: string
}

export function StatValue({
  value,
  label,
  prefix,
  suffix,
  className,
  valueClassName,
  labelClassName,
}: StatValueProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {label && (
        <span
          className={cn(
            'text-xs uppercase tracking-wider text-[var(--color-muted)] font-display',
            labelClassName
          )}
        >
          {label}
        </span>
      )}
      <KineticNumber
        value={value}
        prefix={prefix}
        suffix={suffix}
        className={cn('text-2xl font-bold', valueClassName)}
      />
    </div>
  )
}
