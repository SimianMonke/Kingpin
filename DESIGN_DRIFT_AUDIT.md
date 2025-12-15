# Kingpin Design Drift Remediation Audit

**Audit Date:** December 15, 2024
**Status:** Pre-Launch Critical Review
**Scope:** Items System & Achievements System

---

## Executive Summary

During deployment readiness review, critical design drift was identified in the Items and Achievements systems. These deviations from original design intent significantly impact long-term player engagement and economic balance.

| Area | Status | Severity | Gap |
|------|--------|----------|-----|
| Item Quantity | CRITICAL | 95% deficit | 21 vs 440 target |
| Business Revenue | MISSING | Critical | Not implemented |
| Business Ownership Limits | MISSING | High | Not implemented |
| Housing Upkeep | MISSING | High | Not implemented |
| Business P&L | MISSING | Medium | Not implemented |
| Achievement Quantity | HIGH | 41-61% deficit | 59 vs 100-150 target |

---

## Part 1: Items System Evaluation

### 1.1 Item Quantity Analysis

#### Current State

| Type | Common | Uncommon | Rare | Legendary | Total |
|------|--------|----------|------|-----------|-------|
| Weapons | 3 | 2 | 2 | 1 | **8** |
| Armor | 2 | 1 | 1 | 1 | **5** |
| Businesses | 1 | 1 | 1 | 1 | **4** |
| Housing | 1 | 1 | 1 | 1 | **4** |
| **Subtotal** | 7 | 5 | 5 | 4 | **21** |

#### Target (Corrected Specification)

| Type | Common | Uncommon | Rare | Legendary | Total |
|------|--------|----------|------|-----------|-------|
| Weapons | 40 | 40 | 20 | 10 | **110** |
| Armor | 40 | 40 | 20 | 10 | **110** |
| Businesses | 40 | 40 | 20 | 10 | **110** |
| Housing | 40 | 40 | 20 | 10 | **110** |
| **Subtotal** | 160 | 160 | 80 | 40 | **440** |

#### Gap Analysis
- **Current:** 21 items
- **Target:** 440 items minimum
- **Missing:** 419 items (95.2% deficit)

#### Relevant Files
- `web/prisma/seed.ts:240-490` - Item seed data
- `web/prisma/schema.prisma:113-148` - Item model

---

### 1.2 Business Revenue System

**Status:** PARTIAL / MISSING CRITICAL COMPONENTS

#### Current Implementation
- Schema has `revenueMin` and `revenueMax` fields (`schema.prisma:123-124`)
- Business items seeded with these values (e.g., Pawn Shop: 500-800, Casino Empire: 8000-15000)
- **NO `dailyRevenuePotential` field exists**
- **NO revenue collection cron job exists**
- **NO 3-hour revenue calculation logic implemented**

#### Corrected Specification
1. `dailyRevenuePotential` field on business items
2. Revenue calculated every 3 hours (8 calculations/day)
3. Each calculation = `dailyRevenuePotential / 8` + variance
4. Business-specific modifiers

#### Missing Components
- [ ] Schema field `dailyRevenuePotential` on Item model
- [ ] Cron job for 3-hour revenue collection (`/api/cron/business-revenue`)
- [ ] BusinessService with `collectRevenue()` method
- [ ] Random variance implementation (±20%)
- [ ] User tracking of collected revenue

#### Files to Create/Modify
- `web/prisma/schema.prisma` - Add `dailyRevenuePotential` field
- `web/src/lib/services/business.service.ts` - NEW
- `web/src/app/api/cron/business-revenue/route.ts` - NEW
- `web/prisma/seed.ts` - Update business items with `dailyRevenuePotential`

---

### 1.3 Business Ownership Limits

**Status:** MISSING

#### Current Implementation
- Only `MAX_INVENTORY_SIZE = 10` exists (`constants.ts:63`)
- No business-specific ownership limit
- Players can equip only 1 business (via equipment slots)
- No limit on business items in inventory

#### Corrected Specification
- Players can own up to 3 businesses simultaneously

#### Missing Components
- [ ] `MAX_BUSINESSES_OWNED` constant
- [ ] Validation in purchase/equip logic
- [ ] UI feedback for ownership limits

#### Files to Modify
- `web/src/lib/game/constants.ts` - Add `MAX_BUSINESSES_OWNED = 3`
- `web/src/lib/services/shop.service.ts` - Add ownership check in purchase
- `web/src/lib/services/inventory.service.ts` - Add business count validation

---

