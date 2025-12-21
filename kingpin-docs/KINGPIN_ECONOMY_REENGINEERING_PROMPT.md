# Kingpin Economy Reengineering: Claude Code Reference Guide

## Mission Statement

You are tasked with reviewing the Kingpin codebase to analyze and reengineer its virtual economy. The goal is to transform the current **net inflationary single-currency model** into a **balanced Tri-Currency ecosystem** inspired by industry-proven behavioral economics from games like Fortnite, Apex Legends, Call of Duty, Overwatch 2, and Warframe.

The objective is NOT to maximize extraction from players, but to create **sustainable engagement loops** that respect player time while maintaining economic stability for long-term game health.

---

## Part 1: Codebase Discovery Phase

### 1.1 Initial Architecture Scan

Begin by exploring the project structure to understand the current implementation:

```bash
# Locate and catalog all economy-related services
find . -type f -name "*.ts" | xargs grep -l "wealth\|currency\|credits\|tokens\|bonds" | head -50

# Identify the constants and configuration files
find . -type f -name "constants.ts" -o -name "config.ts" -o -name "formulas.ts"

# Map the service layer
ls -la src/services/
```

### 1.2 Key Files to Analyze

Based on the economy analysis, prioritize reviewing these service files:

| Priority | Service File | Economic Role |
|----------|-------------|---------------|
| CRITICAL | `play.service.ts` | Primary wealth faucet |
| CRITICAL | `user.service.ts` | Check-in faucet, XP/wealth management |
| CRITICAL | `gambling.service.ts` | Primary wealth sink |
| HIGH | `mission.service.ts` | Secondary faucet (daily missions) |
| HIGH | `business.service.ts` | Passive income faucet (HIGH RISK) |
| HIGH | `shop.service.ts` | Primary deliberate sink |
| HIGH | `jail.service.ts` | Bail sink mechanism |
| MEDIUM | `faction.service.ts` | Weekly reward distribution |
| MEDIUM | `monetization.service.ts` | Real-money integration |
| MEDIUM | `juicernaut.service.ts` | Streamer event economy |
| MEDIUM | `crate.service.ts` | Loot box wealth injection |
| LOW | `rob.service.ts` | Wealth transfer (neutral) |
| LOW | `inventory.service.ts` | Item durability sink |

### 1.3 Database Schema Review

Examine the database schema to understand current data structures:

```bash
# Find migration files
find . -path "*/migrations/*" -name "*.ts" | head -20

# Find entity/model definitions
find . -type f -name "*.entity.ts" -o -name "*.model.ts"
```

Document the current structure for:
- Player wealth storage
- Transaction history
- Currency type definitions (if any)
- Business ownership tables
- Item/inventory tables

---

## Part 2: Current Economy Assessment

### 2.1 Faucet Analysis (Wealth Generation)

For each faucet, extract and document:

```typescript
// Template for analysis
interface FaucetAnalysis {
  name: string;
  sourceFile: string;
  wealthGenerated: {
    min: number;
    max: number;
    average: number;
    perUnit: 'play' | 'day' | 'hour' | 'week' | 'event';
  };
  tierScaling: boolean;  // Does it scale with player tier?
  gatingMechanism: 'channel_points' | 'time' | 'none' | 'real_money';
  inflationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  currentFormula: string;  // Extract actual calculation
}
```

**Known Critical Faucets to Review:**

1. **Play Command** (`play.service.ts`)
   - Current: $50-$100,000 per play depending on tier
   - Risk: CRITICAL - Unlimited generation gated only by channel points
   - Find: `PLAY_WEALTH_RANGES` or equivalent constant

2. **Business Revenue** (`business.service.ts`)
   - Current: Up to $720,000/day passive income
   - Risk: CRITICAL - No maintenance costs, pure injection
   - Find: Revenue calculation, collection mechanism

3. **Mission Rewards** (`mission.service.ts`)
   - Current: Up to $180,000/day for Kingpin tier
   - Risk: HIGH - Scales exponentially with tier
   - Find: `MISSION_REWARD_RANGES` or reward calculation

4. **Monetization Rewards** (`monetization.service.ts`)
   - Current: $2,500-$25,000 per real-money event
   - Risk: VARIABLE - Spikes during streams
   - Find: Conversion rates for subs/bits/donations

### 2.2 Sink Analysis (Wealth Removal)

For each sink, extract and document:

