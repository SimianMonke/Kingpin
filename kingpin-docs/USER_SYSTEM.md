# USER SYSTEM - Implementation Documentation

## Overview

The User System is the foundational layer of Kingpin, handling user registration, authentication, profile management, progression mechanics (XP/leveling), and daily check-in rewards.

**Current Implementation Status:** Complete

---

## Database Schema

### Primary Table: `users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Internal unique user ID |
| `kick_user_id` | VARCHAR(255) | Kick platform user ID (unique) |
| `twitch_user_id` | VARCHAR(255) | Twitch platform user ID (unique) |
| `discord_user_id` | VARCHAR(50) | Discord platform user ID (unique) |
| `username` | VARCHAR(100) | Primary username |
| `display_name` | VARCHAR(100) | Display name from platform |
| `kingpin_name` | VARCHAR(100) | Custom Kingpin display name |
| `wealth` | BIGINT | Current cash balance (default: 0) |
| `xp` | BIGINT | Total experience points (default: 0) |
| `level` | INT | Current level (default: 1) |
| `status_tier` | VARCHAR(50) | Current tier name (default: 'Rookie') |
| `hp` | INT | Health points (default: 100) |
| `checkin_streak` | INT | Consecutive check-in days (default: 0) |
| `last_checkin_date` | DATE | Date of last check-in |
| `total_play_count` | INT | Total !play uses (default: 0) |
| `wins` | INT | Total wins (default: 0) |
| `losses` | INT | Total losses (default: 0) |
| `faction_id` | INT (FK) | Reference to factions table |
| `joined_faction_at` | TIMESTAMP | When user joined faction |
| `discord_username` | VARCHAR(100) | Discord username if linked |
| `discord_linked_at` | TIMESTAMP | When Discord was linked |
| `created_at` | TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | Last update time |
| `last_seen` | TIMESTAMP | Last activity timestamp |
| `upkeep_debt_days` | INT | Days behind on housing upkeep |
| `last_upkeep_check` | TIMESTAMP | Last upkeep calculation |
| `faction_cooldown_until` | TIMESTAMP | Faction switch cooldown end |
| `faction_reward_cooldown_until` | TIMESTAMP | Faction reward eligibility |
| `assigned_territory_id` | INT | Assigned territory for scoring |

### Relationships

- `users.faction_id` -> `factions.id` (Many-to-One)
- `users` <- `user_achievements` (One-to-Many)
- `users` <- `user_titles` (One-to-Many)
- `users` <- `user_inventory` (One-to-Many)
- `users` <- `user_crates` (One-to-Many)
- `users` <- `user_missions` (One-to-Many)
- `users` <- `cooldowns` (One-to-Many)
- `users` <- `game_events` (One-to-Many)
- `users` <- `leaderboard_snapshots` (One-to-Many)

---

## Core Logic & Formulas

### XP & Leveling System

**XP Required for Level N:**
```typescript
// Formula: XP = 100 × 1.25^(N-1)
function xpForLevel(level: number): number {
  if (level < 1) return 0
  return Math.floor(100 * Math.pow(1.25, level - 1))
}
```

**Example Calculations:**
| Level | XP Required | Cumulative XP |
|-------|-------------|---------------|
| 1 | 100 | 100 |
| 10 | 745 | 3,365 |
| 20 | 5,546 | 25,029 |
| 50 | 270,048 | 1,214,191 |
| 100 | 69,946,631 | 314,786,540 |

**Level from XP:**
```typescript
function levelFromXp(totalXp: number): number {
  let level = 1
  let xpNeeded = 0
  while (true) {
    xpNeeded += xpForLevel(level)
    if (totalXp < xpNeeded) return level
    level++
    if (level > 200) return 200  // Safety cap
  }
}
```

### Tier System

| Tier | Level Range | Multiplier |
|------|-------------|------------|
| Rookie | 1-19 | 1.0x |
| Associate | 20-39 | 1.1x |
| Soldier | 40-59 | 1.2x |
| Captain | 60-79 | 1.3x |
| Underboss | 80-99 | 1.4x |
| Kingpin | 100+ | 1.5x |

```typescript
const TIER_LEVELS = {
  'Rookie': { min: 1, max: 19 },
  'Associate': { min: 20, max: 39 },
  'Soldier': { min: 40, max: 59 },
  'Captain': { min: 60, max: 79 },
  'Underboss': { min: 80, max: 99 },
  'Kingpin': { min: 100, max: Infinity },
}
```

### Check-in Rewards

**Base Rewards:**
- Wealth: $100 base + ($100 × streak days, capped at 30)
- XP: 20 base + (20 × streak days, capped at 30)

```typescript
const CHECKIN_CONFIG = {
  BASE_WEALTH: 100,
  BASE_XP: 20,
  STREAK_BONUS_WEALTH_PER_DAY: 100,
  STREAK_BONUS_XP_PER_DAY: 20,
  MAX_STREAK_BONUS_DAYS: 30,
  MILESTONE_CYCLE: {
    WEEKLY_INTERVAL: 7,     // Every 7 days: Uncommon crate
    WEEKLY_CRATE: 'uncommon',
    MONTHLY_INTERVAL: 28,   // Every 28 days: Legendary crate
    MONTHLY_CRATE: 'legendary',
  },
}
```

**Example Check-in Rewards:**
| Streak | Wealth | XP | Milestone |
|--------|--------|-----|-----------|
| Day 1 | $200 | 40 | - |
| Day 7 | $800 | 160 | Uncommon Crate |
| Day 14 | $1,500 | 300 | Uncommon Crate |
| Day 28 | $3,000 | 600 | Legendary Crate |
| Day 30+ | $3,100 | 620 | (capped) |

---

## Service Layer Implementation