### 1.4 Housing Upkeep Costs

**Status:** NOT IMPLEMENTED

#### Current Implementation
- No `upkeepCost` field in Item schema
- Housing items have `insurancePercent` only
- No upkeep deduction logic anywhere in codebase

#### Corrected Specification
1. `upkeepCost` field on housing items
2. Scheduled deduction from player wealth (daily)
3. Consequences for unpaid upkeep (stat debuff after 3 days, eviction after 7)

#### Missing Components
- [ ] Schema field `upkeepCost` on Item model
- [ ] Upkeep deduction in daily cron
- [ ] Eviction/penalty logic
- [ ] UI warnings for upcoming upkeep
- [ ] Grace period handling

#### Files to Create/Modify
- `web/prisma/schema.prisma` - Add `upkeepCost` field
- `web/src/app/api/cron/daily/route.ts` - Add housing upkeep job
- `web/src/lib/services/housing.service.ts` - NEW
- `web/prisma/seed.ts` - Update housing items with upkeep values

---

### 1.5 Business Profit/Loss Calculations

**Status:** NOT IMPLEMENTED

#### Current Implementation
- Business items generate flat revenue via `revenueMin`/`revenueMax`
- No operating costs
- No random loss events
- No P&L simulation

#### Corrected Specification
1. Operating costs per business
2. Random events (robbery, fire, regulation, etc.)
3. Net profit calculation: `revenue - operatingCosts - randomEvents`

#### Missing Components
- [ ] `operatingCost` field on business items
- [ ] Random loss event system
- [ ] Net profit calculation in revenue service
- [ ] Business health/condition tracking

---

## Part 2: Achievements System Evaluation

### 2.1 Achievement Quantity & Structure Analysis

#### Current State: 59 achievements

| Category | Count | Tiered | One-Off |
|----------|-------|--------|---------|
| wealth | 8 | 8 (progression) | 0 |
| combat | 9 | 7 (wins/defenses) | 2 (streaks) |
| loyalty | 6 | 6 (streaks) | 0 |
| progression | 6 | 6 (level) | 0 |
| activity | 5 | 5 (play count) | 0 |
| social | 4 | 4 (messages) | 0 |
| special | 3 | 0 | 3 (hidden) |
| juicernaut | 7 | 4 (wins) | 3 (contribution) |
| gambling | 11 | 6 (wins/totals) | 5 (specific games) |
| **TOTAL** | **59** | ~46 | ~13 |

#### Target: 100-150 achievements minimum

#### Gap Analysis
- **Current:** 59 achievements
- **Target:** 100-150 achievements
- **Missing:** 41-91 achievements (41%-61% deficit)

#### Coverage Gaps

| Category | Current Coverage | Missing Coverage |
|----------|------------------|------------------|
| Rob System | Basic wins (9) | Defense streaks, stolen amounts, unique victims |
| Gambling | Good (11) | Per-game mastery tiers, total lost, comeback achievements |
| Social | Basic messages (4) | Crew achievements, rivalries, faction participation |
| Collection | None | Items owned, rarities collected, complete sets |
| Time-based | Loyalty only | Account age, seasonal, event participation |
| Economy | Wealth only | Spending, trading, market activity |
| Skill-based | Streaks only | Perfect heists, consecutive wins by game |

---

### 2.2 Achievement Reward Balance

#### Current Reward Scaling

| Tier | Wealth Range | XP Range | Title |
|------|--------------|----------|-------|
| Bronze | 500-2,500 | 50-200 | No |
| Silver | 3,000-15,000 | 200-750 | No |
| Gold | 7,500-50,000 | 300-2,500 | Rare |
| Platinum | 25,000-200,000 | 1,000-10,000 | Common |
| Legendary | 200,000-500,000 | 10,000-25,000 | Always |

**Assessment:** Reward scaling is reasonable but could be more generous for difficult achievements.

---

## Part 3: Remediation Action Plan

### Priority Levels
- **CRITICAL** - Must complete before launch
- **HIGH** - Should complete before launch
- **MEDIUM** - Can be post-launch but recommended before

---

### CRITICAL Priority

#### C1: Generate 419+ New Items

**Complexity:** Complex
**Files:** `web/prisma/seed.ts`, potentially item generation scripts

**Steps:**
1. Create item generation framework (naming conventions, stat formulas)
2. Generate 40 common weapons, 40 uncommon, 20 rare, 10 legendary
3. Generate 40 common armor, 40 uncommon, 20 rare, 10 legendary
4. Generate 40 common businesses, 40 uncommon, 20 rare, 10 legendary
5. Generate 40 common housing, 40 uncommon, 20 rare, 10 legendary
6. Update `seed.ts` with new items
7. Run `npx prisma db seed` to re-seed database