```typescript
interface SinkAnalysis {
  name: string;
  sourceFile: string;
  wealthRemoved: {
    min: number;
    max: number;
    average: number;
    mandatory: boolean;  // Is spending required?
  };
  triggerRate: number;  // % chance or frequency
  houseEdge?: number;   // For gambling
  currentFormula: string;
}
```

**Known Sinks to Review:**

1. **Gambling House Edge** (`gambling.service.ts`)
   - Slots: 5% jackpot contribution + negative EV
   - Lottery: 10% house cut
   - Find: `HOUSE_CUT`, `JACKPOT_CONTRIBUTION_RATE`

2. **Bail Payments** (`jail.service.ts`)
   - Current: 10% of wealth (min $100)
   - Trigger: 5% bust chance per play
   - Find: `BAIL_PERCENTAGE`, `BUST_CHANCE`

3. **Shop Purchases** (`shop.service.ts`)
   - Problem: Optional, limited inventory
   - Find: Item pricing, availability logic

4. **Item Durability** (`inventory.service.ts`)
   - Current: ~40 uses per item
   - Find: `DURABILITY_DECAY`, break mechanics

### 2.3 Calculate Current Economic Flow

After extracting all faucet/sink data, calculate:

```typescript
interface EconomySnapshot {
  dailyWealthInjection: {
    casual: number;    // 30 min/day player
    active: number;    // 2 hr/day player
    hardcore: number;  // 8 hr/day player
    whale: number;     // Monetizing + hardcore
  };
  dailyWealthRemoval: {
    casual: number;
    active: number;
    hardcore: number;
    whale: number;
  };
  netDailyFlow: {
    casual: number;    // Should be slightly positive
    active: number;    // Should be near-zero
    hardcore: number;  // Can be slightly negative
    whale: number;     // Should be positive (reward spending)
  };
}
```

**Target Balance (Industry Standard):**
- Casual players: +5% to +15% daily wealth growth
- Active players: -5% to +10% daily (break-even engagement)
- Hardcore: -10% to +5% (time investment vs. spending)
- The gap between top and bottom should compress over time, not expand

---

## Part 3: Tri-Currency System Design

### 3.1 Currency Hierarchy Definition

The new economy introduces three distinct currencies:

```typescript
// New currency type definitions
enum CurrencyType {
  CREDITS = 'credits',  // Formerly "Wealth" - Soft currency
  TOKENS = 'tokens',    // Action/energy currency - The grind gate
  BONDS = 'bonds'       // Hard/premium currency - Status symbol
}

interface CurrencyProperties {
  credits: {
    earnedBy: ['play', 'missions', 'businesses', 'heists', 'selling_items'];
    spentOn: ['shop', 'gambling', 'bail', 'upgrades', 'token_conversion'];
    persistence: 'permanent';
    tradeability: false;  // Cannot be given to other players
  };
  tokens: {
    earnedBy: ['channel_points', 'credit_conversion', 'battle_pass'];
    spentOn: ['play_actions', 'business_collection', 'premium_missions'];
    persistence: 'soft_cap_decay';  // See decay rules below
    tradeability: false;
  };
  bonds: {
    earnedBy: ['real_money', 'massive_credit_conversion', 'top_achievements'];
    spentOn: ['season_pass', 'exclusive_cosmetics', 'premium_features'];
    persistence: 'permanent';
    tradeability: false;  // Unlike Warframe, keep it closed
  };
}
```

### 3.2 Token System Design (The "Energy" Gate)

Tokens prevent hyperinflation by gating the frequency of wealth-generating actions.

**Token Mechanics:**

```typescript
interface TokenConfig {
  // Earning
  CHANNEL_POINT_CONVERSION: 100;      // 100 channel points = 1 token
  CREDIT_TO_TOKEN_BASE_RATE: 1000;    // $1,000 credits = 1 token (base)
  BATTLE_PASS_TOKEN_REWARDS: [10, 25, 50, 100];  // At levels 10, 25, 50, 100
  
  // Spending
  PLAY_COMMAND_COST: 1;               // 1 token per play
  BUSINESS_COLLECTION_COST: 2;        // 2 tokens to collect revenue
  PREMIUM_MISSION_COST: 5;            // Optional high-reward missions
  
  // Decay/Caps
  SOFT_CAP: 100;                      // Above this, decay applies
  DECAY_RATE_ABOVE_CAP: 0.05;         // 5% daily decay on excess
  HARD_CAP: 500;                      // Maximum tokens holdable
}
```

