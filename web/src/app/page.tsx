import Link from "next/link"
import { Suspense } from "react"
import { LiveFeedSection } from "./_components/live-feed-section"
import { StatsSection } from "./_components/stats-section"

// =============================================================================
// KINGPIN HOME PAGE
// Cyberpunk diegetic interface design
// =============================================================================

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col noise">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-20 relative">
        {/* Background Grid Lines (exposed structure aesthetic) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
              linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }} />
        </div>

        <div className="text-center max-w-6xl mx-auto relative z-10">
          {/* Logo/Title - Orbitron, UPPERCASE, tracking-widest */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-8xl font-black mb-6 tracking-widest">
            <span className="text-gradient-primary text-glow-primary chromatic-hover">
              KINGPIN
            </span>
          </h1>

          {/* Tagline - Space Mono */}
          <p className="font-data text-base sm:text-lg md:text-xl text-[var(--color-muted)] mb-8 max-w-2xl mx-auto leading-relaxed">
            The corporations are dead, the gangs are gods, and the streets run on blood and neon.
            <br />
            <span className="text-[var(--color-primary)]">Hustle, fight, and scheme your way to the top.</span>
          </p>

          {/* Status Badge - Neo-brutalist */}
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-[var(--color-surface)] border-2 border-[var(--color-primary)] mb-12">
            <span className="w-2 h-2 bg-[var(--color-success)] animate-pulse" />
            <span className="font-display text-xs tracking-widest text-[var(--color-primary)]">
              SYSTEM ONLINE
            </span>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <FeatureCell
              title="CROSS-PLATFORM"
              description="Play on Kick, Twitch, and Discord with linked accounts"
              icon="[NET]"
              accent="primary"
            />
            <FeatureCell
              title="ECONOMY RPG"
              description="Build wealth, buy items, complete missions, climb the ranks"
              icon="[SYS]"
              accent="success"
            />
            <FeatureCell
              title="FACTION WARFARE"
              description="Join factions, capture territories, earn exclusive rewards"
              icon="[WAR]"
              accent="secondary"
            />
          </div>

          {/* CTA Buttons - Neo-brutalist chip-style */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 font-display uppercase tracking-widest border-2 transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-void)] hover:bg-[var(--color-void)] hover:text-[var(--color-primary)] shadow-[4px_4px_0_#000] translate-x-0 translate-y-0 active:shadow-none active:translate-x-1 active:translate-y-1 h-14 px-8 text-sm"
            >
              {'>'} INITIALIZE
            </Link>
            <Link
              href="/leaderboards"
              className="inline-flex items-center justify-center gap-2 font-display uppercase tracking-widest border-2 transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 shadow-[4px_4px_0_#000] translate-x-0 translate-y-0 active:shadow-none active:translate-x-1 active:translate-y-1 h-14 px-8 text-sm"
            >
              VIEW LEADERBOARDS
            </Link>
          </div>
        </div>
      </section>

      {/* Stats & Live Feed Section - Bento Layout */}
      <section className="border-t-2 border-[var(--color-border)] py-8 md:py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stats Panel - 2 cols on large screens */}
            <div className="lg:col-span-2">
              <Suspense fallback={<StatsLoadingSkeleton />}>
                <StatsSection />
              </Suspense>
            </div>

            {/* Live Feed Panel - 1 col */}
            <div className="lg:col-span-1">
              <Suspense fallback={<FeedLoadingSkeleton />}>
                <LiveFeedSection />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--color-border)] py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--color-primary)]" />
            <span className="font-display text-xs tracking-widest text-[var(--color-muted)]">
              KINGPIN v1.0
            </span>
          </div>
          <p className="font-data text-xs text-[var(--color-muted)]">
            {'>'} Developed by{" "}
            <a
              href="https://kick.com/simianmonke"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors chromatic-hover"
            >
              SimianMonke
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}

// =============================================================================
// FEATURE CELL COMPONENT
// Bento grid cell with glass panel styling
// =============================================================================

function FeatureCell({
  title,
  description,
  icon,
  accent = "primary",
}: {
  title: string
  description: string
  icon: string
  accent?: "primary" | "secondary" | "success"
}) {
  const accentColors = {
    primary: "border-[var(--color-primary)] text-[var(--color-primary)]",
    secondary: "border-[var(--color-secondary)] text-[var(--color-secondary)]",
    success: "border-[var(--color-success)] text-[var(--color-success)]",
  }

  return (
    <div className="glass-panel p-6 group hover:glow-primary transition-all duration-300">
      {/* Icon Badge */}
      <div className={`inline-block px-2 py-1 border-2 ${accentColors[accent]} mb-4 font-display text-xs tracking-widest`}>
        {icon}
      </div>

      {/* Title */}
      <h3 className="font-display text-lg tracking-wider text-[var(--color-foreground)] mb-2 group-hover:chromatic-hover">
        {title}
      </h3>

      {/* Description */}
      <p className="font-data text-sm text-[var(--color-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  )
}

// =============================================================================
// LOADING SKELETONS
// Terminal-style loading states
// =============================================================================

function StatsLoadingSkeleton() {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 bg-[var(--color-primary)] animate-pulse" />
        <span className="font-display text-sm tracking-widest text-[var(--color-primary)]">
          GLOBAL METRICS
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-8 bg-[var(--color-surface)] animate-pulse" />
            <div className="h-4 w-20 bg-[var(--color-surface)] animate-pulse" />
          </div>
        ))}
      </div>
      <div className="mt-4 font-data text-xs text-[var(--color-muted)]">
        {'>'} LOADING SYSTEM DATA...
      </div>
    </div>
  )
}

function FeedLoadingSkeleton() {
  return (
    <div className="glass-panel">
      <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[var(--color-border)]">
        <span className="w-2 h-2 bg-[var(--color-success)] animate-pulse" />
        <span className="font-display text-sm tracking-widest text-[var(--color-primary)]">
          LIVE FEED
        </span>
      </div>
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 bg-[var(--color-surface)] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-[var(--color-surface)] animate-pulse" />
              <div className="h-3 w-full bg-[var(--color-surface)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t-2 border-[var(--color-border)] font-data text-xs text-[var(--color-muted)]">
        {'>'} INITIALIZING NETWORK MONITOR...
      </div>
    </div>
  )
}
