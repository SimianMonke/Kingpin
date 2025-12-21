# Kingpin Economy: Wealth Faucets & Sinks Analysis

## Executive Summary

This document provides a comprehensive analysis of all wealth generation (faucets) and removal (sinks) mechanisms in the Kingpin economy. Understanding these flows is essential for maintaining a balanced economy that keeps players engaged without runaway inflation or deflation.

**Key Finding:** The economy has multiple faucets that generate wealth from nothing, but relatively fewer sinks that permanently remove wealth. The gambling system is designed with house edges that act as sinks, while PvP robbery is a **wealth transfer** (not a faucet/sink).

---

## Part 1: Wealth Faucets (Currency Generation)

These systems CREATE new wealth in the economy from nothing.

### 1.1 Play Command (Primary Faucet)

**Source:** `play.service.ts`, `constants.ts`

The play command is the primary wealth generation engine, tied to channel point redemptions.

| Tier | Wealth Range | XP Range | Tier Multiplier |
|------|--------------|----------|-----------------|
| Rookie | $50 - $500 | Variable | 1.0x |
| Associate | $500 - $2,000 | Variable | 1.1x |
| Soldier | $2,000 - $6,000 | Variable | 1.2x |
| Captain | $6,000 - $16,000 | Variable | 1.3x |
| Underboss | $15,000 - $40,000 | Variable | 1.4x |
| Kingpin | $40,000 - $100,000 | Variable | 1.5x |

**Modifiers:**
- **Juicernaut Buff:** +25% wealth (1.25x multiplier)
- **Negative Event Chance:** 15% (wealth loss on these events, but still gain XP)
- **Bust Chance:** 5% (no rewards, sent to jail)

**Expected Value Calculation (Rookie):**
- 80% chance of positive event: ~$275 average
- 15% chance of negative event: ~-$100 average
- 5% chance of bust: $0
- **EV ≈ $205 per play** (before tier multiplier)

**Inflation Risk:** HIGH - This is unlimited wealth generation gated only by channel points.

---

### 1.2 Daily Check-In (Guaranteed Faucet)

**Source:** `user.service.ts`, `formulas.ts`

```typescript
CHECKIN_CONFIG = {
  BASE_WEALTH: 100,
  BASE_XP: 50,
  STREAK_BONUS_WEALTH_PER_DAY: 10,
  STREAK_BONUS_XP_PER_DAY: 5,
  MAX_STREAK_BONUS_DAYS: 30,
}
```

**Wealth per Check-In:**
- Day 1: $100
- Day 7: $170
- Day 14: $240
- Day 21: $310
- Day 28: $380
- Day 30+: $400 (capped)

**Milestone Crate Rewards (Perpetual Cycle):**
- Every 7 days: Uncommon Crate
- Every 28 days: Legendary Crate (overrides weekly)

**Daily Active Player Injection:** A player checking in daily for 30 days generates:
- **$7,350 wealth** (sum of daily check-ins)
- **Plus crate contents** (see Crate section)

**Inflation Risk:** LOW-MEDIUM - Fixed amounts, but guaranteed daily income for all active players.

---

### 1.3 Mission Rewards

**Source:** `mission.service.ts`, `constants.ts`

Players receive 3 daily missions with wealth/XP rewards scaled by tier.

**Base Mission Reward Ranges:**
| Tier | Wealth Range | XP Range |
|------|--------------|----------|
| Rookie | $200 - $500 | 100 - 250 |
| Associate | $500 - $1,500 | 250 - 500 |
| Soldier | $1,500 - $4,000 | 500 - 1,000 |
| Captain | $4,000 - $10,000 | 1,000 - 2,000 |
| Underboss | $10,000 - $25,000 | 2,000 - 4,000 |
| Kingpin | $25,000 - $60,000 | 4,000 - 8,000 |

**Daily Maximum per Player:** 3 missions × max reward
- Kingpin: Up to **$180,000/day** from missions alone

**Mission Types:**
- `play_count`: Complete X plays
- `wealth_earned`: Earn X wealth
- `rob_success`: Successfully rob X times
- `checkin`: Check in X times
- `mission_complete`: Complete X missions