**Dynamic Conversion Scale (Anti-Whale Measure):**

```typescript
// Credits-to-Token conversion gets more expensive as you buy more per day
function getTokenConversionCost(tokensAlreadyBoughtToday: number): number {
  const baseCost = 1000;  // $1,000 credits per token
  const scalingFactor = 1.15;  // 15% more expensive each purchase
  
  return Math.floor(baseCost * Math.pow(scalingFactor, tokensAlreadyBoughtToday));
}

// Example daily costs:
// Token 1: $1,000
// Token 2: $1,150
// Token 3: $1,323
// Token 10: $4,046
// Token 20: $16,367
// Token 50: $1,083,471  // Effectively capped by cost
```

### 3.3 Bonds System Design (The Premium Currency)

Bonds serve as the aspirational currency, similar to V-Bucks or Apex Coins.

**Bond Mechanics:**

```typescript
interface BondsConfig {
  // Primary acquisition
  REAL_MONEY_BUNDLES: [
    { bonds: 500, usd: 4.99, bonus: 0 },
    { bonds: 1100, usd: 9.99, bonus: 100 },      // 10% bonus
    { bonds: 2400, usd: 19.99, bonus: 400 },     // 20% bonus
    { bonds: 6500, usd: 49.99, bonus: 1500 },    // 30% bonus
  ];
  
  // F2P path (the "Grind" option - similar to Warframe)
  CREDIT_TO_BOND_CONVERSION: {
    cost: 5_000_000,      // $5 million credits
    bonds_received: 100,  // For 100 bonds
    cooldown_days: 7,     // Once per week max
  };
  
  // Achievement bonds (one-time)
  FIRST_KINGPIN_TIER: 500;
  MILLION_WEALTH_MILESTONE: 100;
  SEASON_COMPLETION: 200;
  
  // Spending
  SEASON_PASS_COST: 1000;
  EXCLUSIVE_SKIN_RANGE: [200, 2000];
  PREMIUM_CRATE_COST: 150;
}
```

**Season Pass Design (The Retention Engine):**

```typescript
interface SeasonPass {
  cost: 1000;  // Bonds
  duration_days: 90;  // 3 months
  
  rewards: {
    // Free track (everyone gets these)
    free_track: [
      { level: 1, reward: { credits: 5000 } },
      { level: 10, reward: { tokens: 25 } },
      { level: 25, reward: { crate: 'rare' } },
      { level: 50, reward: { credits: 25000 } },
      { level: 75, reward: { tokens: 50 } },
      { level: 100, reward: { crate: 'legendary' } },
    ];
    
    // Premium track (pass holders only)
    premium_track: [
      { level: 1, reward: { bonds: 100, exclusive_title: 'Season Starter' } },
      { level: 25, reward: { bonds: 150, tokens: 50 } },
      { level: 50, reward: { bonds: 200, exclusive_skin: true } },
      { level: 75, reward: { bonds: 250, tokens: 100 } },
      { level: 100, reward: { bonds: 400, exclusive_skin: true, tokens: 150 } },
      // Total bonds returned: 1,100 (110% return - "break even plus profit")
      // Hidden: Profit bonds are at levels 75-100, forcing engagement
    ];
    
    // Bonus levels (100+) - similar to Fortnite Chapter 6 model
    bonus_track: [
      { level: 110, reward: { bonds: 100 } },
      { level: 120, reward: { bonds: 100 } },
      { level: 130, reward: { bonds: 100 } },
      { level: 140, reward: { bonds: 200, mythic_crate: true } },
      // Additional 500 bonds for hardcore grinders
    ];
  };
  
  // The "Sunk Cost" psychology:
  // - Level 1-50: Fast progression, feels rewarding
  // - Level 50-75: Slows down, tokens help here
  // - Level 75-100: Grind zone, where most "break even" bonds are
  // - Level 100+: Bonus rewards for dedicated players
}
```

---

## Part 4: Faucet Rebalancing

### 4.1 Play Command Rebalancing

**Current Problem:** Unlimited wealth generation, only gated by channel points.

**Proposed Solution:** Gate by Tokens + reduce wealth scaling.

