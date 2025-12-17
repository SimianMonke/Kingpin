# Kingpin Frontend Redesign Process

> Consensus-driven process for implementing the Cyberpunk "Diegetic Interface" design system.

---

## Executive Summary

**Approach:** Component-First Incremental Redesign (9/10 confidence rating)

**Rationale:** The Cyberpunk Diegetic Interface requires HIGH implementation complexity due to custom effects (chromatic aberration, scanlines, glitch rollback), Neo-Brutalist component overhauls, and accessibility requirements against chaotic backgrounds. A full page-sweep approach would incur higher risk and potential rework. Building foundational components first ensures consistency and reduces technical debt.

---

## Current State Analysis

### Existing Pages (15 total)
```
(auth)/login
(dashboard)/achievements
(dashboard)/dashboard
(dashboard)/inventory
(dashboard)/leaderboards
(dashboard)/missions
(dashboard)/profile
(dashboard)/shop
(dashboard)/market
(dashboard)/faction
(dashboard)/crates
(dashboard)/events
```

### Current CSS Gaps
| Requirement | Current State | Target State |
|-------------|---------------|--------------|
| Background | `#030712` | `#050505` (Deep Void) |
| Primary | `#8b5cf6` (Purple) | `#00FFF1` (Electric Cyan) |
| Secondary | `#1f2937` | `#FF008D` (Neon Magenta) |
| Error | `#ef4444` | `#FF2A6D` (System Red) |
| Glass Effect | `blur(12px)` | `blur(16px) saturate(180%)` |
| Typography | Inter/system | Orbitron + Space Mono |
| Borders | 1px rounded | 2-4px chamfered/sharp |
| Shadows | Standard blur | Hard 45deg no-blur |

---

## Phase 1: Design System Foundation (Week 1)

### 1.1 Update globals.css with Neon Noir Palette

```css
/* Target globals.css structure */
@import "tailwindcss";

/* ===== NEON NOIR COLOR SYSTEM ===== */
:root {
  /* Base Layers */
  --color-void: #050505;           /* App background (OLED optimized) */
  --color-surface: #121212;        /* Card/panel backgrounds */
  --color-dim: rgba(18, 18, 18, 0.65); /* Text backdrop for contrast */

  /* Accent Colors */
  --color-primary: #00FFF1;        /* Electric Cyan - Primary actions */
  --color-secondary: #FF008D;      /* Neon Magenta - Highlights */
  --color-destructive: #FF2A6D;    /* System Red - Errors */
  --color-success: #00FF9F;        /* Terminal Green - Success */
  --color-warning: #FFB000;        /* Retro Amber - Warnings */

  /* Typography */
  --font-display: "Orbitron", sans-serif;
  --font-mono: "Space Mono", monospace;
}
```

### 1.2 Install Required Fonts

```bash
# Add to web/src/app/layout.tsx
npm install @fontsource/orbitron @fontsource/space-mono
```

### 1.3 Create Liquid Glass Utility Classes

```css
/* Liquid Glass Materiality */
.glass-panel {
  background: rgba(18, 18, 18, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  border: 2px solid rgba(0, 255, 241, 0.2);
}

.glass-panel-bright {
  background: rgba(18, 18, 18, 0.45);
  backdrop-filter: blur(16px) saturate(200%);
}
```

### 1.4 Create Neo-Brutalist Foundation Classes

```css
/* Neo-Brutalist Structuralism */
.neo-border {
  border: 2px solid var(--color-primary);
}

.neo-border-thick {
  border: 4px solid var(--color-primary);
}

/* Chamfered corners (45-degree cuts) */
.chamfer {
  clip-path: polygon(
    8px 0, calc(100% - 8px) 0,
    100% 8px, 100% calc(100% - 8px),
    calc(100% - 8px) 100%, 8px 100%,
    0 calc(100% - 8px), 0 8px
  );
}

/* Hard shadows - "The Chip" */
.chip-shadow {
  box-shadow: 4px 4px 0 #000;
  transform: translate(0, 0);
  transition: box-shadow 0.1s, transform 0.1s;
}

.chip-shadow:active {
  box-shadow: none;
  transform: translate(4px, 4px);
}
```

### 1.5 Create Digital Decay Effect Classes

```css
/* Digital Decay */
.scanlines {
  position: relative;
}

.scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
}

.chromatic-hover:hover {
  text-shadow:
    -1px 0 #ff0000,
    1px 0 #00ffff;
}

/* Noise texture */
.noise {
  position: relative;
}

.noise::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
}
```

