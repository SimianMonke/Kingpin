# Kingpin Economy Rebalance: Implementation Guide

## Executive Summary

This document provides a step-by-step implementation plan to fix Kingpin's inflationary economy. The changes are organized into four phases, each with concrete before/after values, code locations, and expected outcomes.

**Core Problem:** Daily wealth injection ($2,750-$930,000/player) vastly exceeds removal capacity ($0-$121,000/player).

**Solution Strategy:** Phase 1-2 fixes 80% of the problem with minimal code changes. Phases 3-4 add structural improvements for long-term stability.

---

## Implementation Progress

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| **Phase 1** | ✅ COMPLETE | Dec 19, 2024 | All 4 items implemented |
| **Phase 2** | ✅ COMPLETE | Dec 19, 2024 | All 3 items implemented, DB migrated |
| **Phase 3** | ✅ COMPLETE | Dec 20, 2024 | Token System complete (3.1-3.5), Phase 3A+3B implemented |
| **Phase 4** | ✅ COMPLETE | Dec 20, 2024 | Bond System complete (4.1-4.4), Stripe integrated |

### Session Log

| Date | Action | Details |
|------|--------|---------|
| Dec 19, 2024 | Phase 1 Complete | All 4 items implemented |
| Dec 19, 2024 | Phase 2 Complete | All 3 items implemented (code only) |
| Dec 19, 2024 | DB Migration | Ran `npx prisma db push` to sync `insurance_tier`, `insurance_paid_at` fields to Neon DB |
| Dec 19, 2024 | Prisma Client | Regenerated client (v7.1.0) |
| Dec 20, 2024 | Phase 3 Core | Implemented token schema, constants, service, and daily jobs (3.1-3.4) |
| Dec 20, 2024 | DB Migration | Ran `npx prisma db push` to sync `tokens`, `tokens_earned_today`, `last_token_reset`, `token_transactions` |
| Dec 20, 2024 | Phase 3A/3B | Integrated token system with play command - optional bonus (3A) and required toggle (3B) |
| Dec 20, 2024 | Phase 4 Core | Implemented bond schema, constants (4.1-4.2), service with credit conversion (4.3) |
| Dec 20, 2024 | DB Migration | Ran `npx prisma db push` to sync `bonds`, `last_bond_conversion`, `bond_transactions` |
| Dec 20, 2024 | Phase 4 Stripe | Implemented Stripe Checkout for bond purchases (4.4) - checkout endpoint, webhook handler, grantStripePurchase |

### Phase 1 Completion Summary

**Files Modified:**
- `web/src/lib/game/constants.ts` - Added `PLAY_WEALTH_CAPS`, updated `BUSINESS_REVENUE_CONFIG`, `JAIL_CONFIG`
- `web/src/lib/game/formulas.ts` - Updated `calculatePlayRewards()`, `calculateBailCost()`
- `web/src/lib/services/business.service.ts` - Added daily cap enforcement with `startOfDay()` check
- `web/src/lib/admin/economy-metrics.ts` - **NEW** - Telemetry functions
- `web/src/lib/admin/index.ts` - Added economy-metrics export
- `web/src/app/api/admin/economy/metrics/route.ts` - **NEW** - Admin API endpoint

### Phase 2 Completion Summary

**Files Modified:**
- `web/src/lib/game/constants.ts` - Added `BAIL_TIER_MULTIPLIERS`, `INSURANCE_TIERS`, `INSURANCE_CONFIG`, mission caps
- `web/src/lib/game/formulas.ts` - Updated `calculateBailCost()` to accept tier parameter
- `web/src/lib/services/jail.service.ts` - Updated to use tier-scaled bail formula
- `web/src/lib/services/mission.service.ts` - Added daily/weekly wealth cap enforcement
- `web/prisma/schema.prisma` - Added `insurance_tier`, `insurance_paid_at` to users model
- `web/src/lib/services/insurance.service.ts` - **NEW** - Insurance management service
- `web/src/lib/services/rob.service.ts` - Integrated tier-based insurance with robbery
- `web/src/app/api/cron/daily/route.ts` - Added insurance premium processing job
- `web/src/lib/game/__tests__/formulas.test.ts` - Updated bail tests for tier-scaling

**Key Phase 2 Details:**
- Bail now scales by tier: Rookie pays 7.5% (0.5x), Kingpin pays 30% (2.0x)
- Mission rewards capped at $15k/day (daily) and $50k/week (weekly)
- Insurance tiers: none (0%), basic (25%), standard (50%), premium (75%), platinum (90%)
- Insurance premiums auto-deduct daily; users downgrade to none if they can't afford
- Robbery uses higher of housing insurance or tier-based insurance
- Database: Uses `prisma db push` (not migrations) for Neon DB

**Key Phase 1 Details:**
- Play wealth caps applied *before* Juicernaut buffs (intentional design choice)
- Business daily cap checks `business_revenue_history` for today's collections
- Bail formula now uses `Math.min(MAX, Math.max(MIN, calculated))` pattern
- Economy metrics use native Date helpers (no date-fns dependency)

### Phase 3 Completion Summary

**Files Modified:**
- `web/prisma/schema.prisma` - Added `tokens`, `tokens_earned_today`, `last_token_reset` to users; added `token_transactions` model
- `web/src/lib/game/constants.ts` - Added `TOKEN_CONFIG` with earning rates, caps, decay rates, and Phase 3B toggle
- `web/src/lib/services/token.service.ts` - **NEW** - Token management service
- `web/src/lib/services/play.service.ts` - Integrated token bonus (Phase 3A) and token requirement (Phase 3B)
- `web/src/app/api/play/route.ts` - Added `useToken` parameter to POST endpoint
- `web/src/app/api/cron/daily/route.ts` - Added token decay (job 8) and daily reset (job 9)