```typescript
// BEFORE
async executePlay(userId: string): Promise<PlayResult> {
  const wealthEarned = calculateWealthByTier(user.tier);  // $50 - $100,000
  await addWealth(userId, wealthEarned);
  return result;
}

// AFTER
async executePlay(userId: string): Promise<PlayResult> {
  // Token gate
  const tokenCost = 1;
  if (user.tokens < tokenCost) {
    throw new InsufficientTokensError('Need 1 token to play');
  }
  await deductTokens(userId, tokenCost);
  
  // Reduced and flattened wealth curve
  const wealthEarned = calculateRebalancedWealth(user.tier);
  // New ranges:
  // Rookie: $100 - $500
  // Associate: $300 - $1,500
  // Soldier: $750 - $3,500
  // Captain: $1,500 - $7,500
  // Underboss: $3,000 - $15,000
  // Kingpin: $6,000 - $30,000  // 3x reduction from current max
  
  await addCredits(userId, wealthEarned);
  return result;
}
```

**Wealth Curve Flattening Rationale:**
- Current: 1:200 ratio between Rookie min ($50) and Kingpin max ($100,000)
- Proposed: 1:300 ratio but with lower absolute values
- This reduces overall inflation while maintaining progression feeling

### 4.2 Business Revenue Rebalancing

**Current Problem:** Pure faucet with no maintenance costs. Kingpins generate $720k/day passively.

**Proposed Solution:** Implement "Operating Costs" requiring both Credits AND Tokens.

```typescript
interface BusinessConfig {
  // Revenue remains similar
  REVENUE_PER_CYCLE: {
    common: { min: 50, max: 200 },
    uncommon: { min: 200, max: 500 },
    rare: { min: 500, max: 2000 },
    legendary: { min: 2000, max: 10000 },
  };
  
  // NEW: Operating costs (percentage of revenue)
  OPERATING_COST_PERCENTAGE: 0.20;  // 20% of revenue goes to "upkeep"
  
  // NEW: Collection requires tokens
  TOKEN_COLLECTION_COST: {
    common: 1,
    uncommon: 2,
    rare: 3,
    legendary: 5,
  };
  
  // NEW: Accumulation cap (revenue stops if not collected)
  MAX_ACCUMULATED_CYCLES: 24;  // Must collect within 24 hours
  
  // NEW: Decay for uncollected revenue
  UNCOLLECTED_DECAY_RATE: 0.10;  // 10% decay per cycle after cap
}

async collectBusinessRevenue(userId: string, businessId: string): Promise<number> {
  const business = await getBusiness(businessId);
  const accumulatedRevenue = calculateAccumulatedRevenue(business);
  
  // Deduct operating costs
  const operatingCost = Math.floor(accumulatedRevenue * OPERATING_COST_PERCENTAGE);
  const netRevenue = accumulatedRevenue - operatingCost;
  
  // Check token requirement
  const tokenCost = TOKEN_COLLECTION_COST[business.tier];
  if (user.tokens < tokenCost) {
    throw new InsufficientTokensError(`Need ${tokenCost} tokens to collect`);
  }
  
  await deductTokens(userId, tokenCost);
  await deductCredits(userId, operatingCost);  // Operating cost as sink
  await addCredits(userId, accumulatedRevenue);  // Gross revenue added
  
  // Net effect: Player pays operating cost from their own pocket
  // True injection = netRevenue
  
  return netRevenue;
}
```

**Impact Calculation:**
- Before: $720,000/day pure injection
- After: $720,000 * 0.80 = $576,000/day net injection
- Plus: Token requirement limits collection frequency
- Plus: Missed collections decay, creating urgency without F2P punishment

### 4.3 Mission Reward Rebalancing

**Current Problem:** Kingpin missions pay $60,000 each (up to $180,000/day).

**Proposed Solution:** Cap daily mission rewards + introduce "Premium Missions" for tokens.

```typescript
interface MissionConfig {
  // Standard daily missions (reduced rewards)
  STANDARD_MISSIONS: {
    count: 3,
    rewards: {
      rookie: { min: 200, max: 400 },
      associate: { min: 400, max: 800 },
      soldier: { min: 800, max: 1600 },
      captain: { min: 1600, max: 3200 },
      underboss: { min: 3200, max: 6400 },
      kingpin: { min: 6400, max: 12800 },  // Max $38,400/day (was $180,000)
    },
  };
  
  // NEW: Premium missions (optional, cost tokens)
  PREMIUM_MISSIONS: {
    count: 2,  // Available per day
    tokenCost: 5,  // Per mission
    multiplier: 3.0,  // 3x standard rewards
    bonusTokenReward: 2,  // Get some tokens back
  };
  
  // Weekly challenge (big payoff, engagement driver)
  WEEKLY_CHALLENGE: {
    creditReward: 50000,
    tokenReward: 25,
    bondsReward: 50,  // F2P bond source!
    xpReward: 10000,
  };
}
```

