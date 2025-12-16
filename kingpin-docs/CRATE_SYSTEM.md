# CRATE SYSTEM - Implementation Documentation

## Overview

The Crate System handles loot box mechanics including crate acquisition, storage, opening, and reward distribution. Crates come in four tiers with different drop tables for weapons, armor, wealth, and titles.

**Current Implementation Status:** Complete

---

## Database Schema

### User Crates: `user_crates`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Crate ID |
| `user_id` | INT (FK) | Owner user ID |
| `crate_tier` | VARCHAR(20) | common, uncommon, rare, legendary |
| `source` | VARCHAR(50) | How crate was obtained |
| `is_escrowed` | BOOLEAN | Whether in escrow |
| `escrow_expires_at` | TIMESTAMP | Escrow expiration |
| `acquired_at` | TIMESTAMP | When obtained |
| `opened_at` | TIMESTAMP | When opened (null if unopened) |

### Crate Opens: `crate_opens`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Open record ID |
| `user_id` | INT (FK) | User who opened |
| `crate_id` | INT (FK) | Crate that was opened |
| `crate_tier` | VARCHAR(20) | Tier of crate |
| `drop_type` | VARCHAR(20) | weapon, armor, wealth, title |
| `item_id` | INT (FK) | Item received (if applicable) |
| `wealth_amount` | INT | Wealth received (if applicable) |
| `title` | VARCHAR(100) | Title received (if applicable) |
| `was_duplicate` | BOOLEAN | Whether title was duplicate |
| `opened_at` | TIMESTAMP | When opened |

### Crate Titles: `crate_titles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Title ID |
| `title` | VARCHAR(100) | Title text |
| `crate_tier` | VARCHAR(20) | Minimum crate tier |
| `rarity_weight` | INT | Selection weight |
| `is_active` | BOOLEAN | Whether available |

---

## Crate Configuration

### Crate Tiers

```typescript
const CRATE_TIERS = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary',
}
```

### Inventory Limits

```typescript
const MAX_CRATES = 10               // Maximum crates in inventory
const MAX_CRATE_ESCROW = 3          // Maximum crates in escrow
const CRATE_ESCROW_HOURS = 1        // 1 hour escrow for new crates
```

### Crate Sources

```typescript
const CRATE_SOURCES = {
  PLAY: 'play',                     // Random drop from !play
  CHECKIN_MILESTONE: 'checkin_milestone', // Streak milestones
  MISSION: 'mission',               // Mission completion bonus
  JUICERNAUT: 'juicernaut',         // Session rewards
  ACHIEVEMENT: 'achievement',        // Achievement rewards
  FACTION: 'faction',               // Territory rewards
  PURCHASE: 'purchase',             // Premium purchase
  GIFT: 'gift',                     // Admin gift
}
```

---

## Drop Tables

### Drop Type Distribution

```typescript
const CRATE_DROP_TABLES = {
  common: {
    weapon: 0.40,      // 40%
    armor: 0.40,       // 40%
    wealth: 0.20,      // 20%
    title: 0,          // 0% (no titles from common)
    wealthRange: { min: 500, max: 1500 },
  },
  uncommon: {
    weapon: 0.39,      // 39%
    armor: 0.39,       // 39%
    wealth: 0.22,      // 22%
    title: 0,          // 0% (MED-01: no titles from uncommon)
    wealthRange: { min: 1500, max: 4000 },
  },
  rare: {
    weapon: 0.35,      // 35%
    armor: 0.35,       // 35%
    wealth: 0.25,      // 25%
    title: 0.05,       // 5%
    wealthRange: { min: 4000, max: 10000 },
  },
  legendary: {
    weapon: 0.30,      // 30%
    armor: 0.30,       // 30%
    wealth: 0.30,      // 30%
    title: 0.10,       // 10%
    wealthRange: { min: 10000, max: 30000 },
  },
}
```

### Item Tier Weights (within drop type)

```typescript
const ITEM_TIER_WEIGHTS = {
  common: {
    common: 0.85, uncommon: 0.15, rare: 0, legendary: 0,
  },
  uncommon: {
    common: 0.40, uncommon: 0.50, rare: 0.10, legendary: 0,
  },
  rare: {
    common: 0.10, uncommon: 0.40, rare: 0.45, legendary: 0.05,
  },
  legendary: {
    common: 0, uncommon: 0.15, rare: 0.50, legendary: 0.35,
  },
}
```

### Duplicate Title Conversion

