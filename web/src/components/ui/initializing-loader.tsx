'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// =============================================================================
// INITIALIZING LOADER
// Terminal-style loading state with boot sequence animation
// =============================================================================

interface InitializingLoaderProps {
  className?: string
  lines?: string[]
  speed?: number
  showCursor?: boolean
}

const DEFAULT_BOOT_SEQUENCE = [
  'KINGPIN TERMINAL v2.0.45',
  'ESTABLISHING SECURE CONNECTION...',
  'AUTHENTICATING USER CREDENTIALS...',
  'LOADING USER PROFILE...',
  'SYNCING FACTION DATA...',
  'INITIALIZING ECONOMY MODULE...',
  'SYSTEM READY',
]

export function InitializingLoader({
  className,
  lines = DEFAULT_BOOT_SEQUENCE,
  speed = 100,
  showCursor = true,
}: InitializingLoaderProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([])
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)

  useEffect(() => {
    if (currentLineIndex >= lines.length) return

    const currentLine = lines[currentLineIndex]

    if (currentCharIndex < currentLine.length) {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => {
          const newLines = [...prev]
          if (newLines.length <= currentLineIndex) {
            newLines.push(currentLine.slice(0, currentCharIndex + 1))
          } else {
            newLines[currentLineIndex] = currentLine.slice(0, currentCharIndex + 1)
          }
          return newLines
        })
        setCurrentCharIndex((prev) => prev + 1)
      }, speed)
      return () => clearTimeout(timer)
    } else {
      // Move to next line after a brief pause
      const timer = setTimeout(() => {
        setCurrentLineIndex((prev) => prev + 1)
        setCurrentCharIndex(0)
      }, speed * 3)
      return () => clearTimeout(timer)
    }
  }, [currentLineIndex, currentCharIndex, lines, speed])

  return (
    <div
      className={cn(
        'font-mono text-sm p-4 bg-[var(--color-surface)] border-2 border-[var(--color-primary)]/30',
        className
      )}
    >
      {visibleLines.map((line, index) => (
        <div
          key={index}
          className={cn(
            'text-[var(--color-success)]',
            index === visibleLines.length - 1 && showCursor && currentLineIndex < lines.length
              ? 'terminal-cursor'
              : ''
          )}
        >
          <span className="text-[var(--color-primary)] mr-2">&gt;</span>
          {line}
        </div>
      ))}
      {currentLineIndex >= lines.length && (
        <div className="text-[var(--color-primary)] mt-2 animate-pulse">
          LOADING INTERFACE...
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SIMPLE INITIALIZING TEXT
// Minimal loading indicator
// =============================================================================

interface InitializingTextProps {
  text?: string
  className?: string
}

export function InitializingText({
  text = 'INITIALIZING',
  className,
}: InitializingTextProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className={cn(
        'font-mono text-[var(--color-primary)] uppercase tracking-wider',
        className
      )}
    >
      {text}
      <span className="inline-block w-8">{dots}</span>
    </span>
  )
}

// =============================================================================
// HEX LOADER
// Loading with hex dump aesthetic
// =============================================================================

interface HexLoaderProps {
  className?: string
  lines?: number
}

export function HexLoader({ className, lines = 4 }: HexLoaderProps) {
  const [hexLines, setHexLines] = useState<string[]>([])

  useEffect(() => {
    const generateHexLine = () => {
      const bytes = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase()
      )
      return bytes.join(' ')
    }

    const interval = setInterval(() => {
      setHexLines((prev) => {
        const newLines = [...prev, generateHexLine()]
        if (newLines.length > lines) {
          return newLines.slice(-lines)
        }
        return newLines
      })
    }, 150)

    return () => clearInterval(interval)
  }, [lines])

  return (
    <div
      className={cn(
        'font-mono text-xs p-3 bg-[var(--color-surface)] border border-[var(--color-primary)]/20 overflow-hidden',
        className
      )}
    >
      <div className="text-[var(--color-muted)] mb-2">
        {'// LOADING DATA STREAM'}
      </div>
      {hexLines.map((line, index) => (
        <div
          key={index}
          className={cn(
            'text-[var(--color-primary)]',
            index === hexLines.length - 1 ? 'opacity-100' : 'opacity-50'
          )}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// FULL PAGE LOADER
// Centered loading state for page transitions
// =============================================================================

interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = 'INITIALIZING INTERFACE' }: PageLoaderProps) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 border-2 border-[var(--color-primary)]/30 animate-pulse" />
        {/* Inner spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
      <InitializingText text={message} className="text-sm" />
    </div>
  )
}