**Key Phase 3 Details:**
- Token earning: 100 channel points = 1 token, or credits with scaling cost ($1k base, +15%/purchase)
- Soft cap: 100 tokens (no decay below this), Hard cap: 500 tokens
- Decay: 5% daily on excess above soft cap, 10% if at hard cap
- Daily reset: `tokens_earned_today` counter resets at midnight
- **Phase 3A (COMPLETE):** Optional token bonus on play - 1 token for +25% wealth/XP (`useToken: true`)
- **Phase 3B (COMPLETE):** Token requirement toggle - set `TOKEN_CONFIG.REQUIRE_TOKEN_FOR_PLAY = true` to activate

**How to Enable Phase 3B:**
Change in `web/src/lib/game/constants.ts`:
```typescript
REQUIRE_TOKEN_FOR_PLAY: true,  // Set to true to require tokens for !play
```

**API Endpoints (COMPLETE):**
- `GET /api/tokens` - Get token status (balance, caps, next cost)
- `POST /api/tokens` - Convert credits to tokens ($1,000 base * 1.15^purchases)

**Bot Commands (COMPLETE):**
- `!tokens` (aliases: `!token`, `!mytokens`) - View token balance and status
- `!buytoken` (aliases: `!purchasetoken`, `!gettoken`) - Buy token with credits
- `!tokenboost` (aliases: `!boostinfo`, `!tokeninfo`) - Info about token play bonus

**Recommended Next Steps:**
1. Deploy with Phase 3A active (optional bonus)
2. Monitor adoption for 1-2 weeks
3. If adoption is good, enable Phase 3B (require tokens)

### Phase 4 Completion Summary

**Files Modified:**
- `web/prisma/schema.prisma` - Added `bonds`, `last_bond_conversion` to users; added `bond_transactions` model
- `web/src/lib/game/constants.ts` - Added `BOND_CONFIG` with credit conversion, purchase bundles, achievements, cosmetics
- `web/src/lib/services/bond.service.ts` - **NEW** - Bond management service, includes `grantStripePurchase()`
- `web/src/app/api/bonds/checkout/route.ts` - **NEW** - Stripe Checkout session creation
- `web/src/app/api/webhooks/stripe/route.ts` - Extended to handle bond purchases via metadata

**Key Phase 4 Details:**
- Bond earning: $2,500,000 credits → 100 bonds (weekly cooldown, Captain tier required)
- Achievement rewards: First Kingpin (500), First Million (100), First 10M (250), Season Completion (200)
- Cosmetic spending: Custom title (100), Profile frame (50), Name color (75), Chat badge (150)
- Season pass: 500 bonds for 90-day pass
- **Stripe Integration:** Real money bond bundles purchasable via Stripe Checkout

**Available Bond Functions:**
- `BondService.getBondStatus(user_id)` - Check balance and cooldowns
- `BondService.convertCreditsToBonds(user_id)` - The "Golden Sink" conversion
- `BondService.purchaseCosmetic(user_id, type, name)` - Buy cosmetics
- `BondService.purchaseSeasonPass(user_id)` - Buy season pass
- `BondService.grantAchievementBonds(user_id, achievement_key)` - One-time achievement grants
- `BondService.adminGrantBonds(user_id, amount, admin_id)` - Admin grant function
- `BondService.getBondStatistics()` - Economy-wide bond metrics
- `BondService.grantStripePurchase(user_id, bundle_id, bonds_total, stripe_session_id, amount_usd)` - Grant bonds from Stripe purchase

**API Endpoints (COMPLETE):**
- `GET /api/bonds` - Get bond status (balance, cooldowns, conversion info)
- `POST /api/bonds` - Convert credits to bonds ($2.5M → 100 bonds)
- `GET /api/bonds/purchase` - Get available cosmetics and prices
- `POST /api/bonds/purchase` - Buy cosmetics or season pass with bonds
- `GET /api/bonds/history` - Get bond transaction history
- `GET /api/bonds/checkout` - Get available Stripe bond bundles with prices
- `POST /api/bonds/checkout` - Create Stripe Checkout session for bond purchase

**Stripe Bond Bundles:**
| Bundle | Bonds | Bonus | Total | Price |
|--------|-------|-------|-------|-------|
| starter | 500 | 0 | 500 | $4.99 |
| popular | 1,100 | 100 | 1,200 | $9.99 |
| premium | 2,400 | 400 | 2,800 | $19.99 |
| whale | 6,500 | 1,500 | 8,000 | $49.99 |

**Bot Commands (COMPLETE):**
- `!bonds` (aliases: `!bond`, `!mybonds`) - View bond balance and conversion status
- `!convertbonds` (aliases: `!buybonds`, `!creditstobonds`) - Convert $2.5M → 100 bonds
- `!bondshop` (aliases: `!bondstore`) - View cosmetics purchasable with bonds
- `!buybond <type> [name]` - Purchase cosmetic (title/frame/color/badge) or season pass
- `!bondhistory` (aliases: `!bondhist`) - View recent bond transactions

**Achievement Bond Grants (COMPLETE):**
Bonds are auto-granted when these achievements are completed:
| Achievement Key | Achievement Name | Bond Reward |
|-----------------|------------------|-------------|
| `experience_legend` | Legend (Level 100) | 500 bonds |
| `wealth_six_figures` | Six Figures ($1M) | 100 bonds |
| `wealth_made_it` | Made It ($10M) | 250 bonds |
| `wealth_kingpin_fortune` | Kingpin Fortune ($100M) | 500 bonds |

**Implementation Complete** - All phases (1-4) fully implemented including Stripe integration.

---

## Current Economy Snapshot