---

#### C2: Implement Business Revenue Collection

**Complexity:** Moderate
**Dependencies:** None

**Steps:**
1. Add `dailyRevenuePotential` field to Item schema:
   ```prisma
   dailyRevenuePotential Int? @map("daily_revenue_potential")
   ```
2. Create migration: `npx prisma migrate dev --name add_daily_revenue`
3. Update business items in seed with `dailyRevenuePotential` values:
   - Common: $2,000-5,000/day
   - Uncommon: $6,000-15,000/day
   - Rare: $18,000-35,000/day
   - Legendary: $40,000-80,000/day
4. Create `web/src/lib/services/business.service.ts`:
   - `collectRevenue(userId)` - Collect revenue for all equipped businesses
   - `calculateRevenue(business)` - `dailyRevenuePotential / 8` with ±20% variance
5. Create `/api/cron/business-revenue/route.ts` (runs every 3 hours)
6. Add to Vercel cron config: `0 */3 * * *`

---

### HIGH Priority

#### H1: Implement Business Ownership Limits

**Complexity:** Simple
**Dependencies:** None

**Steps:**
1. Add constant to `constants.ts`:
   ```typescript
   export const MAX_BUSINESSES_OWNED = 3
   ```
2. Add business count check in `inventory.service.ts`:
   ```typescript
   async getBusinessCount(userId: number): Promise<number> {
     return prisma.userInventory.count({
       where: { userId, item: { itemType: 'business' } }
     })
   }
   ```
3. Add validation in `shop.service.ts` `purchaseItem()`:
   - Check business count before allowing purchase
   - Return error: "You can only own 3 businesses"

---

#### H2: Implement Housing Upkeep System

**Complexity:** Moderate
**Dependencies:** None

**Steps:**
1. Add `upkeepCost` field to Item schema:
   ```prisma
   upkeepCost Int? @map("upkeep_cost")
   ```
2. Create migration
3. Update housing items with upkeep values:
   - Common: $100/day
   - Uncommon: $300/day
   - Rare: $800/day
   - Legendary: $2,000/day
4. Create `web/src/lib/services/housing.service.ts`:
   - `deductUpkeep(userId)` - Deduct upkeep for equipped housing
   - `checkUpkeepStatus(userId)` - Return days overdue
   - `applyPenalty(userId)` - Stat debuff or eviction
5. Add upkeep job to `/api/cron/daily/route.ts`
6. Add `upkeepDebtDays` field to User model for tracking

---

#### H3: Expand Achievement System (50+ new)

**Complexity:** Moderate
**Dependencies:** Achievement service already implemented

**Steps:**
1. Design achievements using framework in Part 4
2. Add to `seed.ts`:
   - 15 rob system achievements
   - 10 gambling mastery achievements
   - 10 collection achievements
   - 8 social/crew achievements
   - 7 time-based achievements
3. Run `npx prisma db seed`

---

### MEDIUM Priority

#### M1: Implement Business P&L System

**Complexity:** Complex
**Dependencies:** C2 (Business Revenue)

**Steps:**
1. Add `operatingCost` field to Item schema
2. Create business event types enum
3. Implement random event occurrence (5% chance per revenue cycle)
4. Calculate net profit with costs and events
5. Create business history tracking table

---

## Part 4: Item Generation Framework

### Naming Convention Templates

#### Weapons by Tier

| Tier | Pattern | Examples |
|------|---------|----------|
| Common | [Adjective] + [Basic Weapon] | Rusty Knife, Bent Pipe, Cracked Bat |
| Uncommon | [Material] + [Weapon Type] | Steel Switchblade, Chrome Revolver |
| Rare | [Maker/Style] + [Weapon] | Yakuza Katana, Cartel Machete |
| Legendary | [Title] + [Iconic Name] | "The Widowmaker", "Kingpin's Verdict" |

#### Armor by Tier

| Tier | Pattern | Examples |
|------|---------|----------|
| Common | [Worn] + [Basic Clothing] | Tattered Jacket, Scuffed Boots |
| Uncommon | [Style] + [Protective Gear] | Leather Vest, Steel-toe Boots |
| Rare | [Material] + [Armor Type] | Kevlar Vest, Ballistic Coat |
| Legendary | [Custom] + [Elite Armor] | "Shadow's Embrace", "The Untouchable" |

