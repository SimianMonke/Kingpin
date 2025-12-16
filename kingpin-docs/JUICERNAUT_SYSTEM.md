# JUICERNAUT SYSTEM - Implementation Documentation

## Overview

The Juicernaut System tracks streamer supporter contributions (subs, bits, donations) during live sessions. The top contributor becomes the "Juicernaut" and receives powerful buffs until dethroned.

**Current Implementation Status:** Complete

---

## Database Schema

### Streaming Sessions: `streaming_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Session ID |
| `is_active` | BOOLEAN | Whether session is live |
| `started_at` | TIMESTAMP | Session start time |
| `ended_at` | TIMESTAMP | Session end time |
| `total_contributions_usd` | DECIMAL(10,2) | Total USD contributed |
| `current_juicernaut_id` | INT (FK) | Current crown holder |
| `created_at` | TIMESTAMP | Creation time |

### Session Contributions: `session_contributions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Contribution ID |
| `session_id` | INT (FK) | Session ID |
| `user_id` | INT (FK) | Contributor ID |
| `contribution_type` | VARCHAR(50) | Type (sub, bits, donation) |
| `amount_usd` | DECIMAL(10,2) | USD value |
| `platform` | VARCHAR(20) | Platform (kick, twitch, stripe) |
| `raw_data` | JSONB | Original webhook data |
| `created_at` | TIMESTAMP | Contribution time |

### Active Buffs: `active_buffs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Buff ID |
| `user_id` | INT (FK) | User with buff |
| `buff_type` | VARCHAR(50) | Buff type |
| `multiplier` | DECIMAL(5,2) | Buff multiplier |
| `is_active` | BOOLEAN | Whether currently active |
| `expires_at` | TIMESTAMP | When buff expires (null = until dethroned) |
| `source` | VARCHAR(50) | Source (juicernaut, territory, etc.) |
| `created_at` | TIMESTAMP | When buff was granted |

---

## Juicernaut Buffs

```typescript
const JUICERNAUT_BUFFS = {
  XP_MULTIPLIER: 2.0,         // 2x XP from all sources
  LOOT_MULTIPLIER: 3.0,       // 3x crate drop chance
  ROB_IMMUNITY: true,         // Cannot be robbed
  BUSINESS_MULTIPLIER: 1.5,   // 50% bonus business revenue
  WEALTH_MULTIPLIER: 1.25,    // 25% bonus wealth from play
}

const JUICERNAUT_BUFF_TYPES = {
  XP: 'juicernaut_xp',
  LOOT: 'juicernaut_loot',
  IMMUNITY: 'juicernaut_immunity',
  BUSINESS: 'juicernaut_business',
  WEALTH: 'juicernaut_wealth',
}
```

---

## Contribution USD Values

```typescript
const CONTRIBUTION_USD_VALUES = {
  // Kick
  KICK_SUB_T1: 5.00,
  KICK_SUB_T2: 10.00,
  KICK_SUB_T3: 25.00,
  KICK_GIFT_SUB: 5.00,
  KICK_KICK: 0.01,        // Per kick

  // Twitch
  TWITCH_SUB_T1: 5.00,
  TWITCH_SUB_T2: 10.00,
  TWITCH_SUB_T3: 25.00,
  TWITCH_GIFT_SUB: 5.00,
  TWITCH_BITS: 0.01,      // Per bit
  TWITCH_RAID: 0.10,      // Per viewer

  // Stripe
  STRIPE_DONATION: 1.00,  // Per dollar
}
```

---

## Session Reward Tiers

```typescript
const JUICERNAUT_SESSION_REWARDS = {
  TIERS: [
    { minUsd: 0, maxUsd: 4.99, wealth: 1000, xp: 200, crate: null },
    { minUsd: 5, maxUsd: 14.99, wealth: 3000, xp: 500, crate: 'common' },
    { minUsd: 15, maxUsd: 29.99, wealth: 7500, xp: 1000, crate: 'uncommon' },
    { minUsd: 30, maxUsd: 49.99, wealth: 15000, xp: 2000, crate: 'rare' },
    { minUsd: 50, maxUsd: Infinity, wealth: 30000, xp: 4000, crate: 'legendary' },
  ],
}
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/juicernaut.service.ts`

### Public Methods

```typescript
export const JuicernautService = {
  /**
   * Get current active session
   */
  async getActiveSession(): Promise<JuicernautSession | null>

  /**
   * Start a new streaming session
   */
  async startSession(): Promise<JuicernautSession>

  /**
   * End current session and distribute rewards
   */
  async endSession(): Promise<SessionEndResult>

  /**
   * Record a contribution
   */
  async recordContribution(
    userId: number,
    type: ContributionType,
    amountUsd: number,
    platform: Platform,
    rawData?: object
  ): Promise<ContributionResult>

  /**
   * Get session leaderboard
   */
  async getSessionLeaderboard(sessionId: number): Promise<ContributorEntry[]>

  /**
   * Check if user is current Juicernaut
   */
  async isCurrentJuicernaut(userId: number): Promise<boolean>

  /**
   * Get current Juicernaut info
   */
  async getCurrentJuicernaut(): Promise<JuicernautInfo | null>

  /**
   * Grant Juicernaut buffs to user
   */
  async grantJuicernautBuffs(userId: number): Promise<void>

  /**
   * Remove Juicernaut buffs from user
   */
  async removeJuicernautBuffs(userId: number): Promise<void>
}
```