### Tier System Reference
| Tier | Levels | Multiplier |
|------|--------|------------|
| Rookie | 1-19 | 1.0x |
| Associate | 20-39 | 1.1x |
| Soldier | 40-59 | 1.2x |
| Captain | 60-79 | 1.3x |
| Underboss | 80-99 | 1.4x |
| Kingpin | 100+ | 1.5x |

### Current Faucet Analysis (Daily Per Player) - POST PHASE 1

| Source | Rookie | Kingpin | Location | Change |
|--------|--------|---------|----------|--------|
| Play (10x) | ~$1,500 | **~$9,000** | `PLAY_WEALTH_CAPS` | -60% (capped) |
| Missions (3x) | ~$2,100 | ~$5,250 | `MISSION_REWARDS` | (Phase 2) |
| Business (3x legendary) | N/A | **~$50,000** | `BUSINESS_REVENUE_CONFIG` | -79% (capped) |
| Check-in | $100-$400 | $100-$400 | `CHECKIN_CONFIG` | No change |
| **Daily Total** | **~$3,700** | **~$64,650** | | **-76%** |

### Current Sink Analysis (Daily Per Player) - POST PHASE 1

| Source | Amount | Trigger | Location | Change |
|--------|--------|---------|----------|--------|
| Bail | **15% wealth, min $500, max $100k** | 5% bust rate | `JAIL_CONFIG` | +50% rate |
| Shop | Voluntary | Player choice | `shop.service.ts` | No change |
| Gambling | House edge ~5-15% | Voluntary | `gambling.service.ts` | No change |
| Housing Upkeep | $100-$2,000/day | Already exists | `HOUSING_UPKEEP_CONFIG` | No change |

---

## Phase 1: Emergency Stabilization ✅ COMPLETE

**Status:** Implemented Dec 19, 2024
**Impact:** Reduced daily Kingpin injection from ~$268k to ~$65k (-76%)
**Risk:** Low (number tweaks only)

### 1.1 Flatten Play Wealth Curve

**File:** `web/src/lib/game/constants.ts`

The play command rewards are defined per-tier in `TIER_PLAY_EVENTS`. Each tier has ~40-50 events with wealth ranges.

#### Current Values (Examples)
```typescript
// Rookie events (lines 248-257)
{ name: 'Petty Theft', wealth: { min: 50, max: 150 }, xp: { min: 10, max: 20 } }
{ name: 'Bike Theft', wealth: { min: 100, max: 250 }, xp: { min: 15, max: 30 } }

// Kingpin events (lines 470+)
{ name: 'Corporate Takeover', wealth: { min: 8000, max: 15000 }, xp: { min: 500, max: 800 } }
{ name: 'Syndicate Deal', wealth: { min: 10000, max: 18000 }, xp: { min: 600, max: 900 } }
```

#### Proposed Values
```typescript
// Rookie: Keep similar (floor for new players)
{ name: 'Petty Theft', wealth: { min: 50, max: 150 }, xp: { min: 10, max: 20 } }

// Kingpin: Reduce by ~60%
{ name: 'Corporate Takeover', wealth: { min: 3000, max: 6000 }, xp: { min: 500, max: 800 } }
{ name: 'Syndicate Deal', wealth: { min: 4000, max: 7000 }, xp: { min: 600, max: 900 } }
```

#### Scaling Formula Change
Instead of editing every event, apply a **wealth cap by tier**:

**File:** `web/src/lib/game/formulas.ts` (line 204)

```typescript
// BEFORE
export function calculatePlayRewards(
  event_type: PlayEventType,
  tier: Tier,
  isJuicernaut: boolean = false
): { wealth: number; xp: number } {
  const event = PLAY_EVENTS[event_type]
  const tier_multiplier = getTierMultiplier(tier)

  let wealth = Math.floor(
    (event.wealth.min + Math.random() * (event.wealth.max - event.wealth.min)) * tier_multiplier
  )
  // ...
}

// AFTER
const PLAY_WEALTH_CAPS: Record<Tier, number> = {
  rookie: 500,
  associate: 1500,
  soldier: 3500,
  captain: 7500,
  underboss: 15000,
  kingpin: 30000,  // Was effectively ~$27,000 max from events
}

export function calculatePlayRewards(
  event_type: PlayEventType,
  tier: Tier,
  isJuicernaut: boolean = false
): { wealth: number; xp: number } {
  const event = PLAY_EVENTS[event_type]
  const tier_multiplier = getTierMultiplier(tier)

  let wealth = Math.floor(
    (event.wealth.min + Math.random() * (event.wealth.max - event.wealth.min)) * tier_multiplier
  )

  // NEW: Apply tier-based wealth cap
  const cap = PLAY_WEALTH_CAPS[tier]
  wealth = Math.min(wealth, cap)

  // ...
}
```

#### Expected Outcome
| Tier | Before (avg/play) | After (avg/play) | Change |
|------|-------------------|------------------|--------|
| Rookie | ~$150 | ~$150 | 0% |
| Kingpin | ~$1,500 | ~$600 | -60% |

---

### 1.2 Cap Business Revenue

**File:** `web/src/lib/game/constants.ts` (lines 75-91)

#### Current Values
```typescript
export const BUSINESS_REVENUE_CONFIG = {
  INTERVAL_HOURS: 3,
  CALCULATIONS_PER_DAY: 8,
  VARIANCE_PERCENT: 20,
  DAILY_REVENUE_BY_TIER: {
    common: { min: 2000, max: 5000 },       // $2k-$5k/day
    uncommon: { min: 6000, max: 15000 },    // $6k-$15k/day
    rare: { min: 18000, max: 35000 },       // $18k-$35k/day
    legendary: { min: 40000, max: 80000 },  // $40k-$80k/day ← PROBLEM
  },
  OPERATING_COST_BY_TIER: {
    common: { min: 200, max: 500 },
    uncommon: { min: 600, max: 1500 },
    rare: { min: 1800, max: 3500 },
    legendary: { min: 4000, max: 8000 },
  },
}
```

