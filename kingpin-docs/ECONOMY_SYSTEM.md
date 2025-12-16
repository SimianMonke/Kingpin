# ECONOMY SYSTEM (Play) - Implementation Documentation

## Overview

The Economy System handles the core wealth and XP generation through the `!play` command (channel point redemption). Players can earn rewards, potentially get busted and jailed, and have a chance to receive loot crates.

**Current Implementation Status:** Complete

---

## Database Schema

### Primary Table: `game_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Event ID |
| `user_id` | INT (FK) | User who triggered event |
| `event_type` | VARCHAR(50) | Type of event (play, rob, checkin, etc.) |
| `wealth_change` | BIGINT | Amount of wealth gained/lost |
| `xp_change` | INT | Amount of XP gained |
| `target_user_id` | INT (FK) | Target user (if applicable) |
| `tier` | VARCHAR(50) | Event tier level |
| `event_description` | VARCHAR | Description of event outcome |
| `success` | BOOLEAN | Whether action succeeded |
| `was_busted` | BOOLEAN | Whether user got busted |
| `created_at` | TIMESTAMP | Event timestamp |

### Related Tables
- `users.wealth` - User's current wealth balance
- `users.xp` - User's total experience points
- `users.total_play_count` - Total number of plays
- `cooldowns` - Play cooldowns (per channel point redemption)

---

## Core Logic & Formulas

### Tier-Based Play Events

Each tier has **50 play events** divided into:
- **45 Positive Events** (gain wealth/XP)
- **5 Negative Events** (lose wealth, still gain XP)

**Event Categories by Tier:**

| Tier | Categories |
|------|------------|
| Rookie | Petty Crime, Street Hustles, Scavenging, Information, Survival |
| Associate | Protection, Drugs, Vehicles, Gambling, Blackmail |
| Soldier | Heists, Convoys, Enforcement, Data, Smuggling |
| Captain | Banks, Kidnapping, Arms, Territory, Cyber |
| Underboss | Corporate, Political, Syndicate, Markets, Intelligence |
| Kingpin | Acquisitions, Government, Manipulation, Power, Ascension |

### Wealth/XP Ranges by Tier

```typescript
// Example ranges from TIER_PLAY_EVENTS
const WEALTH_RANGES = {
  Rookie: { min: 50, max: 500 },       // $50 - $500
  Associate: { min: 500, max: 2000 },  // $500 - $2,000
  Soldier: { min: 2000, max: 6000 },   // $2,000 - $6,000
  Captain: { min: 6000, max: 16000 },  // $6,000 - $16,000
  Underboss: { min: 15000, max: 40000 }, // $15,000 - $40,000
  Kingpin: { min: 40000, max: 100000 }, // $40,000 - $100,000
}
```

### Play Event Selection

```typescript
function selectTierEvent(tier: Tier): PlayEventDef {
  const events = TIER_PLAY_EVENTS[tier]

  // 15% chance of negative event
  if (Math.random() < PLAY_CONFIG.NEGATIVE_EVENT_CHANCE) {
    const negativeEvents = events.filter(e => e.isNegative)
    return negativeEvents[Math.floor(Math.random() * negativeEvents.length)]
  }

  // Select random positive event
  const positiveEvents = events.filter(e => !e.isNegative)
  return positiveEvents[Math.floor(Math.random() * positiveEvents.length)]
}
```

### Bust/Jail Mechanics

```typescript
const JAIL_CONFIG = {
  BUST_CHANCE: 0.05,        // 5% chance per play
  DURATION_MINUTES: 60,     // 1 hour jail sentence
  BAIL_COST_PERCENT: 0.10,  // 10% of total wealth
  MIN_BAIL: 100,            // Minimum $100 bail
}

// Bust check happens BEFORE event selection
function checkBust(): boolean {
  return Math.random() < JAIL_CONFIG.BUST_CHANCE
}

// Bail cost calculation
function calculateBailCost(wealth: bigint): number {
  return Math.max(JAIL_CONFIG.MIN_BAIL, Math.floor(Number(wealth) * JAIL_CONFIG.BAIL_COST_PERCENT))
}
```

### Crate Drop System