---

## Part 5: Sink Enhancement

### 5.1 New Sink: Credit-to-Bonds Conversion

**Purpose:** Provide a "Golden Sink" for wealthy players while enabling F2P access to premium content.

```typescript
// Implement the Warframe-style wealth redistribution without trading
interface BondConversionConfig {
  CREDIT_COST: 5_000_000;      // Very expensive
  BONDS_RECEIVED: 100;
  COOLDOWN_DAYS: 7;
  LEVEL_REQUIREMENT: 50;       // Must be Captain or above
}

async convertCreditsToBonds(userId: string): Promise<ConversionResult> {
  const user = await getUser(userId);
  
  // Check cooldown
  const lastConversion = user.lastBondConversion;
  if (lastConversion && daysSince(lastConversion) < COOLDOWN_DAYS) {
    throw new CooldownError(`Can convert again in ${daysRemaining} days`);
  }
  
  // Check level
  if (user.level < 50) {
    throw new LevelRequirementError('Must be Captain tier or above');
  }
  
  // Check credits
  if (user.credits < CREDIT_COST) {
    throw new InsufficientCreditsError(`Need $${CREDIT_COST.toLocaleString()} credits`);
  }
  
  await deductCredits(userId, CREDIT_COST);
  await addBonds(userId, BONDS_RECEIVED);
  await updateLastBondConversion(userId, now());
  
  // Log for economy tracking
  await logEconomyEvent({
    type: 'CREDIT_TO_BOND_CONVERSION',
    userId,
    creditsRemoved: CREDIT_COST,
    bondsAdded: BONDS_RECEIVED,
  });
  
  return { success: true, bondsReceived: BONDS_RECEIVED };
}
```

### 5.2 Enhanced Bail System

**Current:** 10% of wealth (min $100).
**Problem:** Doesn't hurt wealthy players proportionally.

**Proposed:** Tiered bail with floor AND ceiling considerations.

```typescript
interface BailConfig {
  BASE_PERCENTAGE: 0.10;       // 10% base
  MINIMUM_BAIL: 500;           // Increased from $100
  
  // NEW: Tier-based scaling
  TIER_MULTIPLIERS: {
    rookie: 0.5,      // 5% effective rate (help new players)
    associate: 0.75,  // 7.5%
    soldier: 1.0,     // 10%
    captain: 1.25,    // 12.5%
    underboss: 1.5,   // 15%
    kingpin: 2.0,     // 20% (aggressive sink for top tier)
  };
  
  // NEW: Maximum bail (prevent catastrophic loss)
  MAXIMUM_BAIL: 500_000;  // Cap at $500k
}

function calculateBail(user: User): number {
  const baseBail = user.credits * BASE_PERCENTAGE;
  const tierMultiplier = TIER_MULTIPLIERS[user.tier];
  const scaledBail = baseBail * tierMultiplier;
  
  return Math.min(
    MAXIMUM_BAIL,
    Math.max(MINIMUM_BAIL, scaledBail)
  );
}
```

### 5.3 New Sink: Insurance Premiums

**Purpose:** Convert the passive robbery protection into an active subscription cost.

```typescript
interface InsuranceConfig {
  // Replaces current housing-based protection
  TIERS: {
    basic: {
      protection: 0.25,    // 25% of stolen wealth returned
      dailyCost: 1000,
      tokenCost: 0,
    },
    standard: {
      protection: 0.50,    // 50%
      dailyCost: 5000,
      tokenCost: 1,
    },
    premium: {
      protection: 0.75,    // 75%
      dailyCost: 15000,
      tokenCost: 2,
    },
    platinum: {
      protection: 0.90,    // 90%
      dailyCost: 50000,
      tokenCost: 5,
      bondsCost: 10,       // Premium tier requires bonds too
    },
  };
  
  // Auto-deduct daily, cancel if insufficient funds
  AUTO_RENEWAL: true;
  GRACE_PERIOD_HOURS: 24;
}
```

### 5.4 Enhanced Gambling Sinks

**Current House Edges:**
- Slots: ~5-15% (estimated)
- Blackjack: ~2-5%
- Lottery: 10% house cut