**Current Max:** 3 legendary businesses × $80,000 = **$240,000/day**

#### Proposed Values
```typescript
export const BUSINESS_REVENUE_CONFIG = {
  INTERVAL_HOURS: 3,
  CALCULATIONS_PER_DAY: 8,
  VARIANCE_PERCENT: 20,
  DAILY_REVENUE_BY_TIER: {
    common: { min: 1000, max: 2500 },       // $1k-$2.5k/day (-50%)
    uncommon: { min: 3000, max: 7500 },     // $3k-$7.5k/day (-50%)
    rare: { min: 8000, max: 15000 },        // $8k-$15k/day (-55%)
    legendary: { min: 15000, max: 30000 },  // $15k-$30k/day (-62%)
  },
  OPERATING_COST_BY_TIER: {
    common: { min: 500, max: 1000 },        // Increased 2.5x
    uncommon: { min: 1500, max: 3000 },     // Increased 2x
    rare: { min: 4000, max: 7500 },         // Increased 2x
    legendary: { min: 8000, max: 15000 },   // Increased 2x
  },
  // NEW: Daily cap across all businesses
  DAILY_TOTAL_CAP: 50000,  // Max $50k/day from all businesses combined
}
```

**New Max:** $50,000/day (capped) = **79% reduction**

#### Implementation
**File:** `web/src/services/business.service.ts`

```typescript
// Add to collectBusinessRevenue function
async function collectBusinessRevenue(userId: string, businessId: string) {
  // ... existing logic ...

  // NEW: Check daily cap
  const todayStart = startOfDay(new Date())
  const todaysCollections = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'BUSINESS_REVENUE',
      createdAt: { gte: todayStart },
    },
    _sum: { amount: true },
  })

  const todayTotal = todaysCollections._sum.amount || 0
  const remainingCap = BUSINESS_REVENUE_CONFIG.DAILY_TOTAL_CAP - todayTotal

  if (remainingCap <= 0) {
    throw new Error('Daily business revenue cap reached')
  }

  // Cap this collection to remaining allowance
  const cappedRevenue = Math.min(netRevenue, remainingCap)

  // ... continue with cappedRevenue ...
}
```

#### Expected Outcome
| Scenario | Before | After | Change |
|----------|--------|-------|--------|
| 3 legendary | $240k/day | $50k/day | -79% |
| 1 legendary | $80k/day | $30k/day | -62% |

---

### 1.3 Increase Bail Percentage

**File:** `web/src/lib/game/constants.ts` (lines 659-663)

#### Current Values
```typescript
export const JAIL_CONFIG = {
  DURATION_MINUTES: 60,
  BAIL_COST_PERCENT: 0.10,  // 10% of wealth
  MIN_BAIL: 100,
}
```

#### Proposed Values
```typescript
export const JAIL_CONFIG = {
  DURATION_MINUTES: 60,
  BAIL_COST_PERCENT: 0.15,  // 15% of wealth (was 10%)
  MIN_BAIL: 500,            // $500 minimum (was $100)
  MAX_BAIL: 100000,         // NEW: $100k cap to prevent catastrophic loss
}
```

#### Update Formula
**File:** `web/src/lib/game/formulas.ts` (line 299)

```typescript
// BEFORE
export function calculateBailCost(wealth: number): number {
  return Math.max(JAIL_CONFIG.MIN_BAIL, Math.floor(wealth * JAIL_CONFIG.BAIL_COST_PERCENT))
}

// AFTER
export function calculateBailCost(wealth: number): number {
  const bail = Math.floor(wealth * JAIL_CONFIG.BAIL_COST_PERCENT)
  return Math.min(
    JAIL_CONFIG.MAX_BAIL,
    Math.max(JAIL_CONFIG.MIN_BAIL, bail)
  )
}
```

#### Expected Outcome
| Wealth | Before | After |
|--------|--------|-------|
| $10,000 | $1,000 | $1,500 |
| $100,000 | $10,000 | $15,000 |
| $1,000,000 | $100,000 | $100,000 (capped) |

---

### 1.4 Add Economy Telemetry

**File:** `web/src/lib/admin/economy-metrics.ts` (NEW)

```typescript
export interface DailyEconomySnapshot {
  date: Date
  totalWealth: bigint
  totalPlayers: number
  wealthInjected: bigint
  wealthRemoved: bigint
  netFlow: bigint
  topPlayerWealth: bigint
  medianWealth: bigint
  giniCoefficient: number
}

export async function captureEconomySnapshot(): Promise<DailyEconomySnapshot> {
  const [
    totalWealth,
    playerCount,
    injections,
    removals,
    topPlayer,
    wealthDistribution,
  ] = await Promise.all([
    prisma.user.aggregate({ _sum: { wealth: true } }),
    prisma.user.count(),
    prisma.transaction.aggregate({
      where: {
        type: { in: ['PLAY_REWARD', 'BUSINESS_REVENUE', 'MISSION_REWARD', 'CHECKIN'] },
        createdAt: { gte: startOfDay(new Date()) },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        type: { in: ['BAIL', 'PURCHASE', 'GAMBLING_LOSS'] },
        createdAt: { gte: startOfDay(new Date()) },
      },
      _sum: { amount: true },
    }),
    prisma.user.findFirst({ orderBy: { wealth: 'desc' } }),
    prisma.user.findMany({ select: { wealth: true }, orderBy: { wealth: 'asc' } }),
  ])

  return {
    date: new Date(),
    totalWealth: totalWealth._sum.wealth || BigInt(0),
    totalPlayers: playerCount,
    wealthInjected: injections._sum.amount || BigInt(0),
    wealthRemoved: Math.abs(removals._sum.amount || 0),
    netFlow: (injections._sum.amount || 0) - Math.abs(removals._sum.amount || 0),
    topPlayerWealth: topPlayer?.wealth || BigInt(0),
    medianWealth: wealthDistribution[Math.floor(wealthDistribution.length / 2)]?.wealth || BigInt(0),
    giniCoefficient: calculateGini(wealthDistribution.map(u => Number(u.wealth))),
  }
}

function calculateGini(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  if (mean === 0) return 0

  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i]
  }
  return sum / (n * n * mean)
}
```

