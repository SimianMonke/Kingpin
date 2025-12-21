'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { CurrencyDisplay } from '@/components/layout/currency-display'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// =============================================================================
// NAVIGATION ITEMS
// =============================================================================

const NAV_SECTIONS = [
  {
    label: 'CORE',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
      { href: '/play', label: 'Play', icon: PlayIcon },
      { href: '/profile', label: 'Profile', icon: UserIcon },
    ],
  },
  {
    label: 'ECONOMY',
    items: [
      { href: '/inventory', label: 'Inventory', icon: BackpackIcon },
      { href: '/crates', label: 'Crates', icon: BoxIcon },
      { href: '/shop', label: 'Shop', icon: StoreIcon },
      { href: '/market', label: 'Black Market', icon: SkullIcon },
      { href: '/tokens', label: 'Tokens', icon: TokenIcon },
      { href: '/bonds', label: 'Bonds', icon: DiamondIcon },
    ],
  },
  {
    label: 'PROGRESS',
    items: [
      { href: '/missions', label: 'Missions', icon: TargetIcon },
      { href: '/achievements', label: 'Achievements', icon: TrophyIcon },
      { href: '/leaderboards', label: 'Leaderboards', icon: ChartIcon },
    ],
  },
  {
    label: 'SOCIAL',
    items: [
      { href: '/faction', label: 'Faction', icon: SwordsIcon },
      { href: '/events', label: 'Events', icon: AlertIcon },
    ],
  },
]

// Flat list for mobile
const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

// =============================================================================
// DASHBOARD NAVIGATION
// =============================================================================

export function DashboardNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50">
      {/* Glass background */}
      <div className="absolute inset-0 bg-[var(--color-void)]/95 backdrop-blur-md border-b-2 border-[var(--color-primary)]/30" />

      <div className="relative container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="font-display text-xl uppercase tracking-wider text-gradient-primary"
          >
            KINGPIN
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {ALL_NAV_ITEMS.slice(0, 8).map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 font-display text-xs uppercase tracking-wider transition-all',
                    isActive
                      ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden xl:inline">{item.label}</span>
                </Link>
              )
            })}

            {/* More dropdown for overflow items */}
            {ALL_NAV_ITEMS.length > 8 && (
              <MoreDropdown items={ALL_NAV_ITEMS.slice(8)} pathname={pathname} />
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Currency Display */}
            <div className="hidden md:block">
              <CurrencyDisplay />
            </div>

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Info */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="font-mono text-sm text-[var(--color-muted)]">
                {session?.user?.name}
              </span>
              <Button
                onClick={() => signOut({ callbackUrl: '/' })}
                variant="ghost"
                size="sm"
              >
                LOGOUT
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <XIcon className="w-6 h-6" />
              ) : (
                <MenuIcon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-[var(--color-primary)]/20">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="mb-4">
                <p className="font-display text-[10px] uppercase tracking-wider text-[var(--color-muted)] px-2 mb-2">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-3 font-display text-xs uppercase tracking-wider transition-all touch-target',
                          isActive
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-l-2 border-[var(--color-primary)]'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)]'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Mobile logout */}
            <div className="pt-4 border-t border-[var(--color-primary)]/20">
              <div className="flex items-center justify-between px-2">
                <span className="font-mono text-sm text-[var(--color-muted)]">
                  {session?.user?.name}
                </span>
                <Button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  variant="destructive"
                  size="sm"
                >
                  LOGOUT
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// =============================================================================
// MORE DROPDOWN
// =============================================================================

function MoreDropdown({
  items,
  pathname,
}: {
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  pathname: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 px-3 py-2 font-display text-xs uppercase tracking-wider transition-all',
          items.some((i) => pathname === i.href)
            ? 'text-[var(--color-primary)]'
            : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
        )}
      >
        MORE
        <ChevronDownIcon className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--color-surface)] border-2 border-[var(--color-primary)]/30 z-50">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 font-display text-xs uppercase tracking-wider transition-all',
                    isActive
                      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-primary)]/5'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function BackpackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3m18 0v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0H3m6-5v5m6-5v5" />
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function SkullIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.48 2 2 6.48 2 12v4a4 4 0 004 4h2v-4H6v-4c0-3.31 2.69-6 6-6s6 2.69 6 6v4h-2v4h2a4 4 0 004-4v-4c0-5.52-4.48-10-10-10z" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function SwordsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l9-9m0 0L21 3m-9 9l9 9M3 3l9 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M9 9l3-3 3 3M9 15l3 3 3-3" />
    </svg>
  )
}

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 9l10 13L22 9l-10-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 9h20M7 9l5 13 5-13" />
    </svg>
  )
}