**File:** `web/src/lib/services/user.service.ts`

### Public Methods

```typescript
export const UserService = {
  // Find user by internal ID
  async findById(user_id: number): Promise<User | null>

  // Find user by platform and platform user ID
  async findByPlatform(platform: Platform, platformUserId: string): Promise<User | null>

  // Find user by username (case-insensitive)
  async findByUsername(username: string): Promise<User | null>

  // Create a new user from platform sign-in
  async create(input: CreateUserInput): Promise<User>

  // Get or create user (chat bot auto-registration)
  async getOrCreate(platform: Platform, platformUserId: string, username: string): Promise<User>

  // Get full user profile with computed fields
  async getProfile(user_id: number): Promise<UserProfile | null>

  // Link an additional platform to existing user
  async linkPlatform(user_id: number, platform: Platform, platformUserId: string): Promise<User>

  // Unlink a platform from user
  async unlinkPlatform(user_id: number, platform: Platform): Promise<User>

  // Update user's last seen timestamp
  async updateLastSeen(user_id: number): Promise<User>

  // Add wealth to user
  async addWealth(user_id: number, amount: number): Promise<User>

  // Remove wealth from user (floor at 0)
  async removeWealth(user_id: number, amount: number): Promise<User>

  // Add XP to user and handle level ups
  async addXp(user_id: number, amount: number): Promise<{
    levelUp: boolean
    newLevel?: number
    tierPromotion: boolean
    newTier?: string
  }>

  // Process daily check-in
  async processCheckin(user_id: number): Promise<CheckinResult>

  // Update user's Kingpin name (custom display name)
  async setKingpinName(user_id: number, name: string): Promise<User>

  // Get user stats for display
  async getStats(user_id: number): Promise<UserStats | null>

  // Increment play count
  async incrementPlayCount(user_id: number): Promise<User>

  // Record win
  async recordWin(user_id: number): Promise<User>

  // Record loss
  async recordLoss(user_id: number): Promise<User>
}
```

### Input Validation Rules

**Kingpin Name:**
- Length: 3-20 characters
- Allowed characters: `[a-zA-Z0-9_-]`
- Must be unique (case-insensitive)

**Platform Linking:**
- Cannot unlink the only connected platform
- Platform ID cannot be linked to multiple users

---

## API Endpoints

### GET /api/users/me
Get current authenticated user's profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "PlayerName",
    "display_name": "Player Name",
    "kingpin_name": null,
    "wealth": "150000",
    "xp": "45230",
    "level": 65,
    "status_tier": "Captain",
    "hp": 100,
    "checkin_streak": 14,
    "faction_id": 2,
    "faction_name": "Volkov Bratva",
    "equippedTitle": "Master Thief",
    "linkedPlatforms": ["kick", "twitch"]
  }
}
```

### GET /api/users/[userId]
Get another user's public profile.

### GET /api/users/by-name/[username]
Find user by username.

### POST /api/users/me/checkin
Process daily check-in.

**Response:**
```json
{
  "success": true,
  "data": {
    "streak": 15,
    "wealth_earned": 1600,
    "xp_earned": 320,
    "levelUp": false,
    "tierPromotion": false,
    "milestoneReward": null
  }
}
```

### GET /api/users/me/stats
Get user statistics.

### GET /api/users/me/cooldowns
Get user's active cooldowns.

### POST /api/auth/link/[platform]
Initiate platform linking OAuth flow.

### GET /api/auth/link/[platform]/callback
OAuth callback for platform linking.

---

## System Interdependencies

### Depends On
- **Database Layer:** Prisma client for data persistence
- **Auth System:** NextAuth for authentication

### Depended On By
- **Economy System:** Wealth/XP modification
- **Rob System:** User targeting, wealth theft
- **Inventory System:** Item ownership
- **Achievement System:** Progress tracking
- **Mission System:** Objective completion
- **Leaderboard System:** Snapshot tracking
- **Faction System:** Membership management
- **Juicernaut System:** Crown holder tracking

### Data Flow

```
User Action (Chat/Web)
       |
       v
+-----------------+
| UserService     |
| - findById      |
| - addWealth/XP  |
| - processCheckin|
+-----------------+
       |
       v
+-----------------+
| Prisma Client   |
+-----------------+
       |
       v
+-----------------+
| PostgreSQL      |
| (users table)   |
+-----------------+
```

---

## Configuration & Constants

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string

**Hardcoded Values:**
```typescript
// Level cap
const MAX_LEVEL = 200

// Tier multipliers
const TIER_MULTIPLIERS = {
  'Rookie': 1.0,
  'Associate': 1.1,
  'Soldier': 1.2,
  'Captain': 1.3,
  'Underboss': 1.4,
  'Kingpin': 1.5,
}

// Check-in config
const CHECKIN_CONFIG = {
  BASE_WEALTH: 100,
  BASE_XP: 20,
  STREAK_BONUS_WEALTH_PER_DAY: 100,
  STREAK_BONUS_XP_PER_DAY: 20,
  MAX_STREAK_BONUS_DAYS: 30,
}
```

---

## Known Limitations & TODOs

### Completed Features
- Multi-platform authentication (Kick, Twitch, Discord)
- Platform account linking
- XP/Level progression
- Tier system with multipliers
- Daily check-in with streaks
- Milestone crate rewards (7-day/28-day cycle)
- Custom Kingpin names

### Technical Debt
- None identified

### Deviation from Specification
- None - implementation matches spec

---

**File Location:** `web/src/lib/services/user.service.ts`
**Related Files:**
- `web/src/lib/game/formulas.ts` (XP/level calculations)
- `web/src/lib/game/constants.ts` (tier definitions)
- `web/src/app/api/users/` (API routes)
- `web/prisma/schema.prisma` (database schema)