```typescript
const PLAY_CRATE_DROP_CHANCE = 0.02  // 2% base chance
const JUICERNAUT_CRATE_MULTIPLIER = 3.0  // Juicernaut gets 6% chance

// Crate tier weights by player tier
const PLAY_CRATE_TIER_WEIGHTS = {
  Rookie: { common: 0.80, uncommon: 0.18, rare: 0.02, legendary: 0 },
  Associate: { common: 0.70, uncommon: 0.25, rare: 0.05, legendary: 0 },
  Soldier: { common: 0.55, uncommon: 0.35, rare: 0.09, legendary: 0.01 },
  Captain: { common: 0.40, uncommon: 0.40, rare: 0.17, legendary: 0.03 },
  Underboss: { common: 0.25, uncommon: 0.40, rare: 0.28, legendary: 0.07 },
  Kingpin: { common: 0.15, uncommon: 0.35, rare: 0.35, legendary: 0.15 },
}
```

### Juicernaut Buffs Applied to Play

```typescript
const JUICERNAUT_BUFFS = {
  XP_MULTIPLIER: 2.0,       // 2x XP
  LOOT_MULTIPLIER: 3.0,     // 3x crate drop chance (2% -> 6%)
  WEALTH_MULTIPLIER: 1.25,  // 25% bonus wealth (NOT 2x as previously documented)
}
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/play.service.ts`

### Public Methods

```typescript
export const PlayService = {
  /**
   * Execute a play action for a user
   * @param userId - User ID
   * @returns PlayResult with wealth, XP, crate, bust status
   */
  async executePlay(userId: number): Promise<PlayResult>

  /**
   * Check if user is on play cooldown
   * @param userId - User ID
   * @returns true if on cooldown
   */
  async isOnCooldown(userId: number): Promise<boolean>

  /**
   * Get remaining cooldown time
   * @param userId - User ID
   * @returns Cooldown end time or null
   */
  async getCooldownEnd(userId: number): Promise<Date | null>
}
```

### Play Execution Flow

```typescript
async function executePlay(userId: number): Promise<PlayResult> {
  // 1. Get user data
  const user = await UserService.findById(userId)

  // 2. Check if in jail
  const jailStatus = await JailService.checkJailStatus(userId)
  if (jailStatus.isJailed) {
    throw new Error(`In jail. Release in ${jailStatus.remainingMinutes} minutes.`)
  }

  // 3. Check Juicernaut status
  const isJuicernaut = await JuicernautService.isCurrentJuicernaut(userId)

  // 4. Check for bust (5% chance)
  const wasBusted = Math.random() < JAIL_CONFIG.BUST_CHANCE
  if (wasBusted) {
    await JailService.jailUser(userId, JAIL_CONFIG.DURATION_MINUTES)
    return { wasBusted: true, wealth: 0, xp: 0, ... }
  }

  // 5. Select tier-based event
  const tier = user.status_tier as Tier
  const event = selectTierEvent(tier)

  // 6. Calculate rewards with tier multiplier
  const tierMultiplier = TIER_MULTIPLIERS[tier]
  let wealth = randomInRange(event.wealth.min, event.wealth.max) * tierMultiplier
  let xp = randomInRange(event.xp.min, event.xp.max) * tierMultiplier

  // 7. Apply Juicernaut bonuses
  if (isJuicernaut) {
    wealth *= JUICERNAUT_BUFFS.WEALTH_MULTIPLIER  // 1.25x
    xp *= JUICERNAUT_BUFFS.XP_MULTIPLIER          // 2x
  }

  // 8. Check for crate drop
  let crateDropped = false
  let crateTier = null
  const dropChance = isJuicernaut
    ? PLAY_CRATE_DROP_CHANCE * JUICERNAUT_BUFFS.LOOT_MULTIPLIER
    : PLAY_CRATE_DROP_CHANCE

  if (Math.random() < dropChance) {
    crateDropped = true
    crateTier = rollCrateTier(tier)
    await CrateService.awardCrate(userId, crateTier, 'play')
  }

  // 9. Update user wealth/XP
  await UserService.addWealth(userId, wealth)
  const xpResult = await UserService.addXp(userId, xp)

  // 10. Update leaderboard snapshots
  await LeaderboardService.updateSnapshot(userId, {
    wealth_earned: wealth,
    xp_earned: xp,
    play_count: 1,
  })

  // 11. Update mission progress
  await MissionService.updateProgress(userId, 'play_count', 1)
  await MissionService.updateProgress(userId, 'wealth_earned', wealth)

  // 12. Update achievements
  await AchievementService.incrementProgress(userId, 'play_count', 1)
  await AchievementService.incrementProgress(userId, 'total_wealth_earned', wealth)

  // 13. Add territory score for faction
  await FactionService.addTerritoryScore(userId, 'play')  // 10 points

  // 14. Record event
  await prisma.game_events.create({
    data: {
      user_id: userId,
      event_type: 'play',
      wealth_change: wealth,
      xp_change: xp,
      tier: event.name,
      event_description: event.description,
      success: wealth >= 0,
      was_busted: false,
    }
  })

  return {
    event_type: event.name,
    event_description: event.description,
    wealth,
    xp,
    levelUp: xpResult.levelUp,
    newLevel: xpResult.newLevel,
    tierPromotion: xpResult.tierPromotion,
    newTier: xpResult.newTier,
    crateDropped,
    crateTier,
    wasBusted: false,
  }
}
```