### Phase 1 Validation Checkpoint
- [ ] All Neon Noir colors defined as CSS variables
- [ ] Orbitron and Space Mono fonts loading
- [ ] Liquid Glass effect renders with 180% saturation
- [ ] Chip shadow animates on click
- [ ] Scanlines overlay visible at <5% opacity
- [ ] WCAG contrast ratio passes for primary text

---

## Phase 2: Component Library Rebuild (Weeks 2-3)

### Priority Order (by usage frequency)

| Priority | Component | Key Changes |
|----------|-----------|-------------|
| P0 | Button | Chamfered corners, chip shadow, no rounded-full |
| P0 | Card | Glass panel, thick borders, visible struts |
| P0 | Input | Sharp edges, cyan focus ring, terminal styling |
| P1 | Navigation Rail | Vertical desktop nav, mobile bottom bar |
| P1 | Badge/Chip | Neo-brutalist, tier colors |
| P1 | Table | Bento grid structure, kinetic numbers |
| P2 | Dialog/Modal | Glass panel, chromatic aberration on open |
| P2 | Toast | Glitch effect on error, terminal styling |
| P2 | Skeleton | Hex dump / "INITIALIZING..." sequences |

### 2.1 Button Component Redesign

```tsx
// web/src/components/ui/button.tsx
const buttonVariants = cva(
  // Base: Neo-Brutalist
  "inline-flex items-center justify-center font-display uppercase tracking-widest " +
  "border-2 transition-all duration-100 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
  // Chip shadow effect
  "shadow-[4px_4px_0_#000] translate-x-0 translate-y-0 " +
  "active:shadow-none active:translate-x-1 active:translate-y-1",
  {
    variants: {
      variant: {
        default: "bg-surface border-primary text-primary hover:bg-primary hover:text-void",
        destructive: "bg-surface border-destructive text-destructive hover:bg-destructive hover:text-void",
        ghost: "border-transparent shadow-none hover:border-primary/50",
      },
      size: {
        default: "h-12 px-6 text-sm",
        sm: "h-10 px-4 text-xs",
        lg: "h-14 px-8 text-base",
      },
    },
  }
)
```

### 2.2 Card Component Redesign

```tsx
// web/src/components/ui/card.tsx
const Card = ({ className, ...props }) => (
  <div
    className={cn(
      // Liquid Glass base
      "bg-surface/65 backdrop-blur-lg backdrop-saturate-[180%]",
      // Neo-Brutalist borders
      "border-2 border-primary/20",
      // Scanlines overlay
      "relative scanlines",
      className
    )}
    {...props}
  />
)
```

### 2.3 Navigation Rail (Desktop)

```tsx
// Vertical rail on left edge
// 64px width, full height
// Icon + label stack
// Active state: cyan left border + glow
```

### 2.4 Bottom Bar (Mobile)

```tsx
// 4 primary actions + System/More drawer
// 48px touch targets minimum
// Haptic feedback on interaction
```

### Phase 2 Validation Checkpoint
- [ ] All buttons use chip shadow, no rounded corners
- [ ] Cards have Liquid Glass effect with visible borders
- [ ] Focus states have blinking neon outline
- [ ] Touch targets >= 48x48dp
- [ ] Hover effects wrapped in `@media (hover: hover)`
- [ ] Playwright visual regression tests pass

---

## Phase 3: Page-Level Implementation (Weeks 4-6)

### Implementation Order (by traffic/impact)

| Week | Pages | Focus | Status |
|------|-------|-------|--------|
| 4 | Dashboard, Profile | Hero layout, Bento grid, kinetic stats | ✅ COMPLETE |
| 5 | Shop, Inventory | Product grid, Equipment slots, Durability bars | ✅ COMPLETE |
| 5 | Leaderboards | Rank display, Hall of Fame, Period filters | ✅ COMPLETE |
| 6 | Missions, Achievements | Progress bars, category tabs, tier badges | ✅ COMPLETE |
| 6 | Faction, Crates | Territory map, crate animations | ✅ COMPLETE |

### 3.1 Dashboard Page (Bento Grid Layout) ✅ COMPLETE

**Implemented Features:**
- Bento grid with 2x2 hero cell (player identity)
- KineticNumber component for animated stat tickers
- CurrencyDisplay and XPDisplay pre-configured components
- StatValue component for labeled stats
- Glass panel cards with scanlines overlay
- TierBadge and AccountIndicator sub-components
- Terminal-style loading with InitializingLoader
- Error states with chromatic aberration animation
- Neo-Brutalist buttons with chip shadow effect