### Record Contribution Flow

```typescript
async function recordContribution(
  userId: number,
  type: ContributionType,
  amountUsd: number,
  platform: Platform,
  rawData?: object
): Promise<ContributionResult> {
  const session = await getActiveSession()
  if (!session) {
    throw new Error('No active streaming session')
  }

  // Record contribution
  await prisma.session_contributions.create({
    data: {
      session_id: session.id,
      user_id: userId,
      contribution_type: type,
      amount_usd: amountUsd,
      platform,
      raw_data: rawData,
    },
  })

  // Update session total
  await prisma.streaming_sessions.update({
    where: { id: session.id },
    data: {
      total_contributions_usd: { increment: amountUsd },
    },
  })

  // Update leaderboard snapshot
  await LeaderboardService.updateSnapshot(userId, {
    total_contributed_usd: amountUsd,
  })

  // Check for crown change
  const newLeader = await checkForCrownChange(session.id, userId)

  return {
    recorded: true,
    amountUsd,
    crownChange: newLeader !== null,
    newJuicernaut: newLeader,
  }
}
```

### Crown Change Logic

```typescript
async function checkForCrownChange(
  sessionId: number,
  contributorId: number
): Promise<number | null> {
  // Get current session leader
  const leaderboard = await getSessionLeaderboard(sessionId)
  const newLeader = leaderboard[0]

  const session = await prisma.streaming_sessions.findUnique({
    where: { id: sessionId },
  })

  // Check if leader changed
  if (newLeader && newLeader.user_id !== session.current_juicernaut_id) {
    // Remove buffs from old Juicernaut
    if (session.current_juicernaut_id) {
      await removeJuicernautBuffs(session.current_juicernaut_id)

      // Notify dethroned user
      await NotificationService.create(session.current_juicernaut_id, 'juicernaut_dethroned', {
        message: `${newLeader.username} has taken the Juicernaut crown!`,
      })
    }

    // Grant buffs to new Juicernaut
    await grantJuicernautBuffs(newLeader.user_id)

    // Update session
    await prisma.streaming_sessions.update({
      where: { id: sessionId },
      data: { current_juicernaut_id: newLeader.user_id },
    })

    // Notify new Juicernaut
    await NotificationService.create(newLeader.user_id, 'juicernaut_crown', {
      message: 'You are now the Juicernaut! Enjoy your buffs!',
    })

    // Post to Discord
    await DiscordService.postJuicernautCrown(newLeader.user_id, newLeader.totalUsd)

    // Trigger Lumia lights effect
    await LumiaService.triggerJuicernautCrown(newLeader.username)

    return newLeader.user_id
  }

  return null
}
```

### Session End Rewards

```typescript
async function endSession(): Promise<SessionEndResult> {
  const session = await getActiveSession()
  if (!session) {
    throw new Error('No active session')
  }

  // Get all contributors
  const contributions = await prisma.session_contributions.groupBy({
    by: ['user_id'],
    where: { session_id: session.id },
    _sum: { amount_usd: true },
  })

  // Distribute rewards based on contribution tiers
  for (const contrib of contributions) {
    const totalUsd = Number(contrib._sum.amount_usd)
    const tier = JUICERNAUT_SESSION_REWARDS.TIERS.find(
      t => totalUsd >= t.minUsd && totalUsd <= t.maxUsd
    )

    if (tier) {
      await UserService.addWealth(contrib.user_id, tier.wealth)
      await UserService.addXp(contrib.user_id, tier.xp)

      if (tier.crate) {
        await CrateService.awardCrate(contrib.user_id, tier.crate, 'juicernaut')
      }

      await NotificationService.create(contrib.user_id, 'juicernaut_reward', {
        message: `Session rewards: $${tier.wealth.toLocaleString()}, ${tier.xp} XP${tier.crate ? `, ${tier.crate} crate` : ''}`,
      })
    }

    // Update achievement progress
    await AchievementService.incrementProgress(
      contrib.user_id,
      'juicernaut_contribution',
      Math.floor(totalUsd)
    )
  }

  // Remove Juicernaut buffs
  if (session.current_juicernaut_id) {
    await removeJuicernautBuffs(session.current_juicernaut_id)

    // Update Juicernaut wins achievement
    await AchievementService.incrementProgress(
      session.current_juicernaut_id,
      'juicernaut_wins',
      1
    )
  }

  // Mark session ended
  await prisma.streaming_sessions.update({
    where: { id: session.id },
    data: {
      is_active: false,
      ended_at: new Date(),
    },
  })

  return {
    contributorCount: contributions.length,
    totalUsd: Number(session.total_contributions_usd),
    finalJuicernaut: session.current_juicernaut_id,
  }
}
```

---

## API Endpoints