**Inflation Risk:** MEDIUM-HIGH - Scales significantly with tier.

---

### 1.4 Achievement Rewards

**Source:** `achievement.service.ts`

One-time rewards for milestones. Not recurring, so limited long-term inflation impact.

**Example Achievements:**
- First Play: $500, 100 XP
- 100 Plays: $5,000, 1,000 XP
- First Million: $50,000, 5,000 XP
- Jackpot Winner: $25,000, 2,500 XP

**Inflation Risk:** LOW - One-time only, provides initial economy boost for new players.

---

### 1.5 Crate Opening Rewards

**Source:** `crate.service.ts`, `formulas.ts`

Crates can contain direct wealth drops.

**Wealth Drop Ranges by Crate Tier:**
| Crate Tier | Wealth Range | Wealth Drop Chance |
|------------|--------------|-------------------|
| Common | $100 - $500 | ~25% |
| Uncommon | $500 - $2,500 | ~20% |
| Rare | $2,500 - $10,000 | ~15% |
| Legendary | $10,000 - $50,000 | ~10% |

**Crate Sources:**
- Play drops (2% base, 6% Juicernaut)
- Check-in milestones (weekly/monthly)
- Mission rewards
- Achievement rewards
- Faction rewards
- Heist participation

**Inflation Risk:** MEDIUM - Tied to other activities, amplifies their inflation.

---

### 1.6 Faction Weekly Rewards

**Source:** `faction.service.ts`

Weekly distribution to active faction members.

```typescript
TERRITORY_REWARDS = {
  BASE_WEALTH_PER_TERRITORY: 1000,
  BASE_XP_PER_TERRITORY: 100,
  CONTESTED_MULTIPLIER: 0.5,  // 50% for contested
  WINNER_BONUS: 0.25,         // +25% for winning faction
  MIN_CONTRIBUTION_FOR_REWARD: 50,  // Activity points
}
```

**Example Weekly Payout (Winning Faction, 5 Territories):**
- Base: 5 × $1,000 = $5,000
- Winner Bonus: +25% = $6,250
- Split among active members

**Top 3 Contributors Bonus:** Rare Crate

**Inflation Risk:** LOW-MEDIUM - Weekly, split among many players.

---

### 1.7 Monetization/Juicernaut Rewards

**Source:** `monetization.service.ts`, `juicernaut.service.ts`

Real-money contributions generate in-game currency.

**Wealth per Monetization Event:**
| Event | Wealth | XP | USD Value |
|-------|--------|-----|-----------|
| Kick Sub T1 | $5,000 | 500 | $4.99 |
| Kick Sub T2 | $10,000 | 1,000 | $9.99 |
| Kick Sub T3 | $25,000 | 2,500 | $24.99 |
| Kick Gift Sub | $7,500 | 750 | $4.99 |
| Kick Kick | $2,500 | 250 | ~$1 |
| Twitch Sub T1 | $5,000 | 500 | $4.99 |
| Twitch Sub T2 | $10,000 | 1,000 | $9.99 |
| Twitch Sub T3 | $25,000 | 2,500 | $24.99 |
| Twitch Bits/100 | $2,500 | 250 | $1.00 |
| Donation/$ | $2,500 | 250 | $1.00 |

**Juicernaut Session Winner Rewards:**
| Total Contribution | Wealth | XP | Crate |
|-------------------|--------|-----|-------|
| $0-$5 | $2,500 | 250 | None |
| $5-$25 | $10,000 | 1,000 | Uncommon |
| $25-$100 | $25,000 | 2,500 | Rare |
| $100+ | $50,000 | 5,000 | Legendary |

**Active Juicernaut Buffs:**
- 2x XP
- 1.25x Wealth
- 3x Crate Drop Chance

**Inflation Risk:** VARIABLE - Tied to real-money spending, spikes during streams.

---

### 1.8 Business Revenue (Passive Income)

**Source:** `business.service.ts`

Businesses generate periodic passive income.