#### Businesses by Tier

| Tier | Pattern | Examples |
|------|---------|----------|
| Common | [Small] + [Street Business] | Corner Store, Food Cart, Newsstand |
| Uncommon | [Medium] + [Local Business] | Auto Shop, Bar & Grill, Laundromat |
| Rare | [Large] + [Profitable Business] | Nightclub, Casino, Import/Export |
| Legendary | [Empire] + [Industry] | Hotel Chain, Media Conglomerate |

#### Housing by Tier

| Tier | Pattern | Examples |
|------|---------|----------|
| Common | [Basic] + [Dwelling] | Studio Apartment, Basement Room |
| Uncommon | [Decent] + [Housing] | Downtown Loft, Suburban House |
| Rare | [Premium] + [Property] | Harbor Penthouse, Gated Mansion |
| Legendary | [Elite] + [Estate] | Private Island, Fortress Compound |

### Stat Scaling Formulas

#### Weapons (robBonus)
```
Common:     +5% to +10%
Uncommon:   +12% to +18%
Rare:       +20% to +28%
Legendary:  +30% to +40%
```

#### Armor (defenseBonus)
```
Common:     +5% to +10%
Uncommon:   +12% to +18%
Rare:       +20% to +28%
Legendary:  +30% to +40%
```

#### Businesses (dailyRevenuePotential)
```
Common:     $2,000 - $5,000/day
Uncommon:   $6,000 - $15,000/day
Rare:       $18,000 - $35,000/day
Legendary:  $40,000 - $80,000/day
```

#### Housing (insurancePercent + upkeepCost)
```
Common:     5-10% insurance, $100/day upkeep
Uncommon:   12-18% insurance, $300/day upkeep
Rare:       20-28% insurance, $800/day upkeep
Legendary:  30-40% insurance, $2,000/day upkeep
```

---

## Part 5: Achievement Expansion Framework

### Proposed New Achievements (50 total)

#### Rob System Achievements (15 new)

| Key | Name | Description | Tier | Requirement |
|-----|------|-------------|------|-------------|
| rob_first_victim | First Victim | Rob your first player | Bronze | rob_wins = 1 |
| rob_serial_robber | Serial Robber | Rob 100 unique players | Silver | unique_rob_victims = 100 |
| rob_neighborhood_watch | Neighborhood Watch | Defend 10 times in one day | Silver | daily_defenses = 10 |
| rob_untouchable_streak | Untouchable Streak | Defend 20 consecutive attacks | Gold | defense_streak = 20 |
| rob_million_stolen | Million Dollar Heist | Steal $1,000,000 total | Gold | total_stolen = 1000000 |
| rob_kingpin_hunter | Kingpin Hunter | Successfully rob a Kingpin tier player | Platinum | rob_kingpin = 1 |
| rob_revenge | Sweet Revenge | Rob someone who robbed you within 1 hour | Silver | revenge_robs = 1 |
| rob_comeback | Comeback Kid | Win a robbery after losing 3 in a row | Bronze | comeback_wins = 1 |
| rob_territory_defender | Territory Defender | Defend 500 total attacks | Platinum | total_defenses = 500 |
| rob_wealthy_target | Big Score | Steal $50,000 in a single robbery | Gold | single_rob_max = 50000 |
| rob_persistent | Persistent | Attempt 1,000 robberies | Silver | rob_attempts = 1000 |
| rob_feared | Feared | Have 10 players fail to rob you in a day | Gold | daily_failed_attacks = 10 |
| rob_duo | Repeat Offender | Rob same target 5 times successfully | Bronze | repeat_victim_robs = 5 |
| rob_equalizer | The Equalizer | Rob someone 20+ levels above you | Gold | uphill_robs = 1 |
| rob_perfect_week | Perfect Week | 7-day robbery win streak | Legendary | rob_win_streak = 7 |

#### Gambling Mastery Achievements (10 new)