#### Admin Dashboard Integration
Add endpoint: `web/src/app/api/admin/economy/metrics/route.ts`

---

## Phase 2: Structural Sinks ✅ COMPLETE

**Status:** Implemented Dec 19, 2024
**Impact:** Introduces mandatory recurring costs
**Risk:** Medium (behavioral change)

---

### 2.1 Tier-Scaled Bail

**File:** `web/src/lib/game/constants.ts`

```typescript
// NEW: Add after JAIL_CONFIG
export const BAIL_TIER_MULTIPLIERS: Record<Tier, number> = {
  rookie: 0.5,      // 7.5% effective (helps new players)
  associate: 0.75,  // 11.25%
  soldier: 1.0,     // 15% (base)
  captain: 1.25,    // 18.75%
  underboss: 1.5,   // 22.5%
  kingpin: 2.0,     // 30% (aggressive sink for wealthy)
}
```

**File:** `web/src/lib/game/formulas.ts`

```typescript
import { BAIL_TIER_MULTIPLIERS } from './constants'

export function calculateBailCost(wealth: number, tier: Tier): number {
  const tierMultiplier = BAIL_TIER_MULTIPLIERS[tier]
  const effectivePercent = JAIL_CONFIG.BAIL_COST_PERCENT * tierMultiplier
  const bail = Math.floor(wealth * effectivePercent)

  return Math.min(
    JAIL_CONFIG.MAX_BAIL,
    Math.max(JAIL_CONFIG.MIN_BAIL, bail)
  )
}
```

#### Expected Outcome
| Tier | Wealth | Before (10%) | After |
|------|--------|--------------|-------|
| Rookie | $10,000 | $1,000 | $750 (7.5%) |
| Kingpin | $1,000,000 | $100,000 | $100,000 (capped) |
| Kingpin | $100,000 | $10,000 | $30,000 (30%) |

---

### 2.2 Mission Reward Cap

**File:** `web/src/lib/game/constants.ts` (add to MISSION_CONFIG)

```typescript
export const MISSION_CONFIG = {
  DAILY_COUNT: 3,
  WEEKLY_COUNT: 2,
  DAILY_BONUS_MULTIPLIER: 1.5,
  WEEKLY_BONUS_MULTIPLIER: 2.0,
  DAILY_CRATE_REWARD: CRATE_TIERS.UNCOMMON,
  WEEKLY_CRATE_REWARD: CRATE_TIERS.RARE,
  // NEW
  DAILY_WEALTH_CAP: 15000,   // Max $15k/day from daily missions
  WEEKLY_WEALTH_CAP: 50000,  // Max $50k/week from weekly missions
}
```

**File:** `web/src/services/mission.service.ts`

```typescript
async function completeMission(userId: string, missionId: string) {
  // ... existing validation ...

  // NEW: Check daily cap
  const todaysMissionRewards = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'MISSION_REWARD',
      createdAt: { gte: startOfDay(new Date()) },
    },
    _sum: { amount: true },
  })

  const todayTotal = todaysMissionRewards._sum.amount || 0
  const remainingCap = MISSION_CONFIG.DAILY_WEALTH_CAP - todayTotal

  const cappedReward = Math.min(calculatedReward, remainingCap)

  // ... grant cappedReward ...
}
```

---

### 2.3 Insurance System (Robbery Protection)

**File:** `web/src/lib/game/constants.ts`

```typescript
// NEW: Insurance tiers (replaces/enhances housing insurance)
export const INSURANCE_CONFIG = {
  TIERS: {
    none: {
      protection: 0,
      dailyCost: 0,
    },
    basic: {
      protection: 0.25,    // 25% of stolen wealth returned
      dailyCost: 1000,
    },
    standard: {
      protection: 0.50,    // 50%
      dailyCost: 5000,
    },
    premium: {
      protection: 0.75,    // 75%
      dailyCost: 15000,
    },
    platinum: {
      protection: 0.90,    // 90%
      dailyCost: 50000,
    },
  },
  AUTO_RENEW: true,
  GRACE_PERIOD_HOURS: 24,
}
```

**Database Schema Addition:**
```prisma
model User {
  // ... existing fields ...
  insuranceTier    String    @default("none")
  insurancePaidAt  DateTime?
}
```

**Daily Deduction Job:**
```typescript
// web/src/jobs/insurance-deduction.ts
export async function processInsurancePremiums() {
  const users = await prisma.user.findMany({
    where: {
      insuranceTier: { not: 'none' },
    },
  })

  for (const user of users) {
    const tier = INSURANCE_CONFIG.TIERS[user.insuranceTier]

    if (user.wealth >= tier.dailyCost) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            wealth: { decrement: tier.dailyCost },
            insurancePaidAt: new Date(),
          },
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'INSURANCE_PREMIUM',
            amount: -tier.dailyCost,
            description: `${user.insuranceTier} insurance premium`,
          },
        }),
      ])
    } else {
      // Downgrade to none if can't afford
      await prisma.user.update({
        where: { id: user.id },
        data: { insuranceTier: 'none' },
      })
    }
  }
}
```

