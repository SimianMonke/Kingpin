# Frontend UI Design Index

> Quick reference index for designing production-ready frontend interfaces. Reference this document when building UI components for the Kingpin project or any Next.js/Tailwind/Shadcn application.

---

## Document Registry

| Document | Purpose | Use When |
|----------|---------|----------|
| `nextjs-tailwind-shadcn-design-guide.md` | Core stack architecture & patterns | Starting any new component or page |
| `leaderboard-design-reference.md` | High-performance data displays | Building rankings, lists, real-time UIs |
| `ui-mcp-guide.md` | MCP tooling & validation workflows | Component discovery, generation, testing |
| `design-principles.md` | Cyberpunk diegetic interface checklist | Implementing Kingpin's visual identity |
| `style-guide.md` | Neon Noir color system & component specs | Styling any Kingpin UI element |

---

## Quick Navigation by Task

### 🏗️ Starting a New Component

**Architecture Decisions:**
- Server vs Client Component → `nextjs-tailwind-shadcn-design-guide.md` § Server Components vs Client Components
- Layout vs Template → `nextjs-tailwind-shadcn-design-guide.md` § Layout vs Template Decision
- File structure → `nextjs-tailwind-shadcn-design-guide.md` § Component File Structure

**Component Discovery:**
- Use Magic UI MCP `get_all_components` for pre-built animations
- Use 21st.dev `/ui` command to scaffold layouts
- Reference → `ui-mcp-guide.md` § The "Three Amigos" Workflow Pattern

---

## 🎭 Cyberpunk Design System (Kingpin)

> The UI is a **Diegetic Interface** — a physical "user terminal" existing within the game world, not an invisible layer.

### Core Philosophy
- **High-Tech, Low-Life:** Advanced technology (holography, neon, glass) meets systemic decay (glitch, noise, industrial roughness)
- **Visual Honesty:** Loading = "initialization sequences", Errors = "system failures"
- **Heavy Interaction Optimization:** Prioritize expert workflows over simplicity
- **Performance Parity:** Match 60 FPS native client feel with Optimistic UI

**References:**
- Full checklist → `design-principles.md` § I. Core Design Philosophy
- Implementation details → `style-guide.md` § 1. Design Philosophy

### Neon Noir Color Palette

| Token | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Deep Void** | `#050505` | `--color-void` | App background (OLED optimized) |
| **Obsidian Glass** | `#121212` | `--color-surface` | Card/panel backgrounds |
| **Electric Cyan** | `#00FFF1` | `--color-primary` | Primary actions, safe states |
| **Neon Magenta** | `#FF008D` | `--color-secondary` | Critical status, highlights |
| **System Red** | `#FF2A6D` | `--color-destructive` | Errors, destructive actions |
| **Terminal Green** | `#00FF9F` | `--color-success` | Console text, success states |
| **Retro Amber** | `#FFB000` | `--color-warning` | Warnings, legacy tech |
| **Dimming Layer** | `rgba(18,18,18,0.65)` | `--color-dim` | Text backdrop for contrast |

**Reference:** `style-guide.md` § 3. Color System

### Typography System

| Role | Font | Rules |
|------|------|-------|
| **Headings** | `Orbitron` | UPPERCASE, `tracking-widest`, Bold/Black |
| **Data/Body** | `Space Mono` | Monospaced, sentence case, high contrast |

**Key Patterns:**
- Use kinetic text (number tickers) for stats — data should feel "live"
- Replace spinners with hex dumps or "initialization sequences"

**Reference:** `style-guide.md` § 2. Typography

### Liquid Glass Materiality

```css
/* The core glass effect */
.glass-panel {
  background: rgba(18, 18, 18, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  /* 180% saturation prevents muddy/gray appearance */
}
```

**Key Properties:**
- Background colors should "bleed through" vibrantly
- Simulate optical refraction (distortion behind panels)
- Use adaptive dimming (35-50% opacity) for text contrast

**Reference:** `design-principles.md` § II. "Liquid Glass" Materiality

### Neo-Brutalist Components

