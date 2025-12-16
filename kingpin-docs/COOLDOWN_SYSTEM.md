# COOLDOWN & JAIL SYSTEM - Implementation Documentation

## Overview

The Cooldown System manages time-based restrictions on actions (play, rob, bail) and the Jail System handles the bust mechanic, jail sentences, and bail escape.

**Current Implementation Status:** Complete

---

## Database Schema

### Cooldowns Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Cooldown ID |
| `user_id` | INT (FK) | User ID |
| `command_type` | VARCHAR(50) | Type of cooldown (play, rob, bail, rob_target) |
| `target_identifier` | VARCHAR(255) | For per-target cooldowns (e.g., rob target ID) |
| `expires_at` | TIMESTAMP | When cooldown ends |
| `created_at` | TIMESTAMP | When cooldown was set |

**Unique Constraint:** `(user_id, command_type, target_identifier)`

### Jail Representation

Jail is implemented via the cooldowns table with:
- `command_type` = 'jail'
- `expires_at` = jail release time

---

## Cooldown Types

| Type | Duration | Scope | Trigger |
|------|----------|-------|---------|
| `play` | Channel-point based | Global per user | !play command |
| `rob_target` | 24 hours | Per target | After robbery attempt |
| `bail` | 30 minutes | Global per user | After using bail |
| `jail` | 60 minutes | Global per user | Getting busted |
| `gambling_slots` | 5 seconds | Global per user | After slots spin |
| `gambling_blackjack` | 10 seconds | Global per user | After blackjack hand |
| `gambling_coinflip` | 30 seconds | Global per user | After coinflip |

---

## Jail Mechanics

### Bust Chance

```typescript
const JAIL_CONFIG = {
  BUST_CHANCE: 0.05,          // 5% chance per play
  DURATION_MINUTES: 60,       // 1 hour sentence
  BAIL_COST_PERCENT: 0.10,    // 10% of total wealth
  MIN_BAIL: 100,              // Minimum $100 bail
}
```

### Bust Process (During Play)

```typescript
async function checkAndProcessBust(userId: number): Promise<boolean> {
  // 5% chance to get busted
  if (Math.random() >= JAIL_CONFIG.BUST_CHANCE) {
    return false  // Not busted
  }

  // Jail the user for 60 minutes
  await jailUser(userId, JAIL_CONFIG.DURATION_MINUTES)

  // Update bust achievement
  await AchievementService.incrementProgress(userId, 'bust_count', 1)

  return true
}
```

### Bail Cost Calculation

```typescript
function calculateBailCost(wealth: bigint): number {
  return Math.max(
    JAIL_CONFIG.MIN_BAIL,
    Math.floor(Number(wealth) * JAIL_CONFIG.BAIL_COST_PERCENT)
  )
}
```

**Example:**
- Wealth: $50,000
- Bail cost: $5,000 (10%)
- Minimum bail: $100 (if 10% < $100)

---

## Service Layer Implementation

**File:** `web/src/lib/services/jail.service.ts`

### Public Methods

```typescript
export const JailService = {
  /**
   * Check if user is currently jailed
   */
  async checkJailStatus(userId: number): Promise<{
    isJailed: boolean
    jailUntil: Date | null
    remainingMinutes: number
  }>

  /**
   * Jail a user for specified duration
   */
  async jailUser(userId: number, durationMinutes: number): Promise<void>

  /**
   * Process bail request
   */
  async processBail(userId: number): Promise<{
    success: boolean
    cost: number
    newWealth: bigint
  }>

  /**
   * Check if user has active cooldown
   */
  async hasCooldown(
    userId: number,
    commandType: string,
    targetIdentifier?: string
  ): Promise<{
    active: boolean
    expiresAt: Date | null
    remainingSeconds: number | null
  }>

  /**
   * Set a cooldown
   */
  async setCooldown(
    userId: number,
    commandType: string,
    durationSeconds: number,
    targetIdentifier?: string,
    tx?: PrismaTransactionClient
  ): Promise<void>

  /**
   * Clear expired cooldowns
   */
  async clearExpiredCooldowns(): Promise<number>

  /**
   * Get all active cooldowns for user
   */
  async getCooldowns(userId: number): Promise<Cooldown[]>
}
```

### Jail Status Check

```typescript
async function checkJailStatus(userId: number) {
  const jailCooldown = await prisma.cooldowns.findFirst({
    where: {
      user_id: userId,
      command_type: 'jail',
      expires_at: { gt: new Date() },
    },
  })

  if (!jailCooldown) {
    return { isJailed: false, jailUntil: null, remainingMinutes: 0 }
  }

  const remainingMs = jailCooldown.expires_at.getTime() - Date.now()
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))

  return {
    isJailed: true,
    jailUntil: jailCooldown.expires_at,
    remainingMinutes,
  }
}
```

### Bail Processing