#### Expected Sink Impact
| Insurance Tier | Daily Cost | Monthly Cost | Active Users (est.) | Monthly Sink |
|----------------|------------|--------------|---------------------|--------------|
| Basic | $1,000 | $30,000 | 500 | $15M |
| Standard | $5,000 | $150,000 | 200 | $30M |
| Premium | $15,000 | $450,000 | 50 | $22.5M |
| Platinum | $50,000 | $1,500,000 | 10 | $15M |
| **Total** | | | | **$82.5M/month** |

---

## Phase 3: Token System (Optional Accelerator) ✅ COMPLETE

**Status:** Fully implemented (3.1-3.5 including Phase 3A and 3B)
**Impact:** Gates wealth generation frequency
**Risk:** High (major gameplay change)

### Phase 3 Starting Point

Begin implementation in this order:

1. **3.1 Database Schema** - Add token fields to users and create transaction table
   - Add `tokens`, `tokens_earned_today`, `last_token_reset` to `users` model in `schema.prisma`
   - Create `token_transactions` table for audit trail
   - Run `npx prisma db push` to sync

2. **3.2 Token Constants** - Define configuration in `constants.ts`
   - Add `TOKEN_CONFIG` with earning rates, caps, decay rates
   - Keep values conservative initially (can tune later)

3. **3.3 Token Service** - Create `web/src/lib/services/token.service.ts`
   - `convertChannelPointsToTokens()` - Primary earning method
   - `convertCreditsToTokens()` - Wealth sink with scaling cost
   - `processTokenDecay()` - Daily job for hoarding penalty

4. **3.4 Daily Job Integration** - Add to `cron/daily/route.ts`
   - Process token decay for users above soft cap
   - Reset `tokens_earned_today` counter

5. **3.5 Play Integration (Phase 3A)** - Optional bonus first
   - Add `useToken` parameter to play command
   - Tokens provide 25% bonus, not required
   - Test adoption before making tokens required (Phase 3B)

**Recommended Approach:** Implement 3.1-3.4 first, deploy, monitor for a week, then add 3.5.

---

### 3.1 Database Schema

```prisma
model User {
  // ... existing fields ...
  tokens           Int       @default(0)
  tokensEarnedToday Int      @default(0)
  lastTokenReset   DateTime?
}

model TokenTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int
  type        String   // 'CHANNEL_POINTS', 'CREDIT_CONVERSION', 'PLAY_COST', 'DECAY'
  description String?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
}
```

### 3.2 Token Constants

**File:** `web/src/lib/game/constants.ts`

```typescript
export const TOKEN_CONFIG = {
  // Earning
  CHANNEL_POINT_RATE: 100,         // 100 channel points = 1 token
  CREDIT_CONVERSION_BASE: 1000,    // $1,000 = 1 token (base rate)
  CREDIT_CONVERSION_SCALING: 1.15, // 15% more expensive each purchase/day
  MAX_CREDIT_CONVERSIONS_PER_DAY: 50,

  // Caps
  SOFT_CAP: 100,           // Comfortable holding amount
  HARD_CAP: 500,           // Absolute maximum

  // Decay (above soft cap)
  DECAY_RATE_ABOVE_SOFT: 0.05,  // 5% daily decay on excess
  DECAY_RATE_AT_HARD: 0.10,     // 10% total decay at hard cap

  // Spending (PHASE 3B - start as optional bonus, not requirement)
  PLAY_BONUS_COST: 1,      // 1 token for 25% bonus rewards
  BUSINESS_BOOST_COST: 2,  // 2 tokens for 50% bonus collection
}
```

### 3.3 Token Service

**File:** `web/src/services/token.service.ts`

```typescript
import { TOKEN_CONFIG } from '@/lib/game/constants'

export async function convertChannelPointsToTokens(
  userId: string,
  channelPoints: number
): Promise<{ tokens: number }> {
  const tokensEarned = Math.floor(channelPoints / TOKEN_CONFIG.CHANNEL_POINT_RATE)

  if (tokensEarned <= 0) {
    throw new Error('Not enough channel points')
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const newTotal = Math.min(user.tokens + tokensEarned, TOKEN_CONFIG.HARD_CAP)
  const actualGain = newTotal - user.tokens

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokens: newTotal },
    }),
    prisma.tokenTransaction.create({
      data: {
        userId,
        amount: actualGain,
        type: 'CHANNEL_POINTS',
        description: `Converted ${channelPoints} channel points`,
      },
    }),
  ])

  return { tokens: actualGain }
}

export async function convertCreditsToTokens(userId: string): Promise<{ tokens: number; cost: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })

  // Calculate dynamic cost based on daily purchases
  const cost = Math.floor(
    TOKEN_CONFIG.CREDIT_CONVERSION_BASE *
    Math.pow(TOKEN_CONFIG.CREDIT_CONVERSION_SCALING, user.tokensEarnedToday)
  )

  if (user.wealth < cost) {
    throw new Error(`Need $${cost.toLocaleString()} credits`)
  }

  if (user.tokens >= TOKEN_CONFIG.HARD_CAP) {
    throw new Error('At token cap')
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        wealth: { decrement: cost },
        tokens: { increment: 1 },
        tokensEarnedToday: { increment: 1 },
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        userId,
        amount: 1,
        type: 'CREDIT_CONVERSION',
        description: `Converted $${cost.toLocaleString()} credits`,
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'TOKEN_PURCHASE',
        amount: -cost,
        description: 'Credit to token conversion',
      },
    }),
  ])

  return { tokens: 1, cost }
}

export async function processTokenDecay(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { tokens: { gt: TOKEN_CONFIG.SOFT_CAP } },
  })

  for (const user of users) {
    let decayAmount: number

    if (user.tokens >= TOKEN_CONFIG.HARD_CAP) {
      decayAmount = Math.floor(user.tokens * TOKEN_CONFIG.DECAY_RATE_AT_HARD)
    } else {
      const excess = user.tokens - TOKEN_CONFIG.SOFT_CAP
      decayAmount = Math.floor(excess * TOKEN_CONFIG.DECAY_RATE_ABOVE_SOFT)
    }

    if (decayAmount > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { tokens: { decrement: decayAmount } },
        }),
        prisma.tokenTransaction.create({
          data: {
            userId: user.id,
            amount: -decayAmount,
            type: 'DECAY',
            description: `Daily decay (${user.tokens} > ${TOKEN_CONFIG.SOFT_CAP} cap)`,
          },
        }),
      ])
    }
  }
}
```

