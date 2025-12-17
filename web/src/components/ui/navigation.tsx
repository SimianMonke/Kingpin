"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

// =============================================================================
// NAVIGATION COMPONENTS
// Desktop Rail (left edge) + Mobile Bottom Bar pattern
// =============================================================================

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

// =============================================================================
// NAVIGATION RAIL (Desktop)
// Vertical rail on left edge, 64px width, full height
// =============================================================================

interface NavigationRailProps {
  items: NavItem[]
  className?: string
  logo?: React.ReactNode
  footer?: React.ReactNode
}

const NavigationRail = React.forwardRef<HTMLElement, NavigationRailProps>(
  ({ items, className, logo, footer }, ref) => {
    const pathname = usePathname()

    return (
      <nav
        ref={ref}
        className={cn(
          // Layout
          "hidden lg:flex flex-col",
          "fixed left-0 top-0 h-screen w-16 z-50",
          // Glass panel styling
          "bg-[rgba(18,18,18,0.85)] backdrop-blur-lg backdrop-saturate-[180%]",
          "border-r-2 border-[rgba(0,255,241,0.2)]",
          className
        )}
      >
        {/* Logo area */}
        {logo && (
          <div className="flex items-center justify-center h-16 border-b-2 border-[rgba(0,255,241,0.1)]">
            {logo}
          </div>
        )}

        {/* Navigation items */}
        <div className="flex-1 flex flex-col items-center py-4 gap-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  // Base
                  "relative flex flex-col items-center justify-center",
                  "w-12 h-12 rounded-none",
                  "transition-all duration-100",
                  "group",
                  // States
                  isActive ? [
                    "bg-[var(--color-primary)]/10",
                    "border-l-2 border-[var(--color-primary)]",
                    "text-[var(--color-primary)]",
                  ] : [
                    "text-[var(--color-muted)]",
                    "hover:text-[var(--color-foreground)]",
                    "hover:bg-[var(--color-surface)]/50",
                  ]
                )}
              >
                <Icon className="w-5 h-5" />

                {/* Tooltip on hover */}
                <span className={cn(
                  "absolute left-full ml-3 px-3 py-1.5",
                  "font-display text-xs uppercase tracking-wider whitespace-nowrap",
                  "bg-[var(--color-surface)] border-2 border-[var(--color-primary)]",
                  "text-[var(--color-primary)]",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-100",
                  "z-50"
                )}>
                  {item.label}
                </span>

                {/* Badge */}
                {item.badge && (
                  <span className={cn(
                    "absolute -top-1 -right-1",
                    "min-w-[18px] h-[18px] px-1",
                    "flex items-center justify-center",
                    "bg-[var(--color-secondary)] text-[var(--color-void)]",
                    "font-mono text-[10px] font-bold",
                    "border border-[var(--color-void)]"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Footer area */}
        {footer && (
          <div className="flex items-center justify-center h-16 border-t-2 border-[rgba(0,255,241,0.1)]">
            {footer}
          </div>
        )}
      </nav>
    )
  }
)
NavigationRail.displayName = "NavigationRail"

// =============================================================================
// BOTTOM BAR (Mobile)
// 4 primary actions + System/More drawer trigger
// =============================================================================

interface BottomBarProps {
  items: NavItem[]
  moreItems?: NavItem[]
  className?: string
  onMoreClick?: () => void
}

const BottomBar = React.forwardRef<HTMLElement, BottomBarProps>(
  ({ items, moreItems, className, onMoreClick }, ref) => {
    const pathname = usePathname()
    const displayItems = items.slice(0, 4)
    const hasMore = moreItems && moreItems.length > 0

    return (
      <nav
        ref={ref}
        className={cn(
          // Layout
          "lg:hidden fixed bottom-0 left-0 right-0 z-50",
          "flex items-center justify-around",
          "h-16 px-2",
          // Glass panel styling
          "bg-[rgba(18,18,18,0.95)] backdrop-blur-lg backdrop-saturate-[180%]",
          "border-t-2 border-[rgba(0,255,241,0.2)]",
          // Safe area for notched phones
          "pb-safe",
          className
        )}
      >
        {displayItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // 48x48dp touch target
                "relative flex flex-col items-center justify-center",
                "min-w-[48px] min-h-[48px] px-3",
                "transition-colors duration-100",
                // States
                isActive ? [
                  "text-[var(--color-primary)]",
                ] : [
                  "text-[var(--color-muted)]",
                  "active:text-[var(--color-foreground)]",
                ]
              )}
            >
              <Icon className="w-5 h-5" />
              <span className={cn(
                "font-display text-[9px] uppercase tracking-wider mt-1",
                isActive && "text-[var(--color-primary)]"
              )}>
                {item.label}
              </span>

              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[var(--color-primary)]" />
              )}

              {/* Badge */}
              {item.badge && (
                <span className={cn(
                  "absolute top-1 right-1",
                  "min-w-[16px] h-[16px] px-1",
                  "flex items-center justify-center",
                  "bg-[var(--color-secondary)] text-[var(--color-void)]",
                  "font-mono text-[9px] font-bold",
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}

        {/* More button */}
        {hasMore && (
          <button
            onClick={onMoreClick}
            className={cn(
              "flex flex-col items-center justify-center",
              "min-w-[48px] min-h-[48px] px-3",
              "text-[var(--color-muted)]",
              "active:text-[var(--color-foreground)]",
              "transition-colors duration-100"
            )}
          >
            <MoreIcon className="w-5 h-5" />
            <span className="font-display text-[9px] uppercase tracking-wider mt-1">
              More
            </span>
          </button>
        )}
      </nav>
    )
  }
)
BottomBar.displayName = "BottomBar"

// =============================================================================
// MORE DRAWER (Mobile overflow menu)
// =============================================================================

interface MoreDrawerProps {
  items: NavItem[]
  isOpen: boolean
  onClose: () => void
}

const MoreDrawer: React.FC<MoreDrawerProps> = ({ items, isOpen, onClose }) => {
  const pathname = usePathname()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        "fixed bottom-16 left-0 right-0 z-50 lg:hidden",
        "bg-[var(--color-surface)] border-t-2 border-[var(--color-primary)]",
        "p-4",
        "animate-slide-up"
      )}>
        <div className="grid grid-cols-4 gap-4">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "py-3 px-2",
                  "transition-colors duration-100",
                  isActive ? [
                    "text-[var(--color-primary)]",
                    "bg-[var(--color-primary)]/10",
                  ] : [
                    "text-[var(--color-muted)]",
                    "active:text-[var(--color-foreground)]",
                  ]
                )}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="font-display text-[10px] uppercase tracking-wider text-center">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
MoreDrawer.displayName = "MoreDrawer"

// =============================================================================
// ICONS
// =============================================================================

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export { NavigationRail, BottomBar, MoreDrawer }