**Shape Rules:**
- ✅ Sharp rectangular or 45° chamfered corners
- ❌ NO rounded "pill" buttons
- Thick borders: 2px-4px in high-contrast colors
- Hard shadows: solid color, 45° offset, **zero blur**

**The "Chip" Button Metaphor:**
```css
/* Static state */
.chip-button {
  box-shadow: 4px 4px 0 #000;
  transform: translate(0, 0);
}

/* Active/Pressed state */
.chip-button:active {
  box-shadow: none;
  transform: translate(4px, 4px);
}
```

**Reference:** `style-guide.md` § 5. Component Architecture

### Digital Decay Effects

| Effect | Implementation | Trigger |
|--------|----------------|---------|
| **Chromatic Aberration** | RGB channel offset (Red/Cyan) | Hover, errors |
| **Scanlines** | Linear-gradient overlay (<5% opacity) | Always on |
| **Noise Texture** | SVG filter or CSS grain | Backgrounds |
| **Screen Shake** | Transform animation | Errors |

**Reference:** `design-principles.md` § III. Digital Decay & Imperfection

### Bento Grid Layout

```
┌──────────┬─────┬─────┐
│          │     │     │
│  HERO    │ 1x1 │ 1x1 │
│  (2x2)   ├─────┴─────┤
│          │    2x1    │
├──────────┼───────────┤
│   1x1    │    2x1    │
└──────────┴───────────┘
```

**Rules:**
- Every data context lives in its own cell (no floating content)
- Hero cells = largest central block for primary subject
- "Card Play" = hover expands cells to reveal details (sparklines, etc.)
- Visible grid lines act as "struts" (exposed structure aesthetic)

**Reference:** `design-principles.md` § III. Modular Information Density

### Interaction States

**Hyper-Focus (Keyboard/Gamepad):**
```css
.interactive:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  filter: brightness(1.2);
  animation: pulse-glow 1s infinite;
}
```

**Optimistic UI Pattern:**
1. Visually update state immediately (before server confirmation)
2. On API failure → trigger "glitch rollback" effect
3. Narrative justification: "System interference detected"

**Touch Targets:**
- Minimum 48x48dp hit area (use invisible padding)
- Wrap hover effects in `@media (hover: hover)` for touch devices

**Reference:** `design-principles.md` § IV. Interaction Design

---

### 🎨 Design System & Theming (General)
```css
/* Core token structure - globals.css */
--background, --foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--destructive, --destructive-foreground
--border, --ring, --radius
```

**References:**
- CSS Variables setup → `nextjs-tailwind-shadcn-design-guide.md` § CSS Variables Theming
- OKLCH color model → `nextjs-tailwind-shadcn-design-guide.md` § OKLCH Color Model
- Dark mode implementation → `nextjs-tailwind-shadcn-design-guide.md` § Design Tokens & Systems
- Token verification → `ui-mcp-guide.md` § Programmatic Design Token Audit

**The `cn()` Helper (Critical):**
```typescript
import { cn } from "@/lib/utils"

// Combines clsx (conditionals) + tailwind-merge (conflict resolution)
className={cn(
  "base-styles",
  condition && "conditional-styles",
  className // Allow overrides
)}
```

---

### 📊 Data Displays & Leaderboards

**Psychology Principles:**
- Competence/Autonomy/Relatedness framework → `leaderboard-design-reference.md` § 1.1
- N-Effect mitigation (Macro + Micro leaderboards) → `leaderboard-design-reference.md` § 1.2
- Chase mechanic (show delta to next rank) → `leaderboard-design-reference.md` § 1.4

**Virtualization (Required for 1000+ items):**
- Library selection guide → `leaderboard-design-reference.md` § 3.2
- **React Virtuoso** recommended for production leaderboards
- Shadcn Table + Virtuoso integration → `leaderboard-design-reference.md` § 3.3

**Real-Time Updates:**
- Supabase Realtime integration → `leaderboard-design-reference.md` § 4
- Optimistic updates pattern → `leaderboard-design-reference.md` § 4.3

---

### ⚡ Animation & Motion

**Framer Motion Patterns:**
- Rank change animations → `leaderboard-design-reference.md` § 6
- Layout animations with `layoutId` → `leaderboard-design-reference.md` § 6.2
- Reduced motion support → `nextjs-tailwind-shadcn-design-guide.md` § Reduced Motion Support