### 3.4 Play Command Integration (Optional Bonus First)

**Phase 3A:** Tokens as optional bonus (not required)

```typescript
// web/src/services/play.service.ts
export async function executePlay(
  userId: string,
  useToken: boolean = false  // Player choice
): Promise<PlayResult> {
  const user = await getUser(userId)

  let bonusMultiplier = 1.0

  // Optional: Spend token for bonus
  if (useToken) {
    if (user.tokens >= TOKEN_CONFIG.PLAY_BONUS_COST) {
      await deductTokens(userId, TOKEN_CONFIG.PLAY_BONUS_COST)
      bonusMultiplier = 1.25  // 25% bonus for using token
    }
  }

  const baseRewards = calculatePlayRewards(event, tier, isJuicernaut)
  const finalRewards = {
    wealth: Math.floor(baseRewards.wealth * bonusMultiplier),
    xp: Math.floor(baseRewards.xp * bonusMultiplier),
  }

  // ... continue as normal ...
}
```

**Phase 3B (Future):** Tokens required for play
```typescript
// Only implement after Phase 3A proves successful
if (user.tokens < TOKEN_CONFIG.PLAY_COST) {
  throw new InsufficientTokensError('Need 1 token to play')
}
await deductTokens(userId, TOKEN_CONFIG.PLAY_COST)
```

---

## Phase 4: Premium Economy (Bonds) 🔜 NEXT

**Status:** Ready to implement
**Impact:** End-game wealth sink + monetization
**Risk:** Medium (payment integration required)

### Phase 4 Starting Point

Begin implementation in this order:

1. **4.1 Database Schema** - Add bond fields to users and create transaction table
   - Add `bonds`, `last_bond_conversion` to `users` model in `schema.prisma`
   - Create `bond_transactions` table for audit trail
   - Run `npx prisma db push` to sync

2. **4.2 Bond Constants** - Define configuration in `constants.ts`
   - Add `BOND_CONFIG` with conversion rates, bundles, achievement rewards
   - Keep credit conversion expensive ($2.5M) to be a true end-game sink

3. **4.3 Bond Service** - Create `web/src/lib/services/bond.service.ts`
   - `convertCreditsToBonds()` - Primary wealth sink for wealthy players
   - `getBondStatus()` - Check balance and cooldowns
   - `grantAchievementBonds()` - One-time achievement rewards

4. **4.4 Stripe Integration** (Optional - can defer)
   - Set up Stripe webhook handler for bond purchases
   - Create `/api/bonds/purchase` endpoint
   - Add bundle selection UI

5. **4.5 Bond Spending** - What bonds can buy
   - Cosmetics (titles, profile customization)
   - Season pass unlock
   - Exclusive items in shop

**Recommended Approach:** Implement 4.1-4.3 first (credit conversion only), deploy, then add Stripe integration later.

---

### 4.1 Database Schema

```prisma
model User {
  // ... existing fields ...
  bonds             Int       @default(0)
  lastBondConversion DateTime?
}

model BondTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int
  type        String   // 'PURCHASE', 'CREDIT_CONVERSION', 'SEASON_PASS', 'ACHIEVEMENT'
  description String?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
}
```

### 4.2 Bond Constants

```typescript
export const BOND_CONFIG = {
  // Credit conversion (the "Golden Sink")
  CREDIT_CONVERSION: {
    COST: 2_500_000,        // $2.5M credits
    BONDS_RECEIVED: 100,
    COOLDOWN_DAYS: 7,
    MIN_LEVEL: 60,          // Captain tier required
  },

  // Real money bundles
  PURCHASE_BUNDLES: [
    { bonds: 500, usd: 4.99, bonus: 0 },
    { bonds: 1100, usd: 9.99, bonus: 100 },
    { bonds: 2400, usd: 19.99, bonus: 400 },
    { bonds: 6500, usd: 49.99, bonus: 1500 },
  ],

  // Achievement rewards (one-time)
  ACHIEVEMENTS: {
    FIRST_KINGPIN: 500,
    FIRST_MILLION: 100,
    SEASON_COMPLETION: 200,
  },
}
```

### 4.3 Credit-to-Bonds Conversion

```typescript
export async function convertCreditsToBonds(userId: string): Promise<{ bonds: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const config = BOND_CONFIG.CREDIT_CONVERSION

  // Check cooldown
  if (user.lastBondConversion) {
    const daysSince = differenceInDays(new Date(), user.lastBondConversion)
    if (daysSince < config.COOLDOWN_DAYS) {
      throw new Error(`Can convert again in ${config.COOLDOWN_DAYS - daysSince} days`)
    }
  }

  // Check level
  const tier = getTierFromLevel(user.level)
  if (user.level < config.MIN_LEVEL) {
    throw new Error('Must be Captain tier or above')
  }

  // Check credits
  if (user.wealth < config.COST) {
    throw new Error(`Need $${config.COST.toLocaleString()} credits`)
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        wealth: { decrement: config.COST },
        bonds: { increment: config.BONDS_RECEIVED },
        lastBondConversion: new Date(),
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'BOND_CONVERSION',
        amount: -config.COST,
        description: `Converted to ${config.BONDS_RECEIVED} bonds`,
      },
    }),
    prisma.bondTransaction.create({
      data: {
        userId,
        amount: config.BONDS_RECEIVED,
        type: 'CREDIT_CONVERSION',
      },
    }),
  ])

  return { bonds: config.BONDS_RECEIVED }
}
```