```typescript
const CRATE_TITLE_DUPLICATE_VALUES = {
  common: 500,      // $500 for duplicate common title
  uncommon: 1500,   // $1,500 for duplicate uncommon title
  rare: 5000,       // $5,000 for duplicate rare title
  legendary: 15000, // $15,000 for duplicate legendary title
}
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/crate.service.ts`

### Public Methods

```typescript
export const CrateService = {
  /**
   * Get user's crate inventory
   */
  async getCrates(userId: number): Promise<UserCrate[]>

  /**
   * Award crate to user
   */
  async awardCrate(
    userId: number,
    crateTier: CrateTier,
    source: CrateSource
  ): Promise<UserCrate>

  /**
   * Open a crate
   */
  async openCrate(userId: number, crateId: number): Promise<CrateOpenResult>

  /**
   * Claim crate from escrow
   */
  async claimFromEscrow(userId: number, crateId: number): Promise<void>

  /**
   * Get crate history
   */
  async getOpenHistory(userId: number, limit?: number): Promise<CrateOpen[]>

  /**
   * Expire old escrow crates
   */
  async expireEscrowCrates(): Promise<number>
}
```

### Award Crate

```typescript
async function awardCrate(
  userId: number,
  crateTier: CrateTier,
  source: CrateSource
): Promise<UserCrate> {
  // Check inventory space
  const crateCount = await prisma.user_crates.count({
    where: {
      user_id: userId,
      opened_at: null,
      is_escrowed: false,
    },
  })

  const needsEscrow = crateCount >= MAX_CRATES

  // Check escrow space
  if (needsEscrow) {
    const escrowCount = await prisma.user_crates.count({
      where: {
        user_id: userId,
        is_escrowed: true,
        opened_at: null,
      },
    })

    if (escrowCount >= MAX_CRATE_ESCROW) {
      // Expire oldest escrow
      await expireOldestEscrow(userId)
    }
  }

  const escrowExpires = needsEscrow
    ? new Date(Date.now() + CRATE_ESCROW_HOURS * 60 * 60 * 1000)
    : null

  const crate = await prisma.user_crates.create({
    data: {
      user_id: userId,
      crate_tier: crateTier,
      source,
      is_escrowed: needsEscrow,
      escrow_expires_at: escrowExpires,
      acquired_at: new Date(),
    },
  })

  // Send notification
  await NotificationService.create(userId, needsEscrow ? 'crate_escrow' : 'crate_received', {
    message: `You received a ${crateTier} crate!${needsEscrow ? ' (in escrow - claim soon!)' : ''}`,
    crate_id: crate.id,
    crate_tier: crateTier,
  })

  return crate
}
```

### Open Crate

```typescript
async function openCrate(userId: number, crateId: number): Promise<CrateOpenResult> {
  const crate = await prisma.user_crates.findUnique({
    where: { id: crateId },
  })

  if (!crate || crate.user_id !== userId) {
    throw new Error('Crate not found')
  }

  if (crate.opened_at) {
    throw new Error('Crate already opened')
  }

  if (crate.is_escrowed) {
    throw new Error('Claim crate from escrow first')
  }

  const dropTable = CRATE_DROP_TABLES[crate.crate_tier]
  let result: CrateOpenResult

  // Roll drop type
  const dropType = rollDropType(dropTable)

  switch (dropType) {
    case 'weapon':
    case 'armor':
      result = await awardItem(userId, crate.crate_tier, dropType)
      break

    case 'wealth':
      result = await awardWealth(userId, dropTable.wealthRange)
      break

    case 'title':
      result = await awardTitle(userId, crate.crate_tier)
      break
  }

  // Record opening
  await prisma.crate_opens.create({
    data: {
      user_id: userId,
      crate_id: crateId,
      crate_tier: crate.crate_tier,
      drop_type: dropType,
      item_id: result.item?.id,
      wealth_amount: result.wealth,
      title: result.title?.name,
      was_duplicate: result.title?.wasDuplicate,
      opened_at: new Date(),
    },
  })

  // Mark crate as opened
  await prisma.user_crates.update({
    where: { id: crateId },
    data: { opened_at: new Date() },
  })

  // Update leaderboard
  await LeaderboardService.updateSnapshot(userId, {
    crates_opened: 1,
  })

  // Check for legendary item achievement
  if (result.item?.tier === 'legendary') {
    await AchievementService.incrementProgress(userId, 'legendary_crate_item', 1)
  }

  // Post to Discord for rare+ crates
  if (['rare', 'legendary'].includes(crate.crate_tier)) {
    await DiscordService.postCrateOpen(userId, crate.crate_tier, result)
  }

  return result
}
```