**Animation Guidelines:**
```typescript
// Respect user preferences
import { useReducedMotion } from 'framer-motion'

const shouldReduceMotion = useReducedMotion()
```

**Magic UI Tools:**
- `getMotion` - Production-grade motion effects
- `getEffects` - Visual enhancement effects
- Reference → `ui-mcp-guide.md` § Enhancement Phase

---

### ♿ Accessibility Standards

**WCAG 2.2 Targets:**
| Criterion | Requirement |
|-----------|-------------|
| Color Contrast (AA) | 4.5:1 body, 3:1 large text |
| Keyboard Navigation | All elements focusable |
| Focus Indicators | `focus-visible:ring-2 ring-ring` |
| Screen Reader | Semantic HTML + ARIA |
| Reduced Motion | Check `prefers-reduced-motion` |

**Implementation:**
- Semantic HTML requirements → `nextjs-tailwind-shadcn-design-guide.md` § Semantic HTML Requirements
- Focus management → `nextjs-tailwind-shadcn-design-guide.md` § Focus Management
- Radix handles: keyboard nav, focus trapping, ARIA attributes

**Validation:**
- Use Playwright MCP `aria-snapshot` for accessibility tree validation
- Reference → `ui-mcp-guide.md` § Accessibility Tree Validation

---

### 🚀 Performance Optimization

**Core Web Vitals Targets:**
| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | `<Image>`, PPR, font preloading |
| INP | < 200ms | RSCs, code splitting |
| CLS | < 0.1 | Reserve space, persistent layouts |

**Key Patterns:**
- Server Components for data fetching (eliminate waterfalls)
- Streaming with Suspense boundaries → `nextjs-tailwind-shadcn-design-guide.md` § Streaming with Suspense
- Image optimization → `nextjs-tailwind-shadcn-design-guide.md` § Image Optimization
- Font loading → `nextjs-tailwind-shadcn-design-guide.md` § Font Loading
- Dynamic imports for heavy components → `nextjs-tailwind-shadcn-design-guide.md` § Code Splitting Patterns

---

### 🔄 Server Patterns

**Server Components (Default):**
```typescript
// No directive needed - fetches data server-side
async function Component() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

**Server Actions:**
```typescript
'use server'
export async function mutateData(formData: FormData) {
  await db.update(...)
  revalidatePath('/path')
}
```

**References:**
- Server Actions vs API Routes → `leaderboard-design-reference.md` § 2.4
- Server Action patterns → `nextjs-tailwind-shadcn-design-guide.md` § Server Action Pattern

---

### 📱 Responsive Design

**Breakpoints:**
```
sm:  640px+   (mobile landscape)
md:  768px+   (tablets)
lg:  1024px+  (laptops)
xl:  1280px+  (desktops)
2xl: 1536px+  (large screens)
```

**Spacing Scale:**
```
1 = 4px    2 = 8px    4 = 16px
6 = 24px   8 = 32px   12 = 48px
```

---

### 🧪 Validation & Testing

**Workflow (Three Amigos):**
1. **Planning** → Magic UI `get_all_components` / 21st.dev `inspiration_fetcher`
2. **Prototyping** → 21st.dev `/ui` command
3. **Enhancement** → Magic UI motion/effects tools
4. **Validation** → Playwright MCP browser automation
5. **Refinement** → Auto-refactor based on failures

**Playwright MCP Commands:**
- `browser_evaluate` - Design token verification
- `browser_resize` - Responsive breakpoint testing
- `aria-snapshot` - Accessibility audit
- `browser_console_messages` - Error detection

**Definition of Done:**
- [ ] Components sourced from Magic UI / 21st.dev
- [ ] Styling verified against design tokens
- [ ] Responsive breakpoints tested
- [ ] Accessibility audit passed

---

## Shadcn Component Quick Reference

| Component | Use Case |
|-----------|----------|
| `Button` | Primary actions, CTAs |
| `Card` | Content containers |
| `Dialog` | Modal overlays |
| `Sheet` | Slide-out panels |
| `DropdownMenu` | Action menus |
| `Command` | Search/command palette |
| `Table` | Data display |
| `Form` | Input handling |
| `Toast` / `Sonner` | Notifications |
| `Tabs` | Content organization |
| `Avatar` | User representations |
| `Skeleton` | Loading states |

---

## Essential Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "tailwindcss": "^4.0.0",
    "framer-motion": "^10.0.0",
    "react-virtuoso": "^4.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "sonner": "^1.0.0",
    "zod": "^3.0.0"
  }
}
```

