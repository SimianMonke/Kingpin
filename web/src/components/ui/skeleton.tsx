"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// =============================================================================
// SKELETON COMPONENT
// Loading placeholders with hex dump / terminal sequences
// =============================================================================

const skeletonVariants = cva(
  [
    "relative overflow-hidden",
    "bg-[var(--color-surface)]",
    "border border-[rgba(0,255,241,0.1)]",
  ],
  {
    variants: {
      variant: {
        default: "animate-pulse",
        shimmer: [
          "before:absolute before:inset-0",
          "before:bg-gradient-to-r before:from-transparent before:via-[rgba(0,255,241,0.05)] before:to-transparent",
          "before:animate-shimmer",
        ],
        terminal: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, className }))}
        {...props}
      />
    )
  }
)
Skeleton.displayName = "Skeleton"

// =============================================================================
// TERMINAL SKELETON
// Animated "INITIALIZING..." or hex dump sequences
// =============================================================================

interface TerminalSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
  mode?: "initializing" | "hex" | "loading" | "scanning"
}

const TerminalSkeleton = React.forwardRef<HTMLDivElement, TerminalSkeletonProps>(
  ({ className, lines = 3, mode = "initializing", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "p-4 font-mono text-xs",
          "bg-[var(--color-void)] border border-[rgba(0,255,241,0.2)]",
          className
        )}
        {...props}
      >
        {mode === "initializing" && <InitializingSequence lines={lines} />}
        {mode === "hex" && <HexDumpSequence lines={lines} />}
        {mode === "loading" && <LoadingSequence />}
        {mode === "scanning" && <ScanningSequence lines={lines} />}
      </div>
    )
  }
)
TerminalSkeleton.displayName = "TerminalSkeleton"

// =============================================================================
// ANIMATED SEQUENCES
// =============================================================================

const InitializingSequence: React.FC<{ lines: number }> = ({ lines }) => {
  const [dots, setDots] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4)
    }, 400)
    return () => clearInterval(interval)
  }, [])

  const messages = [
    "> INITIALIZING SYSTEM",
    "> LOADING MODULES",
    "> ESTABLISHING CONNECTION",
    "> VALIDATING CREDENTIALS",
    "> SYNCING DATA STREAMS",
  ]

  return (
    <div className="space-y-1 text-[var(--color-primary)]">
      {messages.slice(0, lines).map((msg, i) => (
        <div key={i} className="flex items-center">
          <span>{msg}</span>
          {i === lines - 1 && (
            <span className="ml-1">
              {".".repeat(dots)}
              <span className="opacity-0">{".".repeat(3 - dots)}</span>
            </span>
          )}
          {i < lines - 1 && <span className="ml-2 text-[var(--color-success)]">[OK]</span>}
        </div>
      ))}
      <span className="inline-block w-2 h-4 bg-[var(--color-primary)] animate-pulse" />
    </div>
  )
}

const HexDumpSequence: React.FC<{ lines: number }> = ({ lines }) => {
  const [hexData, setHexData] = React.useState<string[]>([])

  React.useEffect(() => {
    const generateHexLine = () => {
      const offset = Math.floor(Math.random() * 65536)
        .toString(16)
        .padStart(4, "0")
        .toUpperCase()
      const bytes = Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()
      ).join(" ")
      return `0x${offset}: ${bytes}`
    }

    const initialData = Array.from({ length: lines }, generateHexLine)
    setHexData(initialData)

    const interval = setInterval(() => {
      setHexData((prev) => {
        const newData = [...prev.slice(1), generateHexLine()]
        return newData
      })
    }, 150)

    return () => clearInterval(interval)
  }, [lines])

  return (
    <div className="space-y-0.5 text-[var(--color-success)] opacity-70">
      {hexData.map((line, i) => (
        <div key={i} className="font-mono tracking-wider">
          {line}
        </div>
      ))}
    </div>
  )
}

const LoadingSequence: React.FC = () => {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 0
        return p + Math.random() * 15
      })
    }, 200)
    return () => clearInterval(interval)
  }, [])

  const displayProgress = Math.min(Math.floor(progress), 100)
  const barWidth = Math.floor((displayProgress / 100) * 20)

  return (
    <div className="space-y-2 text-[var(--color-primary)]">
      <div className="flex items-center gap-2">
        <span>LOADING:</span>
        <span className="text-[var(--color-foreground)]">{displayProgress}%</span>
      </div>
      <div className="flex items-center font-mono">
        <span>[</span>
        <span className="text-[var(--color-success)]">{"█".repeat(barWidth)}</span>
        <span className="text-[var(--color-muted)]">{"░".repeat(20 - barWidth)}</span>
        <span>]</span>
      </div>
    </div>
  )
}

const ScanningSequence: React.FC<{ lines: number }> = ({ lines }) => {
  const [scanLine, setScanLine] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setScanLine((l) => (l + 1) % lines)
    }, 300)
    return () => clearInterval(interval)
  }, [lines])

  return (
    <div className="space-y-1">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-3 transition-all duration-150",
            i === scanLine
              ? "bg-[var(--color-primary)]/30"
              : "bg-[var(--color-surface)]"
          )}
        />
      ))}
      <div className="text-[var(--color-primary)] mt-2">
        {">"} SCANNING SECTOR {scanLine + 1}/{lines}
        <span className="animate-pulse">_</span>
      </div>
    </div>
  )
}

// =============================================================================
// SKELETON VARIANTS FOR COMMON PATTERNS
// =============================================================================

const SkeletonText = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { lines?: number }
>(({ className, lines = 3, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn(
          "h-4",
          i === lines - 1 ? "w-2/3" : "w-full"
        )}
      />
    ))}
  </div>
))
SkeletonText.displayName = "SkeletonText"

const SkeletonCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "p-4 space-y-4",
      "bg-[rgba(18,18,18,0.65)] backdrop-blur-lg",
      "border-2 border-[rgba(0,255,241,0.2)]",
      className
    )}
    {...props}
  >
    <Skeleton className="h-6 w-1/3" />
    <SkeletonText lines={2} />
    <div className="flex gap-2">
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-24" />
    </div>
  </div>
))
SkeletonCard.displayName = "SkeletonCard"

const SkeletonAvatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "default" | "lg" }
>(({ className, size = "default", ...props }, ref) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    default: "w-12 h-12",
    lg: "w-16 h-16",
  }

  return (
    <Skeleton
      ref={ref}
      className={cn(sizeClasses[size], className)}
      {...props}
    />
  )
})
SkeletonAvatar.displayName = "SkeletonAvatar"

const SkeletonTable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { rows?: number; cols?: number }
>(({ className, rows = 5, cols = 4, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    {/* Header */}
    <div className="flex gap-4 pb-2 border-b border-[rgba(0,255,241,0.2)]">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4">
        {Array.from({ length: cols }).map((_, colIndex) => (
          <Skeleton key={colIndex} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
))
SkeletonTable.displayName = "SkeletonTable"

export {
  Skeleton,
  TerminalSkeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonTable,
  skeletonVariants,
}