---

## Success Metrics & Monitoring

### Key Performance Indicators

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Daily Net Flow | -5% to +5% | >10% | >25% |
| Gini Coefficient | 0.4-0.6 | >0.7 | >0.8 |
| Top 10 Wealth Share | <30% | >40% | >50% |
| Business Revenue % of Total | <20% | >30% | >40% |
| Active Sink Rate | >30% of players | <20% | <10% |

### Alert Thresholds

```typescript
// web/src/jobs/economy-alerts.ts
const ALERT_CONFIG = {
  DAILY_INJECTION_THRESHOLD: 2.0,  // Alert if > 2x removal
  PLAYER_WEEKLY_GAIN: 10_000_000,  // Alert if any player gains $10M/week
  GINI_THRESHOLD: 0.75,            // Alert if wealth inequality too high
}

export async function checkEconomyHealth() {
  const snapshot = await captureEconomySnapshot()

  if (snapshot.wealthInjected > snapshot.wealthRemoved * ALERT_CONFIG.DAILY_INJECTION_THRESHOLD) {
    await sendAlert('INFLATION_WARNING', {
      injected: snapshot.wealthInjected,
      removed: snapshot.wealthRemoved,
      ratio: snapshot.wealthInjected / snapshot.wealthRemoved,
    })
  }

  if (snapshot.giniCoefficient > ALERT_CONFIG.GINI_THRESHOLD) {
    await sendAlert('INEQUALITY_WARNING', {
      gini: snapshot.giniCoefficient,
      topPlayer: snapshot.topPlayerWealth,
      median: snapshot.medianWealth,
    })
  }
}
```

---

## Rollback Plan

Each phase can be reverted independently:

### Phase 1 Rollback
- Revert constant changes in `constants.ts`
- Remove wealth caps from `formulas.ts`
- Deploy immediately

### Phase 2 Rollback
- Disable insurance deduction job
- Revert bail formula
- Set all users' insuranceTier to 'none'

### Phase 3 Rollback
- Set `TOKEN_CONFIG.REQUIRE_TOKEN_FOR_PLAY = false` (disables Phase 3B)
- Set `TOKEN_CONFIG.PLAY_BONUS_COST = 0` (disables Phase 3A bonus)
- Comment out token decay/reset jobs in `cron/daily/route.ts`
- Players keep existing tokens (no harm, they just become cosmetic)

### Phase 4 Rollback
- Disable bond conversion
- Players keep existing bonds
- Pause Stripe integration

---

## Communication Template

### Player Announcement (Phase 1)

```
# Season 2 Economy Update

We're implementing balance changes to create a healthier long-term economy:

**What's Changing:**
- Play rewards now have tier-based caps (Kingpin max: $30k)
- Business revenue reduced and daily cap of $50k
- Bail increased to 15% (min $500, max $100k)

**Why:**
- Prevents runaway inflation that devalues everyone's progress
- Makes wealth more meaningful and competitive
- Ensures new players can catch up

**What's NOT Changing:**
- XP rates remain the same
- Item drops unchanged
- Robbery mechanics unchanged

These changes take effect [DATE]. Thanks for helping us build a fair game!
```

---

## File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `constants.ts` | 1,2,3,4 | Wealth caps, business revenue, bail config, TOKEN_CONFIG, BOND_CONFIG |
| `formulas.ts` | 1,2 | `calculatePlayRewards`, `calculateBailCost` |
| `business.service.ts` | 1 | Daily revenue cap |
| `jail.service.ts` | 2 | Tier-scaled bail |
| `mission.service.ts` | 2 | Mission reward cap |
| `schema.prisma` | 2,3,4 | Insurance, tokens, bonds fields |
| `token.service.ts` | 3 | NEW - Token management |
| `play.service.ts` | 3 | Token bonus (3A) and requirement (3B) integration |
| `play/route.ts` | 3 | `useToken` parameter support |
| `api/tokens/route.ts` | 3 | NEW - Token status (GET) and convert (POST) |
| `bot/commands/tokens.ts` | 3 | NEW - Bot commands (!tokens, !buytoken, !tokenboost) |
| `cron/daily/route.ts` | 2,3 | Insurance premiums, token decay, daily reset |
| `bond.service.ts` | 4 | NEW - Bond conversion, cosmetics, season pass, Stripe purchase |
| `api/bonds/route.ts` | 4 | NEW - Bond status (GET) and convert (POST) |
| `api/bonds/purchase/route.ts` | 4 | NEW - Cosmetic and season pass purchases |
| `api/bonds/history/route.ts` | 4 | NEW - Transaction history |
| `api/bonds/checkout/route.ts` | 4 | NEW - Stripe Checkout session creation |
| `api/webhooks/stripe/route.ts` | 4 | Extended - Bond purchase webhook handling |
| `bot/commands/bonds.ts` | 4 | NEW - Bot commands (!bonds, !convertbonds, etc.) |
| `bot/api-client.ts` | 3,4 | Added token and bond API methods |
| `bot/commands/index.ts` | 3,4 | Registered token and bond commands |
| `achievement.service.ts` | 4 | Auto-grant bonds on achievement completion |
| `constants.ts` | 4 | Added ACHIEVEMENT_BOND_MAP |
| `economy-metrics.ts` | 1 | NEW - Telemetry |
| `insurance.service.ts` | 2 | NEW - Insurance management |

---

*Document Version: 1.5*
*Last Updated: December 20, 2024*
*Phases 1-4 fully implemented by Claude Code*
*Phase 4 complete: Bond system with credit conversion (4.1-4.3) and Stripe integration (4.4)*
*Based on consensus analysis with gemini-2.5-flash (9/10 confidence)*
