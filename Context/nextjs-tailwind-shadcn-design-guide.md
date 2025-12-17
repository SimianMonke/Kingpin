# Next.js 14+ / Tailwind CSS / Shadcn UI Design Reference

> A comprehensive reference for building high-performance web applications with modern architectural patterns.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Next.js 14 App Router](#nextjs-14-app-router)
3. [Tailwind CSS Styling](#tailwind-css-styling)
4. [Shadcn UI Components](#shadcn-ui-components)
5. [Design Tokens & Systems](#design-tokens--systems)
6. [Visual Design Patterns](#visual-design-patterns)
7. [Interaction Patterns](#interaction-patterns)
8. [Accessibility Standards](#accessibility-standards)
9. [Performance Optimization](#performance-optimization)
10. [Code Patterns & Utilities](#code-patterns--utilities)

---

## Architecture Overview

### Core Philosophy

Modern web applications in this stack are built on three pillars:

| Layer | Technology | Role |
|-------|------------|------|
| Infrastructure | Next.js 14+ (App Router) | Server-centric routing, rendering, data fetching |
| Styling | Tailwind CSS v4 | Utility-first CSS with design token system |
| Components | Shadcn UI + Radix | Accessible, customizable UI primitives |

### Key Principles

- **Server-First Rendering**: React Server Components (RSCs) by default
- **Code Ownership**: Components copied into project, not black-box dependencies
- **Colocation of Concerns**: Styles declared directly within markup
- **Performance as Aesthetic**: Speed and responsiveness as primary design goals
- **Accessibility as Foundation**: WCAG 2.2 compliance built into primitives

---

## Next.js 14 App Router

### File-System Routing Structure

The App Router uses a folder-based hierarchy where each folder represents a URL segment.

```
app/
├── layout.tsx          # Root layout (required) - wraps entire app
├── page.tsx            # Home page (/)
├── loading.tsx         # Global loading UI
├── error.tsx           # Global error boundary
├── dashboard/
│   ├── layout.tsx      # Dashboard layout (persists across dashboard pages)
│   ├── page.tsx        # /dashboard
│   ├── loading.tsx     # Dashboard-specific loading
│   └── settings/
│       ├── page.tsx    # /dashboard/settings
│       └── template.tsx # Re-renders on each navigation
```

### Routing Components Reference

| Component | File | Behavior | Use Case |
|-----------|------|----------|----------|
| **Root Layout** | `app/layout.tsx` | Required; defines `<html>` and `<body>`; persists globally | Global navigation, themes, font declarations |
| **Nested Layout** | `app/[segment]/layout.tsx` | Scoped to folder; preserves state across sibling pages | Sidebars, section-specific headers |
| **Template** | `app/[segment]/template.tsx` | Re-renders on every navigation; mounts fresh instances | Page transitions, localized state resets, per-page analytics |
| **Loading UI** | `app/[segment]/loading.tsx` | Automatically wraps children in `<Suspense>` boundary | Skeleton screens, progressive content streaming |
| **Error Boundary** | `app/[segment]/error.tsx` | Client component that catches runtime failures within scope | Graceful degradation, segment-level recovery |
| **Not Found** | `app/[segment]/not-found.tsx` | Handles 404 errors within segment | Custom 404 pages |

### Layout vs Template Decision

```
Use LAYOUT when:
├── State should persist across navigations
├── Expensive components shouldn't re-mount (sidebars, media players)
└── Shared UI wraps multiple child routes

Use TEMPLATE when:
├── Fresh state needed per navigation
├── Enter/exit animations required
├── Per-page analytics tracking
└── useEffect should run on each page visit
```

### Server Components vs Client Components

```tsx
// Default: Server Component (no directive needed)
// - Can fetch data directly
// - Reduces client JS bundle
// - Cannot use hooks or browser APIs

// Client Component (add directive)
'use client'
// - Can use useState, useEffect, etc.
// - Required for interactivity
// - Runs in browser
```

**Decision Matrix:**

| Need | Component Type |
|------|----------------|
| Data fetching | Server |
| Static content | Server |
| SEO-critical content | Server |
| useState/useEffect | Client |
| Event handlers (onClick, onChange) | Client |
| Browser APIs (localStorage, geolocation) | Client |
| Third-party client libraries | Client |

### Rendering Strategies

#### Streaming with Suspense

Break UI into chunks; send to client as processed:

```tsx
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div>
      <Header /> {/* Renders immediately */}
      
      <Suspense fallback={<MetricsSkeleton />}>
        <SlowMetricsComponent /> {/* Streams in when ready */}
      </Suspense>
      
      <Suspense fallback={<ChartSkeleton />}>
        <ExpensiveChart /> {/* Independent streaming */}
      </Suspense>
    </div>
  )
}
```

#### Partial Prerendering (PPR)

Static shell + dynamic slots in single request:

```tsx
// Static: pre-rendered at build time
<Header />
<ProductDescription />

// Dynamic: rendered on-demand
<Suspense fallback={<CartSkeleton />}>
  <UserCart /> {/* Personalized, streams in */}
</Suspense>
```

---

## Tailwind CSS Styling

### Utility-First Philosophy

**Colocation over Separation**: Styles live with markup, eliminating CSS file switching and preventing unused style accumulation.

```tsx
// Traditional approach (separation)
// styles.css: .card { padding: 1.5rem; border-radius: 0.5rem; }
// component.tsx: <div className="card">

// Utility-first approach (colocation)
<div className="p-6 rounded-lg bg-card shadow-sm">
```

### Tailwind v4 Key Features

| Feature | v3 | v4 |
|---------|----|----|
| Engine | PostCSS-based | Oxide engine (Rust) |
| Configuration | JavaScript (`tailwind.config.js`) | CSS-first (`@theme` directive) |
| Build Speed | Baseline | Up to 5x faster |
| Color Support | sRGB (HSL/RGB) | P3 and OKLCH (wide gamut) |
| Installation | Multi-step config | Zero-config / single `@import` |

### CSS-First Configuration (v4)

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.7 0.15 250);
  --color-secondary: oklch(0.6 0.1 200);
  --radius-lg: 0.75rem;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

### OKLCH Color Model

OKLCH provides perceptually uniform colors (consistent brightness across hues):

```
OKLCH(L C H)
├── L: Lightness (0-1, perceptually uniform)
├── C: Chroma (color intensity)
└── H: Hue (0-360 degrees)
```

**Why OKLCH over HSL:**
- HSL yellow at 50% lightness appears brighter than HSL blue at 50%
- OKLCH maintains consistent perceived brightness
- Critical for accessible contrast ratios across themes

---

## Shadcn UI Components

### Code Ownership Model

Unlike traditional libraries (Material UI, Bootstrap):

| Traditional Libraries | Shadcn UI |
|-----------------------|-----------|
| Installed as npm dependencies | Copied directly into project |
| Black-box API | Full source code access |
| Version updates may break | You control all changes |
| Limited customization | 100% ownership |

### Architecture Stack

```
Your Component
     │
     ▼
┌─────────────────────────────┐
│  Shadcn UI (Visual Layer)   │  ← Tailwind CSS styling
│  - Your styles              │
│  - Your markup              │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  Radix UI (Behavior Layer)  │  ← Headless primitives
│  - Keyboard navigation      │
│  - Focus management         │
│  - ARIA attributes          │
│  - Accessibility            │
└─────────────────────────────┘
```

### The `cn` Helper Function

Essential utility for conditional class merging:

```tsx
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<button className={cn(
  "px-4 py-2 rounded-lg",           // Base styles
  variant === "primary" && "bg-primary text-primary-foreground",
  variant === "ghost" && "bg-transparent hover:bg-accent",
  disabled && "opacity-50 cursor-not-allowed",
  className                          // Allow overrides
)}>
```

**Why cn():**
- `clsx`: Handles conditional classes
- `tailwind-merge`: Resolves Tailwind conflicts (e.g., `p-4 p-6` → `p-6`)

### CSS Variables Theming

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode values */
  }
}
```

---

## Design Tokens & Systems

### Spacing Scale

Based on 0.25rem (4px) increments for mathematical consistency:

```
Spacing(n) = n × 0.25rem

p-0  → 0px
p-1  → 0.25rem (4px)
p-2  → 0.5rem  (8px)
p-3  → 0.75rem (12px)
p-4  → 1rem    (16px)
p-5  → 1.25rem (20px)
p-6  → 1.5rem  (24px)
p-8  → 2rem    (32px)
p-10 → 2.5rem  (40px)
p-12 → 3rem    (48px)
```

**"Grid-less Grid" Effect**: Consistent spacing creates visual alignment without visible grid structures.

### Typography Scale

Based on 1.125 or 1.25 major-second ratio:

| Token | Size | Pixels | Use Case |
|-------|------|--------|----------|
| `text-xs` | 0.75rem | 12px | Captions, micro-copy |
| `text-sm` | 0.875rem | 14px | Secondary labels, small UI text |
| `text-base` | 1rem | 16px | Default body text |
| `text-lg` | 1.125rem | 18px | Section sub-headers |
| `text-xl` | 1.25rem | 20px | Primary section headers |
| `text-2xl` | 1.5rem | 24px | Hero headings, modal titles |
| `text-3xl` | 1.875rem | 30px | Page titles |
| `text-4xl` | 2.25rem | 36px | Hero sections |

### Color Semantic Roles

```
--background     → Page/app background
--foreground     → Primary text color
--card           → Card backgrounds
--card-foreground → Text on cards
--primary        → Primary actions, links
--primary-foreground → Text on primary
--secondary      → Secondary actions
--muted          → Subtle backgrounds
--muted-foreground → Subdued text
--accent         → Highlights, hover states
--destructive    → Errors, dangerous actions
--border         → Borders, dividers
--ring           → Focus rings
```

---

## Visual Design Patterns

### Glassmorphism

Frosted glass effect with depth and sophistication:

```tsx
<div className="
  bg-white/30 
  backdrop-blur-md 
  border border-white/20 
  shadow-xl 
  rounded-2xl 
  p-6
">
  <h2 className="text-white">Glassmorphic Card</h2>
  <p className="text-white/80">Content with frosted backdrop.</p>
</div>
```

**Key Properties:**
- Background opacity: 10-40% (`bg-white/30`)
- Blur radius: 8-16px (`backdrop-blur-md` or `backdrop-blur-lg`)
- Subtle border: `border-white/20`
- Shadow for depth: `shadow-xl`

### Bento Grids

Asymmetrical grid layouts for dashboard organization:

```tsx
<div className="grid grid-cols-12 gap-4">
  {/* Hero module - spans 8 columns */}
  <div className="col-span-8 row-span-2 rounded-2xl bg-card p-6">
    <MainMetric />
  </div>
  
  {/* Secondary modules */}
  <div className="col-span-4 rounded-2xl bg-card p-6">
    <SecondaryMetric />
  </div>
  
  <div className="col-span-4 rounded-2xl bg-card p-6">
    <NotificationFeed />
  </div>
  
  {/* Full-width module */}
  <div className="col-span-12 rounded-2xl bg-card p-6">
    <DataChart />
  </div>
</div>
```

**Bento Grid Properties:**

| Feature | Implementation | Effect |
|---------|----------------|--------|
| Asymmetrical sizing | `col-span-*`, `row-span-*` | Dynamic visual hierarchy |
| Rounded corners | `rounded-2xl` (1rem+) | Modern, friendly aesthetic |
| Consistent gaps | `gap-4` (1rem) or `gap-6` (1.5rem) | Rigorous rhythm |
| Interactive states | `hover:scale-[1.02]`, `hover:shadow-lg` | Enhanced tactile feel |

### Visual Hierarchy Principles

1. **Size**: Larger elements draw attention first
2. **Color**: High contrast for primary actions; muted for secondary
3. **Placement**: Top-left reads first (F-pattern scanning)
4. **White Space**: Generous padding creates breathing room

```tsx
// CTA hierarchy example
<button className="bg-primary text-primary-foreground px-6 py-3 text-lg font-semibold">
  Primary Action
</button>

<button className="bg-secondary text-secondary-foreground px-4 py-2">
  Secondary Action
</button>

<button className="text-muted-foreground hover:text-foreground">
  Tertiary Link
</button>
```

---

## Interaction Patterns

### Command Palette (CMD+K)

Universal navigation for power users:

```tsx
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

export function CommandMenu() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem>Dashboard</CommandItem>
          <CommandItem>Settings</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem>Create New...</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Data Tables Best Practices

For enterprise-scale datasets:

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| Server-side processing | Next.js Server Actions | Small client bundle, responsive UI |
| Faceted filtering | Command-palette style dropdowns | Complex multi-layer queries |
| URL state persistence | `nuqs` library | Shareable table state via URL |
| Virtual scrolling | TanStack Virtual | Handle 10k+ rows smoothly |

### Optimistic UI

Update UI immediately, rollback on error:

```tsx
'use client'
import { useOptimistic } from 'react'

function LikeButton({ initialLikes, postId }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    initialLikes,
    (state, newLike) => state + 1
  )

  async function handleLike() {
    addOptimisticLike(1) // Immediate UI update
    
    try {
      await likePost(postId) // Server action
    } catch (error) {
      // Rollback handled automatically
    }
  }

  return (
    <button onClick={handleLike}>
      ❤️ {optimisticLikes}
    </button>
  )
}
```

### Micro-Interaction Timing

| Interaction Type | Duration | Easing |
|------------------|----------|--------|
| UI Feedback (hover, press) | 150-300ms | ease-out |
| State Transitions | 300-500ms | ease-in-out |
| Page Transitions | 300-500ms | ease-out-cubic |
| Loading Spinners | 200-400ms | linear |

```tsx
// Framer Motion example
import { motion } from 'framer-motion'

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ 
    duration: 0.3, 
    ease: [0.33, 1, 0.68, 1] // ease-out-cubic
  }}
>
  Content
</motion.div>
```

---

## Accessibility Standards

### WCAG 2.2 Compliance Targets

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| Color Contrast (AA) | 4.5:1 body text, 3:1 large text | Use semantic color tokens |
| Keyboard Navigation | All interactive elements focusable | Radix handles automatically |
| Focus Indicators | Visible focus states | `focus-visible:ring-2 ring-ring` |
| Screen Reader Support | Semantic HTML + ARIA | Radix provides ARIA management |
| Reduced Motion | Respect `prefers-reduced-motion` | Check media query |

### Semantic HTML Requirements

```tsx
// CORRECT: Semantic structure
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/dashboard">Dashboard</a></li>
    </ul>
  </nav>
</header>

<main>
  <h1>Page Title</h1>
  <section aria-labelledby="metrics-heading">
    <h2 id="metrics-heading">Metrics</h2>
    {/* Content */}
  </section>
</main>

<aside aria-label="Sidebar">
  {/* Secondary content */}
</aside>

<footer>
  {/* Footer content */}
</footer>
```

### Focus Management

```tsx
// Dialog focus trapping (Radix handles this)
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    {/* Focus automatically trapped within dialog */}
    {/* Escape key closes dialog */}
    {/* Focus returns to trigger on close */}
  </DialogContent>
</Dialog>

// Manual focus management
const inputRef = useRef<HTMLInputElement>(null)

useEffect(() => {
  inputRef.current?.focus()
}, [])
```

### Reduced Motion Support

```tsx
// CSS approach
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

// Framer Motion approach
import { useReducedMotion } from 'framer-motion'

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion()
  
  return (
    <motion.div
      animate={{ y: shouldReduceMotion ? 0 : [0, -10, 0] }}
    />
  )
}
```

---

## Performance Optimization

### Core Web Vitals Targets

| Metric | Target | Optimization Strategy |
|--------|--------|----------------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Next.js `<Image>`, PPR, font preloading |
| **INP** (Interaction to Next Paint) | < 200ms | RSCs, reduced client JS, code splitting |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Reserve image space, persistent layouts |

### Image Optimization

```tsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority           // LCP image - preload
  placeholder="blur" // Prevent CLS
  blurDataURL="..."  // Base64 placeholder
/>
```

### Font Loading

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',        // Prevent FOIT
  variable: '--font-sans',
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### Code Splitting Patterns

```tsx
// Dynamic imports for heavy components
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(() => import('@/components/Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // Client-only component
})

// Route-based splitting (automatic with App Router)
// Each page.tsx is automatically code-split
```

---

## Code Patterns & Utilities

### Component File Structure

```
components/
├── ui/                    # Shadcn UI primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── forms/                 # Form-specific components
│   ├── login-form.tsx
│   └── settings-form.tsx
├── layout/                # Layout components
│   ├── header.tsx
│   ├── sidebar.tsx
│   └── footer.tsx
└── [feature]/             # Feature-specific components
    ├── dashboard-metrics.tsx
    └── user-profile-card.tsx
```

### Server Action Pattern

```tsx
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createItem(formData: FormData) {
  const name = formData.get('name')
  
  // Database operation
  await db.items.create({ name })
  
  // Revalidate cache
  revalidatePath('/items')
  
  return { success: true }
}

// Component usage
import { createItem } from '@/app/actions'

function CreateForm() {
  return (
    <form action={createItem}>
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  )
}
```

### Loading States Pattern

```tsx
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />       {/* Title */}
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-32" />         {/* Card 1 */}
        <Skeleton className="h-32" />         {/* Card 2 */}
        <Skeleton className="h-32" />         {/* Card 3 */}
      </div>
      <Skeleton className="h-64" />           {/* Chart */}
    </div>
  )
}
```

### Error Boundary Pattern

```tsx
// app/dashboard/error.tsx
'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground mt-2">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
      >
        Try again
      </button>
    </div>
  )
}
```

---

## Quick Reference Cards

### Tailwind Spacing Cheatsheet

```
p-0   = 0       m-0   = 0
p-1   = 4px     m-1   = 4px
p-2   = 8px     m-2   = 8px
p-4   = 16px    m-4   = 16px
p-6   = 24px    m-6   = 24px
p-8   = 32px    m-8   = 32px

gap-2 = 8px     space-y-2 = 8px
gap-4 = 16px    space-y-4 = 16px
gap-6 = 24px    space-y-6 = 24px
```

### Common Shadcn Components

```
Button     → Primary actions, CTAs
Card       → Content containers
Dialog     → Modal overlays
Sheet      → Slide-out panels
DropdownMenu → Action menus
Command    → Search/command palette
Table      → Data display
Form       → Input handling
Toast      → Notifications
Tabs       → Content organization
```

### Responsive Breakpoints

```
sm:  → 640px+   (mobile landscape)
md:  → 768px+   (tablets)
lg:  → 1024px+  (laptops)
xl:  → 1280px+  (desktops)
2xl: → 1536px+  (large screens)
```

---

## Summary: Design Decision Framework

When building a feature, follow this mental checklist:

1. **Rendering**: Server or Client component? → Default to Server
2. **Data**: Where fetched? → Server components or Server Actions
3. **State**: Persistent or fresh? → Layout or Template
4. **Styling**: Consistent tokens? → Use design system values
5. **Accessibility**: Keyboard nav? Focus management? → Use Radix primitives
6. **Performance**: LCP/INP/CLS impact? → Optimize images, reduce JS
7. **UX**: Immediate feedback? → Optimistic UI, micro-interactions