### Roll Functions

```typescript
function rollDropType(dropTable: DropTable): DropType {
  const roll = Math.random()
  let cumulative = 0

  for (const [type, weight] of Object.entries(dropTable)) {
    if (type === 'wealthRange' || type === 'item_tierWeights') continue
    cumulative += weight
    if (roll < cumulative) return type as DropType
  }

  return 'wealth'
}

function rollItemTier(crateTier: CrateTier): ItemTier {
  const weights = CRATE_DROP_TABLES[crateTier].item_tierWeights
  const roll = Math.random()
  let cumulative = 0

  for (const [tier, weight] of Object.entries(weights)) {
    cumulative += weight
    if (roll < cumulative) return tier as ItemTier
  }

  return 'common'
}
```

### Title Award with Duplicate Handling

```typescript
async function awardTitle(userId: number, crateTier: CrateTier): Promise<TitleResult> {
  // Get available titles for this tier
  const titles = await prisma.crate_titles.findMany({
    where: {
      is_active: true,
      crate_tier: { in: getAvailableTiers(crateTier) },
    },
  })

  // Roll random title
  const selectedTitle = weightedRandom(titles, t => t.rarity_weight)

  // Check if user already has title
  const hasTitle = await TitleService.hasTitle(userId, selectedTitle.title)

  if (hasTitle) {
    // Convert to wealth
    const duplicateValue = CRATE_TITLE_DUPLICATE_VALUES[crateTier]
    await UserService.addWealth(userId, duplicateValue)

    return {
      title: {
        name: selectedTitle.title,
        wasDuplicate: true,
        duplicate_conversion: duplicateValue,
      },
    }
  }

  // Award new title
  await TitleService.awardTitle(userId, selectedTitle.title, 'crate')

  return {
    title: {
      name: selectedTitle.title,
      wasDuplicate: false,
    },
  }
}
```

---

## API Endpoints

### GET /api/crates
Get user's crate inventory.

### POST /api/crates/open
Open a crate.

**Request:**
```json
{
  "crate_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "crate_tier": "rare",
    "drop_type": "weapon",
    "item": {
      "id": 456,
      "name": "Cyber Blade",
      "type": "weapon",
      "tier": "rare",
      "rob_bonus": 0.11
    }
  }
}
```

### POST /api/crates/claim
Claim crate from escrow.

---

## System Interdependencies

### Depends On
- **User System:** Wealth rewards
- **Inventory System:** Item awards
- **Title System:** Title awards
- **Notification System:** Award notifications
- **Leaderboard System:** Open tracking
- **Achievement System:** Legendary item tracking

### Depended On By (Crate Sources)
- **Play System:** Random drops
- **Check-in System:** Milestone rewards
- **Mission System:** Completion bonuses
- **Juicernaut System:** Session rewards
- **Faction System:** Territory rewards

---

## Configuration & Constants

```typescript
const MAX_CRATES = 10
const MAX_CRATE_ESCROW = 3
const CRATE_ESCROW_HOURS = 1

const CRATE_DROP_TABLES = {
  common: { weapon: 0.40, armor: 0.40, wealth: 0.20, title: 0 },
  uncommon: { weapon: 0.39, armor: 0.39, wealth: 0.22, title: 0 },
  rare: { weapon: 0.35, armor: 0.35, wealth: 0.25, title: 0.05 },
  legendary: { weapon: 0.30, armor: 0.30, wealth: 0.30, title: 0.10 },
}

const CRATE_TITLE_DUPLICATE_VALUES = {
  common: 500,
  uncommon: 1500,
  rare: 5000,
  legendary: 15000,
}
```

---

## Known Limitations & TODOs

### Completed Features
- 4 crate tiers
- Separate drop tables per tier
- Item tier weighting within drop types
- Title drops (rare+ only)
- Duplicate title conversion
- Escrow system
- Discord posts for rare+ opens

### Technical Notes
- Titles only drop from rare and legendary crates (MED-01)
- 1-hour escrow (shorter than item escrow)
- Crate inventory limit separate from item inventory
- Duplicate titles auto-convert to tier-based wealth

---

**File Location:** `web/src/lib/services/crate.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (CRATE_DROP_TABLES)
- `web/src/lib/game/formulas.ts` (roll functions)
- `web/src/app/api/crates/route.ts`
- `web/src/app/api/crates/open/route.ts`
