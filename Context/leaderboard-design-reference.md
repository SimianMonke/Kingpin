# Dynamic Leaderboard Architecture Reference

> Comprehensive guide for designing and implementing high-performance leaderboards in Next.js 14+ (App Router) with Tailwind CSS and Shadcn UI.

---

## Table of Contents

1. [Psychology & Design Principles](#1-psychology--design-principles)
2. [Next.js 14+ Architecture Patterns](#2-nextjs-14-architecture-patterns)
3. [High-Performance Virtualization](#3-high-performance-virtualization)
4. [Real-Time Synchronization](#4-real-time-synchronization)
5. [Visual Design System](#5-visual-design-system)
6. [Animation & Motion](#6-animation--motion)
7. [Accessibility](#7-accessibility)
8. [UX Patterns & Navigation](#8-ux-patterns--navigation)
9. [Security & Data Integrity](#9-security--data-integrity)
10. [Quick Reference Tables](#10-quick-reference-tables)

---

## 1. Psychology & Design Principles

### 1.1 Motivational Framework (Self-Determination Theory)

Effective leaderboards align with three innate human needs:

| Need | Leaderboard Function | Implementation |
|------|---------------------|----------------|
| **Competence** | Confirms mastery through rank feedback | Clear score/rank display, progress indicators |
| **Autonomy** | User controls their engagement level | Filter options, view preferences |
| **Relatedness** | Situates user within a community | Social features, clan/faction integration |

### 1.2 The N-Effect Problem

When users perceive top ranks as unreachable, motivation decreases. Mitigate with dual-modality displays:

**Macro Leaderboard (Global)**
- Shows absolute elite/top performers
- Serves aspirational function
- Defines the ceiling of possibility

**Micro Leaderboard (Local)**
- Filters to user's immediate vicinity (±5 ranks)
- Leverages "local dominance effect"
- Users are more motivated by overtaking near peers than chasing distant champions

### 1.3 Visual Hierarchy Principles

- Prioritize **relative positioning** over absolute scoring
- Use **progress bars** to visualize score delta to next rank (transforms numbers into spatial challenge)
- Implement **"Geeks Leaderboards"** for alternative metrics (consistency, helping others, time-spent)
- Guide the eye to the **user's own standing** using scale, color, and depth

### 1.4 Chase Mechanic

Show users exactly what they need to overtake the person above them:

```
┌─────────────────────────────────────────┐
│ #4  PlayerAbove      2,450 pts          │
│     ████████████████████░░░░  (92%)     │
├─────────────────────────────────────────┤
│ #5  YOU (Current)    2,250 pts          │
│     You need 201 pts to reach #4        │
└─────────────────────────────────────────┘
```

---

## 2. Next.js 14+ Architecture Patterns

### 2.1 Server Components for Initial Hydration

Eliminate the traditional SPA waterfall (download JS → parse → fetch API → render loader → render list) by fetching data in Server Components:

```typescript
// app/leaderboard/page.tsx (Server Component)
import { Suspense } from 'react';
import { GlobalLeaderboard } from './components/GlobalLeaderboard';
import { UserRankCard } from './components/UserRankCard';

async function getLeaderboardData(userId: string) {
  // Fetch concurrently to prevent blocking
  const [globalTop100, userRanking] = await Promise.all([
    fetchGlobalLeaderboard({ limit: 100 }),
    fetchUserRanking(userId),
  ]);
  
  return { globalTop100, userRanking };
}

export default async function LeaderboardPage() {
  const session = await getSession();
  const { globalTop100, userRanking } = await getLeaderboardData(session.userId);
  
  return (
    <div className="container">
      {/* Primary list loads immediately - no spinner */}
      <GlobalLeaderboard initialData={globalTop100} />
      
      {/* Secondary data streams in */}
      <Suspense fallback={<StatsSkeleton />}>
        <UserStatistics userId={session.userId} />
      </Suspense>
      
      {/* Sticky user rank card */}
      <UserRankCard data={userRanking} />
    </div>
  );
}
```

### 2.2 Streaming with Suspense Boundaries

Wrap auxiliary/secondary data in Suspense to ensure core ranking is never blocked:

```typescript
// Core ranking loads immediately
<LeaderboardTable data={rankings} />

// Historical trends stream in asynchronously
<Suspense fallback={<ChartSkeleton />}>
  <HistoricalTrendsChart userId={userId} />
</Suspense>

// Complex statistics stream in
<Suspense fallback={<StatsSkeleton />}>
  <DetailedUserStats userId={userId} />
</Suspense>
```

### 2.3 Server Actions for Mutations

Server Actions provide secure, type-safe mutations without manual API endpoints:

```typescript
// app/leaderboard/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function claimDailyReward() {
  const session = await auth();
  if (!session?.userId) throw new Error('Unauthorized');
  
  // Rate limiting check
  const lastClaim = await db.claims.findLast({ userId: session.userId });
  if (lastClaim && Date.now() - lastClaim.timestamp < 86400000) {
    throw new Error('Already claimed today');
  }
  
  // Perform the mutation
  const result = await db.transaction(async (tx) => {
    await tx.users.update({
      where: { id: session.userId },
      data: { score: { increment: 500 } },
    });
    
    await tx.claims.create({
      data: { userId: session.userId, type: 'daily', amount: 500 },
    });
    
    return tx.users.findUnique({ where: { id: session.userId } });
  });
  
  // Invalidate cached leaderboard
  revalidatePath('/leaderboard');
  
  return { newScore: result.score };
}
```

### 2.4 Server Actions vs API Routes Comparison

| Feature | Traditional API Route | Server Action |
|---------|----------------------|---------------|
| Invocation | `fetch('/api/update')` | Direct function call |
| Security | Manual token verification | Closure-based auth context |
| Bundle Size | Client validation logic | Logic stays on server |
| Progressive Enhancement | Requires JS | Works without JS (Forms) |
| Type Safety | Manual typing | Automatic type inference |

---

## 3. High-Performance Virtualization

### 3.1 Why Virtualization is Required

DOM nodes scale linearly with performance impact:
- Beyond ~1,000 nodes: scroll performance degrades below 60fps
- Beyond ~5,000 nodes: significant memory consumption
- Production leaderboards may have 100,000+ entries

**Virtualization (Windowing)** renders only visible items plus a small overscan buffer.

### 3.2 Library Selection Guide

| Library | Dynamic Heights | Sticky Headers | Bundle Size | Recommendation |
|---------|----------------|----------------|-------------|----------------|
| `react-window` | No (requires custom logic) | Difficult | Small | Fixed-size simple lists |
| `TanStack Virtual` | Yes | Manual CSS | Medium | Custom/complex layouts |
| `React Virtuoso` | Yes (automatic) | Yes (native) | Medium | **Production leaderboards** |

**React Virtuoso is recommended** for leaderboards because:
- Automatic dynamic row height measurement
- First-class sticky header/footer support
- Essential for keeping column labels and user's rank visible while scrolling

### 3.3 Shadcn Table + React Virtuoso Integration

Map Virtuoso's internal nodes to Shadcn's semantic table components:

```typescript
import { TableVirtuoso } from 'react-virtuoso';
import { forwardRef } from 'react';

// Custom component mappings for Shadcn compatibility
const virtuosoComponents = {
  Table: ({ style, ...props }: any) => (
    <table 
      style={style} 
      className="w-full caption-bottom text-sm" 
      {...props} 
    />
  ),
  
  TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <thead ref={ref} className="[&_tr]:border-b" {...props} />
  )),
  
  TableRow: ({ item, ...props }: any) => (
    <tr 
      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted" 
      {...props} 
    />
  ),
  
  TableBody: forwardRef<HTMLTableSectionElement>(({ style, ...props }, ref) => (
    <tbody 
      ref={ref} 
      style={style} 
      className="[&_tr:last-child]:border-0" 
      {...props} 
    />
  )),
};

export function VirtualizedLeaderboard({ data, totalCount }: Props) {
  return (
    <TableVirtuoso
      data={data}
      components={virtuosoComponents}
      fixedHeaderContent={() => (
        <tr>
          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Rank
          </th>
          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
            Player
          </th>
          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
            Score
          </th>
        </tr>
      )}
      itemContent={(index, user) => (
        <>
          <td className="p-4 align-middle">{user.rank}</td>
          <td className="p-4 align-middle">
            <UserCell user={user} />
          </td>
          <td className="p-4 align-middle text-right font-mono">
            {user.score.toLocaleString()}
          </td>
        </>
      )}
    />
  );
}
```

---

## 4. Real-Time Synchronization

### 4.1 Protocol Selection

| Protocol | Direction | Complexity | Best For |
|----------|-----------|------------|----------|
| **SSE (Server-Sent Events)** | Server → Client | Low | Leaderboards, feeds, notifications |
| **WebSockets** | Bidirectional | High | Bi-directional games, chat |
| **Polling (SWR)** | Client → Server | Low | Low-traffic, non-realtime lists |

**Recommendation**: For leaderboards, SSE or Supabase Realtime (WebSocket abstraction) are optimal.

### 4.2 Optimistic Updates with useOptimistic

Provide immediate feedback before server confirmation:

```typescript
'use client';

import { useOptimistic, useTransition } from 'react';
import { claimDailyReward } from './actions';
import { toast } from 'sonner';

export function ClaimButton({ currentScore }: { currentScore: number }) {
  const [isPending, startTransition] = useTransition();
  
  const [optimisticScore, setOptimisticScore] = useOptimistic(
    currentScore,
    (state, newScore: number) => newScore
  );

  async function handleClaim() {
    // Step 1: Optimistic update (immediate visual feedback)
    setOptimisticScore(currentScore + 500);
    
    startTransition(async () => {
      try {
        // Step 2: Server action
        const result = await claimDailyReward();
        
        // Step 3a: Success - UI syncs with server
        toast.success(`Claimed! New score: ${result.newScore}`);
      } catch (error) {
        // Step 3b: Failure - optimistic state auto-rolls back
        toast.error('Failed to claim reward');
      }
    });
  }

  return (
    <Button 
      onClick={handleClaim} 
      disabled={isPending}
      className={isPending ? 'opacity-70' : ''}
    >
      {isPending ? 'Claiming...' : 'Claim Daily (+500 pts)'}
    </Button>
  );
}
```

### 4.3 Optimistic Update Lifecycle

```
1. INTERACTION → User clicks "Complete Challenge (+500 pts)"
       ↓
2. OPTIMISTIC MUTATION → useOptimistic updates local state
       ↓                  Row moves up, highlighted as "pending"
3. SERVER ACTION → submitChallenge() executes on server
       ↓
4a. SUCCESS → Server returns confirmed score
              Optimistic state discarded, UI syncs with server
              
4b. FAILURE → Server throws error
              Optimistic state auto-rolls back
              Toast notification informs user
```

### 4.4 Conflict Resolution Strategy

**Server Authority Model**: Real-time packets always overwrite optimistic state if timestamps are newer. Optimistic state acts as a visual placeholder only.

### 4.5 Throttling High-Velocity Streams

For global leaderboards with hundreds of updates/second:

```typescript
'use client';

import { useRef, useEffect, useState } from 'react';

export function useThrottledUpdates<T>(
  realtimeSource: Observable<T[]>,
  intervalMs: number = 1000
) {
  const [displayData, setDisplayData] = useState<T[]>([]);
  const queueRef = useRef<T[]>([]);

  useEffect(() => {
    // Push incoming messages to queue (no immediate render)
    const subscription = realtimeSource.subscribe((update) => {
      queueRef.current = update;
    });

    // Process queue at stable intervals
    const intervalId = setInterval(() => {
      if (queueRef.current.length > 0) {
        setDisplayData(queueRef.current);
      }
    }, intervalMs);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [realtimeSource, intervalMs]);

  return displayData;
}
```

---

## 5. Visual Design System

### 5.1 Glassmorphism Recipe

Tailwind CSS classes for the glass effect:

```html
<!-- Glass Card Container -->
<div class="relative overflow-hidden rounded-xl bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl">
  <!-- Content -->
</div>
```

**Component Breakdown**:

| Property | Class | Purpose |
|----------|-------|---------|
| Background | `bg-slate-900/50` | High transparency with tint |
| Blur | `backdrop-blur-xl` | Separates foreground from background |
| Border | `border border-white/10` | Mimics physical glass edge |
| Shadow | `shadow-2xl` | Lifts pane off canvas |
| Overflow | `overflow-hidden rounded-xl` | Contains blur effect |

### 5.2 Sticky User Row (Glass Effect)

Keep the current user's rank visible at all times:

```typescript
// Sticky footer with glass effect
<div className="fixed bottom-0 left-0 right-0 z-50">
  <div className="mx-auto max-w-4xl p-4">
    <div className="rounded-xl bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-cyan-400">#{userRank}</span>
          <Avatar src={user.avatar} />
          <span className="font-medium">{user.name}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold">{user.score.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">
            {pointsToNextRank} pts to #{userRank - 1}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 5.3 Responsive Table-to-Card Transformation

Desktop shows data table; mobile shows card stack:

```typescript
export function LeaderboardRow({ rank, user, score, change }: RowProps) {
  return (
    <div className={cn(
      // Mobile: Card layout
      "flex flex-col gap-2 p-4 rounded-lg bg-white/5 mb-4",
      // Desktop: Table row layout
      "md:table-row md:bg-transparent md:p-0 md:rounded-none md:mb-0"
    )}>
      {/* Rank */}
      <div className="md:table-cell md:px-4 md:py-3">
        <span className="md:hidden text-xs text-muted-foreground">Rank: </span>
        <span className="font-bold text-lg md:text-base">{rank}</span>
      </div>
      
      {/* User */}
      <div className="md:table-cell md:px-4 md:py-3">
        <div className="flex items-center gap-3">
          <Avatar src={user.avatar} className="h-10 w-10 md:h-8 md:w-8" />
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground md:hidden">
              {user.clan}
            </div>
          </div>
        </div>
      </div>
      
      {/* Score */}
      <div className="md:table-cell md:px-4 md:py-3 md:text-right">
        <span className="md:hidden text-xs text-muted-foreground">Score: </span>
        <span className="font-mono font-bold">{score.toLocaleString()}</span>
      </div>
      
      {/* Change indicator */}
      <div className="md:table-cell md:px-4 md:py-3 md:text-right">
        <RankChange value={change} />
      </div>
    </div>
  );
}
```

### 5.4 Top 3 Podium Styling

Special treatment for elite ranks:

```typescript
const podiumStyles = {
  1: {
    bg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-500/50',
    icon: '👑',
    glow: 'shadow-yellow-500/20',
  },
  2: {
    bg: 'bg-gradient-to-r from-slate-300/20 to-slate-400/20',
    border: 'border-slate-400/50',
    icon: '🥈',
    glow: 'shadow-slate-400/20',
  },
  3: {
    bg: 'bg-gradient-to-r from-amber-600/20 to-orange-600/20',
    border: 'border-amber-600/50',
    icon: '🥉',
    glow: 'shadow-amber-600/20',
  },
};

export function PodiumRow({ rank, user, score }: PodiumRowProps) {
  const style = podiumStyles[rank as keyof typeof podiumStyles];
  
  return (
    <div className={cn(
      "rounded-lg border p-4 shadow-lg",
      style.bg,
      style.border,
      style.glow
    )}>
      <div className="flex items-center gap-4">
        <span className="text-3xl">{style.icon}</span>
        <Avatar src={user.avatar} className="h-12 w-12 ring-2 ring-white/20" />
        <div className="flex-1">
          <div className="font-bold text-lg">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.clan}</div>
        </div>
        <div className="text-2xl font-mono font-bold">
          {score.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Animation & Motion

### 6.1 Framer Motion Layout Animations

Smooth rank transitions when positions change:

```typescript
import { motion, AnimatePresence } from 'framer-motion';

export function AnimatedLeaderboardRow({ user, rank }: Props) {
  return (
    <motion.tr
      layoutId={`user-${user.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }}
    >
      <td>{rank}</td>
      <td>{user.name}</td>
      <td>{user.score}</td>
    </motion.tr>
  );
}

export function AnimatedLeaderboard({ users }: { users: User[] }) {
  return (
    <table>
      <tbody>
        <AnimatePresence mode="popLayout">
          {users.map((user, index) => (
            <AnimatedLeaderboardRow 
              key={user.id} 
              user={user} 
              rank={index + 1} 
            />
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  );
}
```

### 6.2 Rank Change Indicators

Visual feedback for position changes:

```typescript
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Minus } from 'lucide-react';

export function RankChange({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center text-muted-foreground">
        <Minus className="h-4 w-4" />
      </span>
    );
  }

  const isPositive = value > 0;
  
  return (
    <motion.span
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "flex items-center gap-1 font-medium",
        isPositive ? "text-green-500" : "text-red-500"
      )}
    >
      {isPositive ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )}
      <span>{Math.abs(value)}</span>
    </motion.span>
  );
}
```

### 6.3 Score Counter Animation

Animate score changes smoothly:

```typescript
import { useEffect, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';

export function AnimatedScore({ value }: { value: number }) {
  const { number } = useSpring({
    from: { number: 0 },
    number: value,
    delay: 200,
    config: { mass: 1, tension: 20, friction: 10 },
  });

  return (
    <animated.span className="font-mono font-bold tabular-nums">
      {number.to((n) => Math.floor(n).toLocaleString())}
    </animated.span>
  );
}
```

---

## 7. Accessibility

### 7.1 ARIA Semantics for Virtualized Lists

Virtualization hides most DOM nodes, breaking screen reader expectations. Explicitly provide position information:

```typescript
export function VirtualizedRow({ 
  user, 
  index, 
  totalCount 
}: VirtualizedRowProps) {
  return (
    <div
      role="row"
      aria-setsize={totalCount}
      aria-posinset={index + 1}
      aria-label={`Rank ${index + 1}: ${user.name}, ${user.score} points`}
    >
      {/* Row content */}
    </div>
  );
}
```

This informs screen readers: "Player One, Row 45 of 10,000"

### 7.2 Live Region Announcements

```typescript
export function useLeaderboardAnnouncements(userRank: number) {
  const previousRank = useRef(userRank);
  
  useEffect(() => {
    if (previousRank.current !== userRank) {
      const change = previousRank.current - userRank;
      
      // Only announce significant changes to the user
      if (Math.abs(change) >= 1) {
        announceToScreenReader(
          change > 0 
            ? `You moved up to rank ${userRank}` 
            : `You dropped to rank ${userRank}`
        );
      }
      
      previousRank.current = userRank;
    }
  }, [userRank]);
}

function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => announcement.remove(), 1000);
}
```

### 7.3 Live Region Strategy

| Update Type | aria-live | Behavior |
|-------------|-----------|----------|
| User rank change | `polite` | Announced when idle |
| Global updates | None | Visual only (prevents audio spam) |
| Error messages | `assertive` | Announced immediately |

### 7.4 Keyboard Navigation

React Virtuoso provides specialized keyboard navigation. Configure it to ensure focus isn't lost when items scroll off-screen:

```typescript
<TableVirtuoso
  data={data}
  // Enable keyboard navigation mode
  tabIndex={0}
  // Ensure focus follows scroll
  followOutput="auto"
/>
```

---

## 8. UX Patterns & Navigation

### 8.1 Navigation Model Comparison

| Pattern | Pros | Cons | Best For |
|---------|------|------|----------|
| **Infinite Scroll** | Discovery-friendly, fluid | Can't reach footer, no bookmarks | Social feeds |
| **Pagination** | Navigable, bookmarkable | Interrupts flow | Large datasets |
| **Hybrid** | Best of both | More complex | **Leaderboards** |

### 8.2 Hybrid Jump-To Architecture

Combine infinite scroll for browsing with precision controls:

```typescript
'use client';

import { useRef, useState } from 'react';
import { TableVirtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function LeaderboardWithJumpControls({ data, userRank }: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [jumpToRank, setJumpToRank] = useState('');

  const handleJump = (targetRank: number) => {
    virtuosoRef.current?.scrollToIndex({
      index: targetRank - 1,
      align: 'center',
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Jump Controls */}
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        {/* Quick Jump Buttons */}
        <Button variant="outline" size="sm" onClick={() => handleJump(1)}>
          Top 10
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleJump(100)}>
          Top 100
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleJump(userRank)}>
          My Rank
        </Button>
        
        {/* Custom Jump */}
        <div className="flex items-center gap-2 ml-auto">
          <Input
            type="number"
            placeholder="Jump to rank..."
            value={jumpToRank}
            onChange={(e) => setJumpToRank(e.target.value)}
            className="w-32"
          />
          <Button 
            size="sm"
            onClick={() => handleJump(parseInt(jumpToRank))}
            disabled={!jumpToRank}
          >
            Go
          </Button>
        </div>
      </div>

      {/* Virtualized List */}
      <TableVirtuoso
        ref={virtuosoRef}
        data={data}
        // ... component configuration
      />
    </div>
  );
}
```

### 8.3 Tier-Based Filtering

Allow users to filter by competitive tiers:

```typescript
const TIERS = [
  { name: 'Champion', range: [1, 10], color: 'text-yellow-500' },
  { name: 'Master', range: [11, 50], color: 'text-purple-500' },
  { name: 'Diamond', range: [51, 100], color: 'text-cyan-500' },
  { name: 'Platinum', range: [101, 500], color: 'text-slate-300' },
  { name: 'Gold', range: [501, 1000], color: 'text-amber-500' },
];

export function TierFilter({ onTierSelect }: { onTierSelect: (tier: Tier) => void }) {
  return (
    <div className="flex gap-2">
      {TIERS.map((tier) => (
        <Button
          key={tier.name}
          variant="ghost"
          size="sm"
          className={tier.color}
          onClick={() => onTierSelect(tier)}
        >
          {tier.name}
        </Button>
      ))}
    </div>
  );
}
```

---

## 9. Security & Data Integrity

### 9.1 Row Level Security (RLS)

When using Supabase, protect sensitive fields:

```sql
-- Only expose public leaderboard fields
CREATE POLICY "Public leaderboard read" ON users
FOR SELECT
USING (true)
WITH CHECK (false);

-- Create a view with only public columns
CREATE VIEW public_leaderboard AS
SELECT 
  id,
  username,
  avatar_url,
  score,
  rank,
  clan_id,
  created_at
FROM users
ORDER BY score DESC;
```

### 9.2 Server Component Data Fetching

Explicitly select only public fields:

```typescript
// app/leaderboard/page.tsx
async function fetchPublicLeaderboard() {
  const { data } = await supabase
    .from('users')
    .select('id, username, avatar_url, score, rank, clan_id')
    // DO NOT select: email, hashed_password, private_stats
    .order('score', { ascending: false })
    .limit(100);
    
  return data;
}
```

### 9.3 Rate Limiting Server Actions

Prevent script-based abuse:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(1, '1 m'), // 1 request per minute
  analytics: true,
});

// app/leaderboard/actions.ts
'use server';

import { ratelimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export async function claimDailyReward() {
  const ip = headers().get('x-forwarded-for') ?? 'unknown';
  
  const { success, limit, reset, remaining } = await ratelimit.limit(
    `claim_${ip}`
  );
  
  if (!success) {
    throw new Error(`Rate limited. Try again in ${Math.ceil((reset - Date.now()) / 1000)}s`);
  }
  
  // Process claim...
}
```

### 9.4 Input Validation

Always validate on the server:

```typescript
import { z } from 'zod';

const ClaimSchema = z.object({
  challengeId: z.string().uuid(),
  completedAt: z.string().datetime(),
});

export async function submitChallenge(formData: FormData) {
  const parsed = ClaimSchema.safeParse({
    challengeId: formData.get('challengeId'),
    completedAt: formData.get('completedAt'),
  });
  
  if (!parsed.success) {
    throw new Error('Invalid submission');
  }
  
  // Process valid data...
}
```

---

## 10. Quick Reference Tables

### 10.1 Technology Decision Matrix

| Requirement | Recommended Solution |
|-------------|---------------------|
| Initial page load | React Server Components |
| Secure mutations | Server Actions |
| Real-time updates | Supabase Realtime / SSE |
| Large list rendering | React Virtuoso |
| Component library | Shadcn UI |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| State management | React hooks + useOptimistic |

### 10.2 Performance Targets

| Metric | Target | Technique |
|--------|--------|-----------|
| First Meaningful Paint | < 1s | Server Components, streaming |
| Time to Interactive | < 2s | Code splitting, minimal client JS |
| Scroll Performance | 60fps | Virtualization |
| Memory Usage | Constant | Windowing (render only visible) |
| Update Latency | < 100ms perceived | Optimistic updates |

### 10.3 Real-Time Strategy Selection

| Use Case | Latency | Scalability | Recommended |
|----------|---------|-------------|-------------|
| Low-traffic, non-realtime | High | Low | Polling (SWR) |
| Bi-directional games, chat | Low | Medium | WebSockets |
| Leaderboards, feeds, notifications | Low | High | **Supabase Realtime / SSE** |
| Interaction feedback | Zero (perceived) | N/A | **Optimistic UI** |

### 10.4 Accessibility Checklist

- [ ] `aria-setsize` and `aria-posinset` on virtualized rows
- [ ] `aria-live="polite"` for user rank changes
- [ ] Keyboard navigation support
- [ ] Focus management in virtual lists
- [ ] Screen reader announcements for significant changes
- [ ] High contrast mode support
- [ ] Reduced motion preference respect

### 10.5 Essential Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-virtuoso": "^4.0.0",
    "framer-motion": "^10.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "sonner": "^1.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@upstash/ratelimit": "^1.0.0",
    "@upstash/redis": "^1.0.0"
  }
}
```

---

## Appendix: Complete Example Component

```typescript
// app/leaderboard/components/Leaderboard.tsx
'use client';

import { useRef, useState, useOptimistic, useTransition } from 'react';
import { TableVirtuoso, VirtuosoHandle } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  username: string;
  avatar_url: string;
  score: number;
  rank: number;
  rank_change: number;
}

interface LeaderboardProps {
  initialData: User[];
  currentUser: User;
  totalCount: number;
}

export function Leaderboard({ initialData, currentUser, totalCount }: LeaderboardProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [jumpToRank, setJumpToRank] = useState('');

  const handleJump = (targetRank: number) => {
    virtuosoRef.current?.scrollToIndex({
      index: targetRank - 1,
      align: 'center',
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative flex flex-col h-[80vh]">
      {/* Jump Controls */}
      <div className="flex items-center gap-2 p-4 bg-slate-900/50 backdrop-blur-sm border-b border-white/10">
        <Button variant="outline" size="sm" onClick={() => handleJump(1)}>
          Top 10
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleJump(100)}>
          Top 100
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => handleJump(currentUser.rank)}
          className="bg-cyan-600 hover:bg-cyan-700"
        >
          My Rank (#{currentUser.rank})
        </Button>
        
        <div className="flex items-center gap-2 ml-auto">
          <Input
            type="number"
            placeholder="Jump to rank..."
            value={jumpToRank}
            onChange={(e) => setJumpToRank(e.target.value)}
            className="w-32 bg-slate-800/50"
          />
          <Button 
            size="sm"
            onClick={() => handleJump(parseInt(jumpToRank))}
            disabled={!jumpToRank}
          >
            Go
          </Button>
        </div>
      </div>

      {/* Virtualized Table */}
      <div className="flex-1 overflow-hidden">
        <TableVirtuoso
          ref={virtuosoRef}
          data={initialData}
          components={{
            Table: ({ style, ...props }) => (
              <table 
                style={style} 
                className="w-full caption-bottom text-sm" 
                {...props} 
              />
            ),
            TableHead: React.forwardRef((props, ref) => (
              <thead ref={ref} className="[&_tr]:border-b sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10" {...props} />
            )),
            TableRow: ({ item, ...props }) => (
              <motion.tr 
                layoutId={`user-${item?.id}`}
                className={cn(
                  "border-b border-white/5 transition-colors hover:bg-white/5",
                  item?.id === currentUser.id && "bg-cyan-500/10 border-cyan-500/30"
                )}
                {...props} 
              />
            ),
            TableBody: React.forwardRef(({ style, ...props }, ref) => (
              <tbody ref={ref} style={style} className="[&_tr:last-child]:border-0" {...props} />
            )),
          }}
          fixedHeaderContent={() => (
            <tr>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-20">
                Rank
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Player
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-32">
                Score
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-20">
                Change
              </th>
            </tr>
          )}
          itemContent={(index, user) => (
            <>
              <td 
                className="p-4 align-middle font-bold"
                role="cell"
                aria-label={`Rank ${user.rank}`}
              >
                <span className={cn(
                  user.rank <= 3 && "text-xl",
                  user.rank === 1 && "text-yellow-500",
                  user.rank === 2 && "text-slate-300",
                  user.rank === 3 && "text-amber-600",
                )}>
                  {user.rank <= 3 ? ['👑', '🥈', '🥉'][user.rank - 1] : `#${user.rank}`}
                </span>
              </td>
              <td className="p-4 align-middle">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{user.username[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.username}</span>
                  {user.id === currentUser.id && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                      YOU
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4 align-middle text-right font-mono font-bold">
                {user.score.toLocaleString()}
              </td>
              <td className="p-4 align-middle text-right">
                <RankChangeIndicator value={user.rank_change} />
              </td>
            </>
          )}
        />
      </div>

      {/* Sticky User Card */}
      <div className="absolute bottom-4 left-4 right-4 z-50">
        <div className="rounded-xl bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-cyan-400">#{currentUser.rank}</span>
              <Avatar className="h-10 w-10 ring-2 ring-cyan-500/50">
                <AvatarImage src={currentUser.avatar_url} />
                <AvatarFallback>{currentUser.username[0]}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{currentUser.username}</span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold">
                {currentUser.score.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                Your current score
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RankChangeIndicator({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  const isPositive = value > 0;
  
  return (
    <motion.span
      initial={{ scale: 1.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "flex items-center justify-end gap-1 font-medium",
        isPositive ? "text-green-500" : "text-red-500"
      )}
    >
      {isPositive ? '▲' : '▼'}
      <span>{Math.abs(value)}</span>
    </motion.span>
  );
}
```

---

*Reference document compiled from "Engineering High-Velocity Social Competence: A Comprehensive Treatise on Dynamic Leaderboard Architecture"*