**Grid Layout:**
```
┌──────────────┬─────────┬─────────┐
│              │  CASH   │  LEVEL  │
│   AVATAR     │  1x1    │   1x1   │
│    (2x2)     ├─────────┴─────────┤
│              │  LINKED SYSTEMS   │
├──────────────┼───────────────────┤
│   CRIMINAL   │     PROGRESS      │
│     2x1      │       2x1         │
└──────────────┴───────────────────┘
        + QUICK ACTIONS (1x4)
```

**New Components Created:**
- `web/src/components/ui/kinetic-number.tsx` - Animated number tickers
- `web/src/components/ui/initializing-loader.tsx` - Terminal boot sequence loaders

### 3.2 Shop Page ✅ COMPLETE

**Implemented Features:**
- Product grid with tier-colored borders
- KineticNumber for animated prices
- Item detail modal with purchase flow
- Tier access display (COMMON, UNCOMMON, RARE, LEGENDARY)
- Purchase history stats
- Terminal-style messaging (success/error)
- Neo-Brutalist item cards with hover glow

### 3.3 Inventory Page ✅ COMPLETE

**Implemented Features:**
- Equipment slots grid (Weapon, Armor, Business, Housing)
- Durability bars with color-coded health
- Tier-styled item cards
- Escrow section with claim functionality
- Item detail modal with equip/sell actions
- Slot icons with labels

### 3.4 Leaderboard Page ✅ COMPLETE

**Implemented Features:**
- Your Rankings card with period comparison
- Metric filter buttons (Wealth, XP, Grinders, Rob Masters)
- Period tabs (Daily, Weekly, Monthly, All-Time)
- Rank display with medal styling (1ST, 2ND, 3RD)
- Current user highlighting with left border
- Hall of Fame section with record display
- Tier-colored player names

### 3.5 Profile Page ✅ COMPLETE

**Implemented Features:**
- Neo-Brutalist card layout with glass panels
- Terminal-style form inputs
- TierBadge component with tier colors
- Linked Systems section with platform indicators
- Danger Zone with destructive button styling
- Error/success states with screen shake animation
- All text uppercase with monospace data display

### Phase 3 Validation Checkpoint (Weeks 4-5) ✅
- [x] Dashboard uses Bento grid structure
- [x] Profile uses Neo-Brutalist card layout
- [x] Kinetic number tickers on stats (KineticNumber component)
- [x] Loading states show "INITIALIZING..." sequences (InitializingLoader)
- [x] Error states trigger screen shake + chromatic aberration (.error-state class)
- [x] Shop page uses tier-styled product grid
- [x] Inventory page uses equipment slot layout with durability bars
- [x] Leaderboards use rank styling with Hall of Fame
- [ ] 60 FPS maintained on complex pages (needs testing)
- [ ] Mobile navigation uses bottom bar pattern (Week 6 implementation)

### 3.6 Missions Page ✅ COMPLETE

**Implemented Features:**
- Daily and Weekly mission sections with timers
- Progress bars with completion state styling
- Difficulty badges (EASY/MEDIUM/HARD)
- Category icons for mission types
- Claim rewards functionality
- Terminal-style reward notifications

### 3.7 Achievements Page ✅ COMPLETE

**Implemented Features:**
- Total progress bar with gradient fill
- Tier breakdown (Bronze/Silver/Gold/Platinum/Legendary)
- Recent unlocks horizontal scroll
- Category tabs with completion counters
- Achievement cards with progress bars
- Hidden achievement placeholders
- Tier-styled borders on completion

### 3.8 Faction Page ✅ COMPLETE

**Implemented Features:**
- Current faction card with scanlines
- Stats grid (Members, Territories, Rank, Points)
- Active buffs display with icons
- Assigned territory section
- Faction selector with cooldown warnings
- Territory map with score bars
- Faction standings with medal styling
- How It Works info section

### 3.9 Crates Page ✅ COMPLETE

**Implemented Features:**
- Tier-styled crate cards with glow effects
- Drop chances display per tier
- Open All button with count
- Opening animation overlay with bounce
- Result modal with tier styling
- Escrow section with claim buttons
- Expiration time formatting
- KineticNumber for animated counts

### Phase 3 Final Validation Checkpoint ✅
- [x] Missions page with progress bars
- [x] Achievements page with tier styling
- [x] Faction page with territory map
- [x] Crates page with open animations
- [x] Mobile bottom navigation bar