**Revenue Ranges by Business Tier:**
| Business Tier | Revenue/Cycle | Cycle Time |
|--------------|---------------|------------|
| Common | $50 - $200 | 1 hour |
| Uncommon | $200 - $500 | 1 hour |
| Rare | $500 - $2,000 | 1 hour |
| Legendary | $2,000 - $10,000 | 1 hour |

**Max Businesses Owned:** 3 (per player)

**Daily Passive Income (Max):** 24 hours × 3 legendary businesses × $10,000 = **$720,000/day** (theoretical max)

**Inflation Risk:** MEDIUM-HIGH - Continuous wealth injection for business owners.

---

### 1.9 Heist Participation Rewards

**Source:** `heist.service.ts`

Community heists during streams provide participation rewards.

**Heist Reward Distribution:**
- Success: Participants split loot pool
- Failure: Small consolation XP

**Loot Pool Calculation:** Based on participant count and tier distribution.

**Inflation Risk:** LOW - Event-based, limited frequency.

---

### 1.10 Item Sales

**Source:** `inventory.service.ts`

Selling items converts item value to wealth.

```typescript
sell_price = item.sell_price ?? Math.floor(item.purchase_price / 2)
```

**Note:** This is NOT pure wealth creation if the item was originally purchased - it's **recovering** spent wealth at a loss. However, items from crate drops or heists ARE new wealth entering the economy.

**Inflation Risk:** LOW-MEDIUM - Only new wealth when selling dropped items.

---

## Part 2: Wealth Sinks (Currency Removal)

These systems REMOVE wealth from the economy permanently.

### 2.1 Shop Purchases

**Source:** `shop.service.ts`

Items purchased from the player shop.

**Item Price Ranges by Tier:**
| Item Tier | Price Range |
|-----------|-------------|
| Common | $500 - $2,000 |
| Uncommon | $2,000 - $10,000 |
| Rare | $10,000 - $50,000 |
| Legendary | $50,000 - $250,000 |

**Deflation Impact:** HIGH - Direct wealth removal for desired items.

---

### 2.2 Black Market Purchases

**Source:** `black-market.service.ts`

Rotating inventory with limited stock and occasional discounts.

**Configuration:**
```typescript
BLACK_MARKET_CONFIG = {
  ROTATION_HOURS: 6,
  LEGENDARY_CHANCE: 0.30,  // 30% chance of legendary item
  FEATURED_DISCOUNT: 0.15, // 15% off featured item
}
```

**Deflation Impact:** MEDIUM-HIGH - Premium items drive significant spending.

---

### 2.3 Consumable Purchases

**Source:** `consumable.service.ts`

Buffs and single-use items purchased for wealth.

**Example Consumables:**
- XP Boost (2x, 1hr): $5,000
- Rob Attack Boost: $10,000
- Crate Drop Boost: $15,000

**Deflation Impact:** MEDIUM - Recurring purchases for active players.

---

### 2.4 Bail Costs

**Source:** `jail.service.ts`

```typescript
JAIL_CONFIG = {
  DURATION_MINUTES: 60,
  BAIL_COST_PERCENT: 0.10,  // 10% of wealth
  MIN_BAIL: 100,
}
```

**Average Bail Cost:** 10% of player's wealth (minimum $100)

**Trigger Rate:** 5% bust chance per play

**Deflation Impact:** MEDIUM - Proportional to player wealth, consistent drain.

---

### 2.5 Gambling House Edge

**Source:** `gambling.service.ts`, `formulas.ts`

Gambling has built-in house edges that act as wealth sinks.

#### 2.5.1 Slots

**Jackpot Contribution:** 5% of each wager goes to jackpot pool
```typescript
JACKPOT_CONTRIBUTION_RATE: 0.05
```

**Payout Analysis:**
| Match | Payout Multiplier |
|-------|-------------------|
| 3x 🍒 | 3x |
| 3x 🍋 | 5x |
| 3x 🍊 | 8x |
| 3x 🍇 | 12x |
| 3x 💎 | 25x |
| 3x 7️⃣ | 50x |
| 3x 🎰 | JACKPOT |
| 2x Match | 0.5x - 2x |
| No Match | 0x (loss) |