---

## API Endpoints

### POST /api/play
Execute a play action.

**Request:** No body required (authenticated)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "event_type": "Warehouse Heist",
    "event_description": "Hit a poorly guarded supply depot.",
    "tier": 3,
    "wealth": 2500,
    "xp": 180,
    "levelUp": false,
    "tierPromotion": false,
    "crateDropped": true,
    "crate_tier": "uncommon",
    "was_busted": false
  }
}
```

**Response (Busted):**
```json
{
  "success": true,
  "data": {
    "was_busted": true,
    "jailUntil": "2024-01-15T16:30:00Z",
    "wealth": 0,
    "xp": 0
  }
}
```

**Response (In Jail):**
```json
{
  "success": false,
  "error": "You are in jail! Release in 45 minutes. Use bail to escape."
}
```

---

## System Interdependencies

### Depends On
- **User System:** Wealth/XP modification, tier lookup
- **Jail System:** Bust/jail mechanics, bail
- **Juicernaut System:** Buff status checking
- **Crate System:** Crate awarding
- **Leaderboard System:** Snapshot updates
- **Mission System:** Progress tracking
- **Achievement System:** Progress tracking
- **Faction System:** Territory scoring

### Depended On By
- **Mission System:** Play count objectives
- **Achievement System:** Play count achievements
- **Leaderboard System:** Play rankings

### Data Flow

```
Channel Point Redemption / !play
            |
            v
+--------------------+
| PlayService        |
| - executePlay()    |
+--------------------+
     |         |
     v         v
+---------+ +-----------+
| Jail    | | Event     |
| Check   | | Selection |
+---------+ +-----------+
     |         |
     v         v
+--------+ +--------------+
| Bust?  | | Rewards      |
+--------+ | Calculation  |
     |     +--------------+
     v         |
+--------+     v
| Jail   | +-------------+
| User   | | Crate Check |
+--------+ +-------------+
               |
               v
         +----------+
         | Update   |
         | Systems  |
         +----------+
```

---

## Configuration & Constants

**File:** `web/src/lib/game/constants.ts`

```typescript
// Play configuration
export const PLAY_CONFIG = {
  NEGATIVE_EVENT_CHANCE: 0.15,  // 15% chance of negative outcome
  MIN_EVENTS_PER_TIER: 10,      // Minimum positive events per tier
}

// Crate drop chance
export const PLAY_CRATE_DROP_CHANCE = 0.02  // 2% base
export const JUICERNAUT_CRATE_MULTIPLIER = 3.0  // 3x for Juicernaut

// Jail configuration
export const JAIL_CONFIG = {
  BUST_CHANCE: 0.05,          // 5% chance
  DURATION_MINUTES: 60,       // 1 hour sentence
  BAIL_COST_PERCENT: 0.10,    // 10% of wealth
  MIN_BAIL: 100,              // Minimum $100
}

// Tier multipliers (applied to all rewards)
export const TIER_MULTIPLIERS = {
  Rookie: 1.0,
  Associate: 1.1,
  Soldier: 1.2,
  Captain: 1.3,
  Underboss: 1.4,
  Kingpin: 1.5,
}
```

---

## Known Limitations & TODOs

### Completed Features
- Tier-based event system (50 events per tier)
- Negative event outcomes (15% chance)
- Bust/jail mechanics (5% bust chance)
- Crate drops with tier-based weights
- Juicernaut buff integration
- Leaderboard/Mission/Achievement integration
- Faction territory scoring

### Technical Notes
- **IMPORTANT:** Durability does NOT decay during play - only during robbery
- Negative events always give positive XP (participation reward)
- Juicernaut wealth multiplier is 1.25x (not 2x)
- Channel point redemption is the primary trigger (not chat command)

### Deviation from Original Spec
- Phase 12 expansion: 50 events per tier (original spec had fewer)
- Negative event system added (CRIT-07 fix)

---

**File Location:** `web/src/lib/services/play.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (TIER_PLAY_EVENTS)
- `web/src/lib/game/formulas.ts` (reward calculations)
- `web/src/app/api/play/route.ts` (API endpoint)
- `web/src/lib/services/jail.service.ts` (bust/jail)