```typescript
async function processBail(userId: number) {
  // 1. Check if jailed
  const jailStatus = await checkJailStatus(userId)
  if (!jailStatus.isJailed) {
    throw new Error('You are not in jail')
  }

  // 2. Check bail cooldown (30 minutes between bail attempts)
  const bailCooldown = await hasCooldown(userId, 'bail')
  if (bailCooldown.active) {
    throw new Error(`Bail on cooldown for ${Math.ceil(bailCooldown.remainingSeconds! / 60)} minutes`)
  }

  // 3. Calculate bail cost
  const user = await UserService.findById(userId)
  const bailCost = calculateBailCost(user.wealth)

  // 4. Check if user can afford
  if (Number(user.wealth) < bailCost) {
    throw new Error(`Insufficient funds. Bail costs $${bailCost.toLocaleString()}`)
  }

  // 5. Deduct bail and release
  await prisma.$transaction(async (tx) => {
    // Deduct bail cost
    await tx.users.update({
      where: { id: userId },
      data: { wealth: { decrement: bailCost } },
    })

    // Remove jail cooldown
    await tx.cooldowns.deleteMany({
      where: {
        user_id: userId,
        command_type: 'jail',
      },
    })

    // Set bail cooldown (30 minutes)
    await setCooldown(userId, 'bail', 30 * 60, undefined, tx)
  })

  // 6. Update achievement
  await AchievementService.incrementProgress(userId, 'bail_count', 1)

  return {
    success: true,
    cost: bailCost,
    newWealth: BigInt(Number(user.wealth) - bailCost),
  }
}
```

### Per-Target Cooldown (Rob)

```typescript
async function setRobTargetCooldown(attackerId: number, targetId: number) {
  const cooldownSeconds = ROB_CONFIG.COOLDOWN_HOURS * 60 * 60  // 24 hours

  await prisma.cooldowns.upsert({
    where: {
      user_id_command_type_target_identifier: {
        user_id: attackerId,
        command_type: 'rob_target',
        target_identifier: targetId.toString(),
      },
    },
    update: {
      expires_at: new Date(Date.now() + cooldownSeconds * 1000),
    },
    create: {
      user_id: attackerId,
      command_type: 'rob_target',
      target_identifier: targetId.toString(),
      expires_at: new Date(Date.now() + cooldownSeconds * 1000),
    },
  })
}

async function canRobTarget(attackerId: number, targetId: number): Promise<boolean> {
  const cooldown = await hasCooldown(
    attackerId,
    'rob_target',
    targetId.toString()
  )
  return !cooldown.active
}
```

---

## Juicernaut Jail Immunity

```typescript
// Juicernaut cannot be jailed (checked in play service)
async function executePlay(userId: number) {
  const isJuicernaut = await JuicernautService.isCurrentJuicernaut(userId)

  // Skip bust check for Juicernaut
  if (!isJuicernaut) {
    const wasBusted = Math.random() < JAIL_CONFIG.BUST_CHANCE
    if (wasBusted) {
      await JailService.jailUser(userId, JAIL_CONFIG.DURATION_MINUTES)
      return { wasBusted: true, ... }
    }
  }

  // ... continue with normal play
}
```

---

## API Endpoints

### GET /api/users/me/cooldowns
Get all active cooldowns for authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "jail": {
      "active": true,
      "expiresAt": "2024-01-15T17:00:00Z",
      "remainingMinutes": 45
    },
    "robTargets": {
      "123": {
        "expiresAt": "2024-01-16T12:00:00Z",
        "remainingHours": 20
      }
    },
    "gambling": {
      "slots": { "active": false },
      "blackjack": { "active": false }
    }
  }
}
```

### POST /api/bail
Post bail to escape jail.

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "cost": 5000,
    "newWealth": "45000",
    "message": "Bail posted! You're free."
  }
}
```

**Response (Insufficient Funds):**
```json
{
  "success": false,
  "error": "Insufficient funds. Bail costs $5,000."
}
```

---

## System Interdependencies

### Depends On
- **User System:** Wealth for bail costs
- **Database Layer:** Cooldown storage

### Depended On By
- **Play System:** Jail check before play, bust processing
- **Rob System:** Per-target cooldowns, jail check
- **Gambling System:** Game cooldowns
- **Achievement System:** Bust/bail tracking

---

## Configuration & Constants

```typescript
const JAIL_CONFIG = {
  BUST_CHANCE: 0.05,          // 5% chance to get busted
  DURATION_MINUTES: 60,       // 1 hour sentence
  BAIL_COST_PERCENT: 0.10,    // 10% of wealth
  MIN_BAIL: 100,              // Minimum bail $100
}

// Gambling cooldowns (ms)
const GAMBLING_CONFIG = {
  SLOTS_COOLDOWN: 5000,       // 5 seconds
  BLACKJACK_COOLDOWN: 10000,  // 10 seconds
  COINFLIP_COOLDOWN: 30000,   // 30 seconds
}

// Rob cooldown
const ROB_CONFIG = {
  COOLDOWN_HOURS: 24,         // 24h per target
}

// Bail cooldown (implicit)
const BAIL_COOLDOWN_MINUTES = 30  // 30 minutes between bail attempts
```

---

## Scheduled Jobs

### Clear Expired Cooldowns

```typescript
// Runs daily via cron
async function clearExpiredCooldowns() {
  const deleted = await prisma.cooldowns.deleteMany({
    where: {
      expires_at: { lt: new Date() },
    },
  })

  return deleted.count
}
```

---

## Known Limitations & TODOs

### Completed Features
- Jail mechanic with 5% bust chance
- 60-minute jail sentences
- Bail system with 10% wealth cost
- Per-target rob cooldowns (24h)
- Gambling cooldowns
- Juicernaut jail immunity
- Bail/bust achievement tracking

### Technical Notes
- Cooldowns use database timestamps, not in-memory
- Per-target cooldowns use composite unique key
- Juicernaut is exempt from bust checks entirely
- Bail has its own cooldown (30 minutes)

---

**File Location:** `web/src/lib/services/jail.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (JAIL_CONFIG)
- `web/src/lib/game/formulas.ts` (calculateBailCost)
- `web/src/app/api/bail/route.ts` (API endpoint)
- `web/src/lib/services/play.service.ts` (bust processing)