---

## Phase 4: Navigation & Polish ✅ COMPLETE

### 4.1 Mobile Bottom Navigation ✅ COMPLETE

**File:** `web/src/components/layout/mobile-nav.tsx`

**Features:**
- Fixed bottom bar with glass effect background
- 5 primary navigation items (Home, Shop, Items, Missions, Profile)
- Active state with top indicator line
- Touch-target sizing (48x48dp minimum)
- Hidden on desktop (lg:hidden)
- Safe area padding for notched devices

### 4.2 DashboardNav Redesign ✅ COMPLETE

**File:** `web/src/components/layout/dashboard-nav.tsx`

**Features:**
- Glass background with backdrop blur
- Neon Noir color scheme
- Section-grouped navigation (CORE, ECONOMY, PROGRESS, SOCIAL)
- MORE dropdown for overflow items
- Active state with underline indicator
- Mobile dropdown with section headers
- Button component integration

### 4.3 Dashboard Layout Update ✅ COMPLETE

**Changes:**
- Added MobileNav component to layout
- Added bottom padding for mobile (pb-24 lg:pb-8)
- Terminal boot sequence on auth loading

---

## Validation & Testing Strategy

### Automated Testing (Playwright MCP)

```typescript
// Visual regression for all component states
test('button states', async ({ page }) => {
  // Static state
  await page.screenshot({ path: 'button-static.png' })

  // Hover state
  await page.hover('button')
  await page.screenshot({ path: 'button-hover.png' })

  // Active state
  await page.mouse.down()
  await page.screenshot({ path: 'button-active.png' })
})

// Accessibility validation
test('accessibility', async ({ page }) => {
  const snapshot = await page.accessibility.snapshot()
  // Validate focus order, ARIA labels, contrast
})

// Design token verification
test('design tokens', async ({ page }) => {
  const primaryColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
  )
  expect(primaryColor.trim()).toBe('#00FFF1')
})
```

### Manual Validation Checklist

| Category | Check | Pass? |
|----------|-------|-------|
| **Colors** | Electric Cyan (#00FFF1) used for primary | [ ] |
| **Colors** | Deep Void (#050505) background | [ ] |
| **Typography** | Orbitron for all headings (UPPERCASE) | [ ] |
| **Typography** | Space Mono for data/numbers | [ ] |
| **Components** | No rounded-full/pill buttons | [ ] |
| **Components** | Chip shadow effect on buttons | [ ] |
| **Effects** | Liquid Glass blur+saturation | [ ] |
| **Effects** | Scanlines at <5% opacity | [ ] |
| **Accessibility** | 4.5:1 contrast ratio | [ ] |
| **Accessibility** | 48x48dp touch targets | [ ] |
| **Performance** | 60 FPS on Dashboard | [ ] |
| **Performance** | LCP < 2.5s | [ ] |

---

## Tooling Workflow

### Three Amigos Pattern

```
1. PLANNING
   └── Magic UI: get_all_components (discover animations)
   └── 21st.dev: inspiration_fetcher (layout patterns)

2. PROTOTYPING
   └── 21st.dev: /ui command (scaffold component)
   └── Claude: implement to spec

3. ENHANCEMENT
   └── Magic UI: getMotion (add animations)
   └── Magic UI: getEffects (add visual effects)

4. VALIDATION
   └── Playwright MCP: browser_snapshot (accessibility)
   └── Playwright MCP: browser_evaluate (token audit)
   └── Playwright MCP: browser_resize (responsive test)

5. REFINEMENT
   └── Auto-refactor based on validation failures
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance degradation from backdrop-filter | Profile early, use `will-change` sparingly |
| Browser compatibility issues | Feature detection, graceful degradation |
| Accessibility failures | Test contrast with adaptive dimming layer |
| Inconsistent component styling | Single source of truth in design tokens |
| Scope creep | Strict adherence to Phase boundaries |

---

## Success Metrics

- **Design Compliance:** 100% of components match design-principles.md checklist
- **Performance:** Dashboard loads in < 2.5s (LCP), maintains 60 FPS
- **Accessibility:** WCAG 2.2 AA compliance verified by Playwright
- **Consistency:** Zero visual regression failures in CI pipeline
- **User Experience:** Optimistic UI patterns on all mutations

---

*Document generated from multi-model consensus analysis (Gemini 2.5 Flash, 9/10 confidence)*