**Expected Value:** Negative (house edge ~5-15% estimated)

#### 2.5.2 Blackjack

- Standard casino rules
- Dealer hits on soft 17
- Blackjack pays 2.5x (3:2)
- Win pays 2x

**House Edge:** ~0.5% with optimal play, ~2-5% for average players

#### 2.5.3 Coinflip

- 50/50 odds
- No house cut (PvP only)

**House Edge:** 0% (pure PvP transfer)

#### 2.5.4 Lottery

```typescript
LOTTERY_HOUSE_CUT: 0.10  // 10% of ticket sales
```

**Payout Structure:**
| Matches | Payout |
|---------|--------|
| 3/3 | Full Prize Pool |
| 2/3 | 10x Ticket Cost |
| 1/3 | 2x Ticket Cost |
| 0/3 | $0 |

**House Edge:** 10% (guaranteed removal from each ticket)

**Deflation Impact:** HIGH - Consistent percentage drain on all gambling activity.

---

### 2.6 Item Durability Decay

**Source:** `inventory.service.ts`, `formulas.ts`

Items degrade during robbery actions and eventually break.

```typescript
DURABILITY_CONFIG = {
  DECAY_PER_ROB_ATTACKER: { min: 2, max: 3 },
  DECAY_PER_ROB_DEFENDER: { min: 2, max: 3 },
  BREAK_THRESHOLD: 0,  // Item destroyed at 0
}
```

**Average Uses Until Break:** 100 durability ÷ 2.5 avg decay = **40 rob actions**

**Economic Effect:** Forces item replacement, driving shop/market purchases.

**Deflation Impact:** INDIRECT - Drives spending on replacement items.

---

### 2.7 Housing Upkeep (Future Consideration)

**Source:** `housing.service.ts`

Currently housing provides insurance against robbery losses. Upkeep costs are not currently implemented but referenced in the codebase.

**Potential Implementation:**
- Daily/weekly upkeep fees based on housing tier
- Housing provides rob protection percentage

**Deflation Impact:** NONE CURRENTLY - Placeholder for future sink.

---

## Part 3: Wealth Transfers (Neither Faucet nor Sink)

These systems move wealth between players without creating or destroying it.

### 3.1 Robbery (PvP Transfer)

**Source:** `rob.service.ts`

```typescript
ROB_CONFIG = {
  BASE_SUCCESS_RATE: 0.60,    // 60% base
  STEAL_PERCENTAGE: { min: 0.05, max: 0.15 },  // 5-15% of target wealth
  MAX_WEAPON_BONUS: 0.15,     // +15% from weapon
  MAX_ARMOR_REDUCTION: 0.15,  // -15% from armor
}
```

**Wealth Flow:** Attacker gains what defender loses (minus insurance)

**Insurance Effect:** Housing provides insurance that REDUCES transfer (acts as partial sink if insurance > 0)

**Net Economic Effect:** Neutral to slightly deflationary (due to insurance)

---

### 3.2 Coinflip (PvP Transfer)

**Source:** `gambling.service.ts`

Pure 50/50 bet between two players. Winner takes pot.

**Net Economic Effect:** Neutral (zero-sum)

---

## Part 4: Economy Balance Analysis

### 4.1 Daily Wealth Injection Estimate (Per Active Player)

| Source | Low Estimate | High Estimate |
|--------|--------------|---------------|
| Check-In | $100 | $400 |
| Play (10 plays) | $2,050 | $20,500 |
| Missions (3 complete) | $600 | $180,000 |
| Business Revenue | $0 | $720,000 |
| Crate Drops | $0 | $10,000 |
| **Daily Total** | **$2,750** | **$930,900** |

### 4.2 Daily Wealth Removal Estimate (Per Active Player)

| Source | Low Estimate | High Estimate |
|--------|--------------|---------------|
| Bail (10% of 5% of plays) | $0 | $5,000 |
| Shop Purchases | $0 | $50,000 |
| Consumables | $0 | $15,000 |
| Gambling Losses | $0 | $50,000 |
| Lottery House Cut | $0 | $1,000 |
| **Daily Total** | **$0** | **$121,000** |