| Key | Name | Description | Tier | Requirement |
|-----|------|-------------|------|-------------|
| gambling_slot_marathon | Slot Marathon | Play 1,000 slot spins | Silver | slot_spins = 1000 |
| gambling_blackjack_natural | Natural | Get 5 natural blackjacks | Silver | natural_blackjacks = 5 |
| gambling_coinflip_streak | Flip Streak | Win 7 coinflips in a row | Gold | coinflip_streak = 7 |
| gambling_high_stakes | High Stakes | Wager $1,000,000 total | Gold | total_wagered = 1000000 |
| gambling_comeback_king | Comeback King | Win back $100,000 after losses | Platinum | comeback_amount = 100000 |
| gambling_lottery_regular | Lottery Regular | Buy 100 lottery tickets | Silver | lottery_tickets = 100 |
| gambling_jackpot_hunter | Jackpot Hunter | Hit 3 slot jackpots | Platinum | jackpots_hit = 3 |
| gambling_blackjack_ace | Blackjack Ace | Win 100 blackjack hands | Gold | blackjack_wins = 100 |
| gambling_all_games | All-Rounder | Win at least once in every gambling game | Silver | games_won = 4 |
| gambling_daily_gambler | Daily Gambler | Gamble every day for 30 days | Gold | gambling_streak = 30 |

#### Collection Achievements (10 new)

| Key | Name | Description | Tier | Requirement |
|-----|------|-------------|------|-------------|
| collection_first_item | First Acquisition | Own your first item | Bronze | items_owned = 1 |
| collection_full_set | Full Set | Own one of each equipment type | Silver | equipment_types = 4 |
| collection_rare_hunter | Rare Hunter | Own 5 rare items | Gold | rare_items = 5 |
| collection_legendary_first | Legendary Find | Own your first legendary item | Silver | legendary_items = 1 |
| collection_legendary_collector | Legendary Collector | Own 10 legendary items | Platinum | legendary_items = 10 |
| collection_arsenal | Arsenal | Own 20 weapons | Silver | weapons_owned = 20 |
| collection_fashionista | Fashionista | Own 20 armor pieces | Silver | armor_owned = 20 |
| collection_tycoon | Business Tycoon | Own 10 businesses | Gold | businesses_owned = 10 |
| collection_real_estate | Real Estate Mogul | Own 10 housing properties | Gold | housing_owned = 10 |
| collection_completionist | Completionist | Own 100 total items | Legendary | items_owned = 100 |

#### Social/Crew Achievements (8 new)

| Key | Name | Description | Tier | Requirement |
|-----|------|-------------|------|-------------|
| social_crew_joined | Made Man | Join your first faction | Bronze | faction_joined = 1 |
| social_crew_contributor | Contributor | Contribute $100,000 to faction | Silver | faction_contribution = 100000 |
| social_crew_veteran | Veteran | Stay in same faction for 30 days | Silver | faction_tenure = 30 |
| social_crew_leader | Boss | Become a faction leader | Gold | faction_leader = 1 |
| social_territory_capture | Territory Claimed | Help capture a territory | Silver | territories_captured = 1 |
| social_heist_team | Heist Crew | Win 10 heist alerts | Gold | heist_wins = 10 |
| social_rival | Rivalry | Rob same player 10 times | Bronze | rival_robs = 10 |
| social_networker | Networker | Be in a faction with 20+ members | Silver | faction_size = 20 |

#### Time-based Achievements (7 new)

| Key | Name | Description | Tier | Requirement |
|-----|------|-------------|------|-------------|
| time_week_one | Week One | Play for 7 days | Bronze | account_age = 7 |
| time_month_one | Month One | Play for 30 days | Silver | account_age = 30 |
| time_quarter | Quarter Year | Play for 90 days | Gold | account_age = 90 |
| time_veteran | Veteran | Play for 180 days | Platinum | account_age = 180 |
| time_og | OG | Play for 365 days | Legendary | account_age = 365 |
| time_night_owl | Night Owl | Play between 2-4 AM 10 times | Bronze | night_plays = 10 |
| time_consistent | Consistent | Log in 50 different days | Silver | unique_login_days = 50 |

---

## Summary

### Total New Components Required

| Category | Count |
|----------|-------|
| New Items | 419 |
| New Achievements | 50 |
| New Services | 2 (business, housing) |
| New Cron Jobs | 1 (business-revenue) |
| Schema Migrations | 3 |
| New Constants | 3+ |

### Implementation Order

1. **Schema migrations** (dailyRevenuePotential, upkeepCost, operatingCost)
2. **Generate 419 items** (most time-intensive)
3. **Business revenue service + cron**
4. **Business ownership limits** (quick win)
5. **Housing upkeep system**
6. **Generate 50 achievements**
7. **Business P&L system** (if time permits)

### Success Criteria

- [ ] 440+ items in database
- [ ] Business revenue collecting every 3 hours
- [ ] Business ownership capped at 3
- [ ] Housing upkeep deducting daily
- [ ] 100+ achievements in database
- [ ] All new systems have appropriate UI feedback