### GET /api/juicernaut
Get current Juicernaut session status.

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": 42,
      "is_active": true,
      "started_at": "2024-01-15T20:00:00Z",
      "total_contributions_usd": 156.50
    },
    "currentJuicernaut": {
      "user_id": 123,
      "username": "TopSupporter",
      "totalUsd": 45.00
    },
    "leaderboard": [
      { "user_id": 123, "username": "TopSupporter", "totalUsd": 45.00 },
      { "user_id": 456, "username": "GenSupporter", "totalUsd": 35.00 }
    ]
  }
}
```

### POST /api/juicernaut/admin
Admin controls for starting/ending sessions.

**Request:**
```json
{
  "action": "start" | "end"
}
```

---

## Buff Application

### In Play Service

```typescript
async function executePlay(userId: number) {
  const isJuicernaut = await JuicernautService.isCurrentJuicernaut(userId)

  // ... select event and calculate base rewards

  if (isJuicernaut) {
    wealth = Math.floor(wealth * JUICERNAUT_BUFFS.WEALTH_MULTIPLIER)  // 1.25x
    xp = Math.floor(xp * JUICERNAUT_BUFFS.XP_MULTIPLIER)              // 2x
  }

  // Crate drop chance
  const dropChance = isJuicernaut
    ? PLAY_CRATE_DROP_CHANCE * JUICERNAUT_BUFFS.LOOT_MULTIPLIER  // 6%
    : PLAY_CRATE_DROP_CHANCE                                       // 2%
}
```

### In Rob Service

```typescript
async function canRob(attackerId: number, targetId: number) {
  // Check for Juicernaut immunity
  const isJuicernaut = await JuicernautService.isCurrentJuicernaut(targetId)
  if (isJuicernaut) {
    return {
      canRob: false,
      reason: 'Cannot rob the Juicernaut - they have immunity!',
    }
  }
}
```

---

## System Interdependencies

### Depends On
- **User System:** Wealth/XP rewards
- **Crate System:** Crate rewards
- **Notification System:** Crown/dethrone notifications
- **Discord System:** Crown announcements
- **Lumia System:** Light effects
- **Leaderboard System:** Contribution tracking

### Depended On By
- **Play System:** XP/wealth/crate multipliers
- **Rob System:** Immunity check
- **Business System:** Revenue multiplier
- **Achievement System:** Juicernaut achievements

---

## Lumia Integration

```typescript
const LUMIA_CONFIG = {
  LEADERBOARD_INTERVAL_MINUTES: 30,  // Post every 30 min during active session
}

// Trigger crown change effect
await LumiaService.triggerJuicernautCrown(newJuicernautUsername)

// Periodic leaderboard updates during stream
await LumiaService.postLeaderboard(sessionLeaderboard)
```

---

## Configuration & Constants

```typescript
const JUICERNAUT_BUFFS = {
  XP_MULTIPLIER: 2.0,
  LOOT_MULTIPLIER: 3.0,
  ROB_IMMUNITY: true,
  BUSINESS_MULTIPLIER: 1.5,
  WEALTH_MULTIPLIER: 1.25,
}

const CONTRIBUTION_USD_VALUES = {
  KICK_SUB_T1: 5.00,
  KICK_SUB_T2: 10.00,
  KICK_SUB_T3: 25.00,
  KICK_GIFT_SUB: 5.00,
  KICK_KICK: 0.01,
  TWITCH_SUB_T1: 5.00,
  TWITCH_SUB_T2: 10.00,
  TWITCH_SUB_T3: 25.00,
  TWITCH_GIFT_SUB: 5.00,
  TWITCH_BITS: 0.01,
  TWITCH_RAID: 0.10,
  STRIPE_DONATION: 1.00,
}

const JUICERNAUT_SESSION_REWARDS = {
  TIERS: [
    { minUsd: 0, maxUsd: 4.99, wealth: 1000, xp: 200, crate: null },
    { minUsd: 5, maxUsd: 14.99, wealth: 3000, xp: 500, crate: 'common' },
    { minUsd: 15, maxUsd: 29.99, wealth: 7500, xp: 1000, crate: 'uncommon' },
    { minUsd: 30, maxUsd: 49.99, wealth: 15000, xp: 2000, crate: 'rare' },
    { minUsd: 50, maxUsd: Infinity, wealth: 30000, xp: 4000, crate: 'legendary' },
  ],
}
```

---

## Known Limitations & TODOs

### Completed Features
- Session management (start/end)
- Contribution tracking across platforms
- Crown transfer with notifications
- 5 powerful buffs for Juicernaut
- Session-end reward tiers
- Discord/Lumia integration
- Achievement tracking

### Technical Notes
- Buffs stored in active_buffs table with no expiry (until dethroned)
- Crown checked on every contribution
- Session rewards based on total USD contributed
- Rob immunity is absolute (cannot be bypassed)

---

**File Location:** `web/src/lib/services/juicernaut.service.ts`
**Related Files:**
- `web/src/lib/services/lumia.service.ts`
- `web/src/lib/game/constants.ts` (JUICERNAUT_BUFFS)
- `web/src/app/api/juicernaut/route.ts`
- `web/src/app/api/webhooks/*/route.ts` (contribution sources)