### 4.3 Net Daily Flow

- **Best Case (Casual Player):** +$2,750 (net inflationary)
- **Worst Case (Heavy Spender):** +$809,900 (severely inflationary)
- **Average Active Player:** Likely +$5,000 to +$50,000/day (inflationary)

---

## Part 5: Key Observations & Concerns

### 5.1 Inflationary Pressures

1. **Uncapped Business Revenue:** Legendary businesses can generate enormous passive wealth
2. **High-Tier Mission Rewards:** Kingpin missions can pay $60,000 each
3. **Monetization Wealth Injection:** Real money converts to large in-game sums
4. **Play Command Scaling:** Wealth per play scales dramatically with tier

### 5.2 Deflationary Weaknesses

1. **No Mandatory Recurring Costs:** Players can hoard wealth indefinitely
2. **Limited Shop Inventory:** Players may run out of items to buy
3. **Gambling is Optional:** Risk-averse players avoid this sink
4. **No Wealth Tax/Decay:** No passive wealth reduction mechanism

### 5.3 Potential Balance Issues

1. **Wealth Concentration:** High-tier players generate exponentially more
2. **New Player Catch-Up:** Gap between veterans and newcomers may grow
3. **Inflation Spiral:** More wealth → higher tier → even more wealth

---

## Part 6: Recommendations for Further Research

### 6.1 Immediate Analysis Needed

1. **Historical Transaction Data:** Analyze actual wealth generation vs. removal rates
2. **Player Wealth Distribution:** Gini coefficient of wealth across playerbase
3. **Inflation Rate Tracking:** Total economy size over time

### 6.2 Potential Balance Adjustments

1. **Consider Housing Upkeep:** Implement recurring maintenance costs
2. **Wealth Tax for Ultra-Rich:** Small percentage drain above $10M
3. **Diminishing Returns on Business Revenue:** Cap or scale down at high counts
4. **Mission Reward Caps:** Daily maximum from missions
5. **Enhanced Durability Decay:** Faster item degradation = more spending

### 6.3 New Sink Ideas

1. **Prestige System:** Reset with cosmetic rewards
2. **Faction Base Building:** Collective money sink
3. **Limited-Time Events:** Exclusive items with high costs
4. **Auction House Tax:** Fee on player-to-player trades (if implemented)
5. **Insurance Premiums:** Recurring cost for robbery protection

---

## Appendix A: Formula Reference

### XP Formula
```typescript
xpForLevel(level) = 100 × 1.25^(level-1)
```

### Tier Levels
| Tier | Level Range |
|------|-------------|
| Rookie | 1-19 |
| Associate | 20-39 |
| Soldier | 40-59 |
| Captain | 60-79 |
| Underboss | 80-99 |
| Kingpin | 100+ |

### Rob Success Rate
```typescript
rate = 0.60 + weaponBonus - armorBonus + levelModifier
// Clamped to 45%-85%
```

### Bail Cost
```typescript
bailCost = max(100, wealth × 0.10)
```

---

## Appendix B: Service File Reference

| Service | Primary Responsibility |
|---------|----------------------|
| `play.service.ts` | Play command, tier events |
| `user.service.ts` | Check-in, XP, wealth management |
| `gambling.service.ts` | Slots, blackjack, coinflip, lottery |
| `mission.service.ts` | Daily missions |
| `achievement.service.ts` | One-time achievements |
| `crate.service.ts` | Crate drops and opening |
| `shop.service.ts` | Player shop purchases |
| `black-market.service.ts` | Rotating market |
| `consumable.service.ts` | Buff purchases |
| `jail.service.ts` | Bail payments |
| `rob.service.ts` | PvP robbery |
| `faction.service.ts` | Weekly faction rewards |
| `business.service.ts` | Passive revenue |
| `monetization.service.ts` | Real-money rewards |
| `juicernaut.service.ts` | Streamer event system |
| `inventory.service.ts` | Item management, selling, durability |
| `heist.service.ts` | Community heist events |

---

*Document generated for Kingpin economy research. Last updated: December 2024*