---

## Decision Framework Checklist

When building any feature:

1. **Rendering** → Server or Client? (Default: Server)
2. **Data** → Where fetched? (Server Components / Server Actions)
3. **State** → Persistent or fresh? (Layout / Template)
4. **Styling** → Using design tokens? (CSS variables)
5. **Accessibility** → Keyboard nav? Focus? ARIA? (Radix primitives)
6. **Performance** → LCP/INP/CLS impact? (Optimize accordingly)
7. **Motion** → Respects reduced motion? (useReducedMotion)
8. **Validation** → Tested via Playwright MCP? (aria-snapshot pass)

---

## Kingpin-Specific Patterns

### CSS Theme Configuration
```css
/* globals.css - Neon Noir Theme for Tailwind v4 */
@theme {
  /* Base Layers */
  --color-void: #050505;
  --color-surface: #121212;
  --color-dim: rgba(18, 18, 18, 0.65);
  
  /* Accent Colors */
  --color-primary: #00FFF1;      /* Electric Cyan */
  --color-secondary: #FF008D;    /* Neon Magenta */
  --color-destructive: #FF2A6D;  /* System Red */
  --color-success: #00FF9F;      /* Terminal Green */
  --color-warning: #FFB000;      /* Retro Amber */
  
  /* Typography */
  --font-display: "Orbitron", sans-serif;
  --font-mono: "Space Mono", monospace;
}
```

### Module-Specific Patterns

**Inventory Management (Tetris Grid):**
- Desktop: Collision-aware drag-and-drop (green = valid, red = invalid)
- Mobile: Tap-to-Select → Tap-to-Move (no drag-and-drop)
- Preserve scroll position on "Back" navigation
- Reference → `design-principles.md` § V.A. Inventory Management

**Terminal/Data Interfaces:**
- Stream search results with typing effects
- Command line aesthetic with Terminal Green (`#00FF9F`)
- Boot sequence animations for loading states
- Reference → `design-principles.md` § V.B. Data & Terminal Interfaces

**Navigation Patterns:**
- Desktop: Persistent vertical Navigation Rail (left edge)
- Mobile: Bottom bar (4 items) + "System/More" drawer
- Master-Detail slide-over for drill-down (saves vertical space)
- Reference → `design-principles.md` § III. Adaptive Navigation Patterns

### Leaderboard Integration Points
- Global rankings → Use Macro leaderboard pattern
- Faction standings → Use Micro leaderboard (local dominance)
- Real-time score updates → Optimistic UI + glitch rollback on failure
- Juicernaut display → Highlight with `--color-primary` glow + "CURRENT JUICERNAUT" badge

### Game UI Components
| Component | Implementation |
|-----------|----------------|
| Player Stats | Bento grid cells + kinetic number tickers |
| Currency | `Space Mono` font + animated counters |
| Notifications | Sonner toast + chromatic aberration on critical |
| Combat Logs | React Virtuoso for performance |
| Loading States | Hex dumps / "INITIALIZING..." sequences |
| Error States | Screen shake + `--color-destructive` + "SYSTEM FAILURE" |

### Agentic Development Notes
- Define semantic tokens (e.g., `{{terminal-accent-primary}}`) for AI agents
- Configure Claude Code with `mcp-magic-ui` for component automation
- Use Manifest pattern: cache static data (lore, icons) locally to reduce API payloads ~90%
- Reference → `design-principles.md` § VI. CSS & Styling Architecture

---

*Index compiled from: ui-mcp-guide.md, leaderboard-design-reference.md, nextjs-tailwind-shadcn-design-guide.md, design-principles.md, style-guide.md*