**Proposed Enhancements:**

```typescript
interface GamblingConfig {
  // Slots: Add progressive jackpot contribution
  SLOTS: {
    JACKPOT_CONTRIBUTION: 0.05,  // 5% to jackpot
    HOUSE_EDGE: 0.08,            // Additional 8% to sink
    // Total: 13% of all slot wagers removed from economy
  };
  
  // NEW: High-roller tables (bigger bets, bigger sink)
  HIGH_ROLLER_TABLES: {
    minimumBet: 100_000,
    houseEdgeMultiplier: 1.5,    // 50% higher house edge
    exclusiveRewards: true,      // Chance at cosmetics
    tokenCost: 3,                // Costs tokens to access
  };
  
  // Lottery enhancement
  LOTTERY: {
    HOUSE_CUT: 0.15,             // Increased from 10% to 15%
    BONDS_PRIZE_POOL: true,      // Part of jackpot paid in Bonds
  };
}
```

---

## Part 6: Token Decay System (The Apex Legends Fix)

### 6.1 Preventing Token Hoarding

**Problem from Apex:** Legend Tokens have no sink, veterans hold millions.

**Solution:** Implement soft cap with decay.

```typescript
interface TokenDecayConfig {
  SOFT_CAP: 100;           // Comfortable holding amount
  HARD_CAP: 500;           // Absolute maximum
  DECAY_CHECK_INTERVAL: 'daily';  // When decay is calculated
  
  DECAY_RULES: {
    // Below soft cap: No decay
    belowSoftCap: 0,
    
    // Above soft cap: 5% daily decay on excess
    aboveSoftCap: 0.05,
    
    // At hard cap: 10% daily decay on entire balance
    atHardCap: 0.10,
  };
}

async processTokenDecay(userId: string): Promise<DecayResult> {
  const user = await getUser(userId);
  
  if (user.tokens <= SOFT_CAP) {
    return { decayed: 0, reason: 'Below soft cap' };
  }
  
  let decayAmount: number;
  let reason: string;
  
  if (user.tokens >= HARD_CAP) {
    // Aggressive decay at hard cap
    decayAmount = Math.floor(user.tokens * DECAY_RULES.atHardCap);
    reason = 'At hard cap - 10% total decay';
  } else {
    // Moderate decay on excess above soft cap
    const excess = user.tokens - SOFT_CAP;
    decayAmount = Math.floor(excess * DECAY_RULES.aboveSoftCap);
    reason = 'Above soft cap - 5% excess decay';
  }
  
  await deductTokens(userId, decayAmount);
  
  // Log for transparency (players should see this)
  await createNotification(userId, {
    type: 'TOKEN_DECAY',
    message: `${decayAmount} tokens expired. Tokens above ${SOFT_CAP} decay daily.`,
  });
  
  return { decayed: decayAmount, reason };
}
```

### 6.2 Token Earning Transparency

Players should always know how to earn tokens:

```typescript
interface TokenEarningDisplay {
  sources: [
    {
      name: 'Channel Points',
      rate: '100 points = 1 token',
      limit: 'Unlimited during streams',
    },
    {
      name: 'Credit Conversion',
      rate: '$1,000+ credits = 1 token (scales up)',
      limit: 'Becomes expensive quickly',
    },
    {
      name: 'Season Pass',
      rate: 'Up to 300 tokens per season',
      limit: 'Requires pass purchase',
    },
    {
      name: 'Weekly Challenges',
      rate: '25 tokens per week',
      limit: 'Complete all weekly missions',
    },
  ];
}
```

---

## Part 7: Implementation Checklist

### Phase 1: Currency Infrastructure (Week 1-2)

- [ ] **Database Migration**
  - Add `tokens` column to users table (integer, default 0)
  - Add `bonds` column to users table (integer, default 0)
  - Rename `wealth` column to `credits` (or add alias)
  - Create `currency_transactions` table for audit trail
  - Create `token_purchases_today` tracking table

- [ ] **Core Currency Service**
  - Create `currency.service.ts` with unified currency management
  - Implement `addCurrency(userId, type, amount)`
  - Implement `deductCurrency(userId, type, amount)`
  - Implement `transferCurrency(fromId, toId, type, amount)` (for future)
  - Add balance validation and error handling

- [ ] **Constants Migration**
  - Create `economy.constants.ts` with all new values
  - Document each constant with rationale
  - Add environment variable overrides for tuning

