import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// =============================================================================
// BADGE COMPONENT
// Neo-Brutalist chips with tier color support
// =============================================================================

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-display text-xs uppercase tracking-wider",
    "border-2",
    "whitespace-nowrap",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--color-surface)]",
          "border-[var(--color-primary)]",
          "text-[var(--color-primary)]",
        ],
        secondary: [
          "bg-[var(--color-surface)]",
          "border-[var(--color-secondary)]",
          "text-[var(--color-secondary)]",
        ],
        destructive: [
          "bg-[var(--color-surface)]",
          "border-[var(--color-destructive)]",
          "text-[var(--color-destructive)]",
        ],
        success: [
          "bg-[var(--color-surface)]",
          "border-[var(--color-success)]",
          "text-[var(--color-success)]",
        ],
        warning: [
          "bg-[var(--color-surface)]",
          "border-[var(--color-warning)]",
          "text-[var(--color-warning)]",
        ],
        outline: [
          "bg-transparent",
          "border-[rgba(0,255,241,0.3)]",
          "text-[var(--color-foreground)]",
        ],
        // Tier variants
        common: [
          "bg-[var(--color-surface)]",
          "border-[var(--tier-common)]",
          "text-[var(--tier-common)]",
        ],
        uncommon: [
          "bg-[var(--color-surface)]",
          "border-[var(--tier-uncommon)]",
          "text-[var(--tier-uncommon)]",
        ],
        rare: [
          "bg-[var(--color-surface)]",
          "border-[var(--tier-rare)]",
          "text-[var(--tier-rare)]",
        ],
        legendary: [
          "bg-[var(--color-surface)]",
          "border-[var(--tier-legendary)]",
          "text-[var(--tier-legendary)]",
        ],
        // Faction variants
        volkov: [
          "bg-[var(--color-surface)]",
          "border-[var(--faction-volkov)]",
          "text-[var(--faction-volkov)]",
        ],
        circuit: [
          "bg-[var(--color-surface)]",
          "border-[var(--faction-circuit)]",
          "text-[var(--faction-circuit)]",
        ],
        kessler: [
          "bg-[var(--color-surface)]",
          "border-[var(--faction-kessler)]",
          "text-[var(--faction-kessler)]",
        ],
      },
      size: {
        default: "h-6 px-3",
        sm: "h-5 px-2 text-[10px]",
        lg: "h-8 px-4 text-sm",
      },
      glow: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      // Glow variants for each color
      { variant: "default", glow: true, className: "shadow-[0_0_10px_rgba(0,255,241,0.4)]" },
      { variant: "secondary", glow: true, className: "shadow-[0_0_10px_rgba(255,0,141,0.4)]" },
      { variant: "destructive", glow: true, className: "shadow-[0_0_10px_rgba(255,42,109,0.4)]" },
      { variant: "success", glow: true, className: "shadow-[0_0_10px_rgba(0,255,159,0.4)]" },
      { variant: "warning", glow: true, className: "shadow-[0_0_10px_rgba(255,176,0,0.4)]" },
      { variant: "common", glow: true, className: "shadow-[0_0_10px_rgba(156,163,175,0.4)]" },
      { variant: "uncommon", glow: true, className: "shadow-[0_0_10px_rgba(0,255,159,0.4)]" },
      { variant: "rare", glow: true, className: "shadow-[0_0_10px_rgba(0,255,241,0.4)]" },
      { variant: "legendary", glow: true, className: "shadow-[0_0_10px_rgba(255,176,0,0.4)]" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: false,
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, glow, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size, glow, className }))}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

// =============================================================================
// TIER BADGE HELPER
// Converts tier string to appropriate variant
// =============================================================================

type Tier = "common" | "uncommon" | "rare" | "legendary"

interface TierBadgeProps extends Omit<BadgeProps, "variant"> {
  tier: Tier
}

const TierBadge = React.forwardRef<HTMLDivElement, TierBadgeProps>(
  ({ tier, ...props }, ref) => {
    return <Badge ref={ref} variant={tier} {...props} />
  }
)
TierBadge.displayName = "TierBadge"

// =============================================================================
// STATUS BADGE
// For displaying user status indicators
// =============================================================================

type Status = "online" | "offline" | "away" | "jailed" | "busy"

const statusConfig: Record<Status, { variant: BadgeProps["variant"]; label: string }> = {
  online: { variant: "success", label: "ONLINE" },
  offline: { variant: "outline", label: "OFFLINE" },
  away: { variant: "warning", label: "AWAY" },
  jailed: { variant: "destructive", label: "JAILED" },
  busy: { variant: "secondary", label: "BUSY" },
}

interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status: Status
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, ...props }, ref) => {
    const config = statusConfig[status]
    return (
      <Badge ref={ref} variant={config.variant} {...props}>
        {config.label}
      </Badge>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { Badge, TierBadge, StatusBadge, badgeVariants }
export type { Tier, Status }