### Phase 2: Token System (Week 2-3)

- [ ] **Token Mechanics**
  - Implement channel point to token conversion webhook
  - Implement credit-to-token conversion with scaling
  - Add token decay daily job
  - Create token balance UI component

- [ ] **Play Command Refactor**
  - Add token requirement check
  - Update wealth calculation formula
  - Add token cost to play result display

- [ ] **Business Refactor**
  - Add operating cost deduction
  - Add token requirement for collection
  - Implement accumulation cap and decay

### Phase 3: Bonds System (Week 3-4)

- [ ] **Bonds Infrastructure**
  - Integrate payment processor for bond purchases (Stripe)
  - Implement credit-to-bonds conversion
  - Add bonds to user profile display

- [ ] **Season Pass System**
  - Create `season-pass.service.ts`
  - Implement pass purchase with bonds
  - Create level-up reward distribution
  - Build pass progress UI

### Phase 4: Sink Enhancement (Week 4-5)

- [ ] **Bail System Update**
  - Implement tiered bail calculation
  - Add minimum/maximum caps

- [ ] **Insurance System**
  - Create `insurance.service.ts`
  - Implement daily premium deduction job
  - Update robbery to check insurance status

- [ ] **Gambling Updates**
  - Increase house edges per spec
  - Add high-roller table system
  - Implement bonds in lottery prizes

### Phase 5: Monitoring & Tuning (Ongoing)

- [ ] **Economy Dashboard**
  - Total currency in circulation (credits, tokens, bonds)
  - Daily injection/removal rates
  - Player wealth distribution (Gini coefficient)
  - Top 10 wealthiest players tracker
  - Inflation rate calculation

- [ ] **Alert System**
  - Alert if daily injection > 2x daily removal
  - Alert if any player accumulates > $10M in a week
  - Alert if token decay removes < 1% of excess tokens

---

## Part 8: Code Review Queries

When reviewing the codebase, use these search patterns:

```bash
# Find all wealth additions (faucets)
grep -rn "addWealth\|wealth +=" --include="*.ts"
grep -rn "user.wealth\s*\+=" --include="*.ts"

# Find all wealth deductions (sinks)
grep -rn "deductWealth\|wealth -=" --include="*.ts"
grep -rn "user.wealth\s*-=" --include="*.ts"

# Find tier-based calculations
grep -rn "getTier\|playerTier\|user.tier" --include="*.ts"

# Find gambling/house edge logic
grep -rn "houseEdge\|houseCut\|HOUSE_" --include="*.ts"

# Find mission reward logic
grep -rn "missionReward\|MISSION_REWARD" --include="*.ts"

# Find business revenue logic
grep -rn "businessRevenue\|REVENUE\|collectRevenue" --include="*.ts"

# Find monetization conversion rates
grep -rn "subReward\|bitReward\|donationReward" --include="*.ts"
```

---

## Part 9: Success Metrics

After implementation, track these KPIs:

| Metric | Target | Warning Threshold |
|--------|--------|-------------------|
| Daily Credit Inflation Rate | 2-5% | >10% |
| Token Utilization Rate | 70-90% | <50% |
| Season Pass Completion Rate | 40-60% | <25% |
| Bond Purchase Conversion | 5-10% of active users | <2% |
| Player Wealth Gini Coefficient | 0.4-0.6 | >0.75 |
| Daily Active User Retention (7-day) | 40%+ | <25% |
| Average Session Length | 20-45 min | <10 min |

---

## Appendix: Reference Links

### Industry Case Studies (from PDF analysis)
- Fortnite V-Bucks economy (break-even pass at level 100+)
- Apex Legends Tri-Currency (Legend Tokens hyperinflation warning)
- Overwatch 2 Deficit Model (avoid this for F2P friendliness)
- Warframe Platinum trading (inspiration for credit-to-bonds)
- Call of Duty cross-title currency (unified economy benefits)

### Behavioral Economics Principles Applied
1. **Decoupling**: Bonds separate "pain of paying" from consumption
2. **Sunk Cost Fallacy**: Season Pass creates engagement commitment
3. **Anchoring**: Token costs anchor value perception
4. **Loss Aversion**: Token decay creates urgency without punishment
5. **Endowment Effect**: Earned tokens feel more valuable than bought ones

---

*This document serves as the authoritative reference for Kingpin economy reengineering. All implementation should be validated against these specifications.*
