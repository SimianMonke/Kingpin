# DATABASE LAYER - Implementation Documentation

## Overview

The Database Layer handles all data persistence using Prisma ORM with PostgreSQL (Neon) as the database provider. It provides type-safe database access across all services.

**Current Implementation Status:** Complete

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| ORM | Prisma Client |
| Database | PostgreSQL (Neon Serverless) |
| Adapter | @prisma/adapter-neon |
| Connection | Neon Serverless Driver |

---

## Database Connection

**File:** `web/src/lib/db.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const adapter = new PrismaNeon({ connectionString })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Connection String Format
```
postgresql://user:password@ep-example-123456.us-east-2.aws.neon.tech/kingpin?sslmode=require
```

---

## Database Schema

### Complete Table List (38 Tables)

| Table | Purpose | Primary Relations |
|-------|---------|-------------------|
| `users` | User accounts and profiles | Core entity |
| `achievements` | Achievement definitions | - |
| `user_achievements` | User progress on achievements | users, achievements |
| `active_buffs` | Currently active buffs | users |
| `black_market_inventory` | Black Market stock | items |
| `bot_config` | Bot configuration settings | - |
| `business_revenue_history` | Business income logs | users, items |
| `chat_messages` | Message history | users |
| `coin_flip_challenges` | Coinflip game state | users |
| `cooldowns` | Action cooldowns | users |
| `crate_loot_tables` | Drop probabilities | crate_types |
| `crate_opens` | Crate opening history | users, items |
| `crate_titles` | Titles from crates | - |
| `crate_types` | Crate tier definitions | - |
| `discord_activity_channels` | Discord channel config | - |
| `discord_server_config` | Discord server settings | - |
| `event_batch_queue` | Batched event processing | - |
| `factions` | Faction definitions | - |
| `gambling_sessions` | Gambling game history | users |
| `game_events` | All game event logs | users |
| `hall_of_fame_records` | All-time records | users |
| `heist_events` | Heist event history | streaming_sessions, users |
| `heist_quick_grab_pool` | Quick grab phrases | - |
| `heist_recent_events` | Recent heist tracking | - |
| `heist_riddle_pool` | Riddle questions | - |
| `heist_schedule` | Heist timing | streaming_sessions |
| `heist_trivia_pool` | Trivia questions | - |
| `heist_word_scramble_pool` | Word scrambles | - |
| `items` | Item definitions | - |
| `leaderboard_history` | Historical leaderboards | users |
| `leaderboard_snapshots` | Period-based stats | users |
| `lottery_draws` | Lottery game state | - |
| `lottery_tickets` | Player lottery tickets | users, lottery_draws |
| `mission_completions` | Completed missions | users |
| `mission_templates` | Mission definitions | - |
| `monetization_events` | Sub/bit/donation events | users |
| `oauth_link_states` | OAuth state tokens | - |
| `player_gambling_stats` | Player gambling stats | users |
| `player_shop_inventory` | Personal shop items | users, items |
| `reward_config` | Monetization rewards | - |
| `session_contributions` | Juicernaut contributions | users, streaming_sessions |
| `slot_jackpots` | Slot jackpot pools | - |
| `streaming_sessions` | Active stream sessions | users |
| `territories` | Territory definitions | factions |
| `user_crates` | User crate inventory | users |
| `user_inventory` | User item inventory | users, items |
| `user_missions` | Active user missions | users, mission_templates |
| `user_notifications` | User notifications | users |
| `user_titles` | User unlocked titles | users |

---

## Core Schema Details

### Users Table
```prisma
model users {
  id                    Int       @id @default(autoincrement())
  kick_user_id          String?   @unique @db.VarChar(255)
  twitch_user_id        String?   @unique @db.VarChar(255)
  discord_user_id       String?   @unique @db.VarChar(50)
  username              String    @db.VarChar(100)
  display_name          String?   @db.VarChar(100)
  kingpin_name          String?   @db.VarChar(100)
  wealth                BigInt?   @default(0)
  xp                    BigInt?   @default(0)
  level                 Int?      @default(1)
  status_tier           String?   @default("Rookie") @db.VarChar(50)
  hp                    Int?      @default(100)
  checkin_streak        Int?      @default(0)
  last_checkin_date     Date?
  total_play_count      Int?      @default(0)
  wins                  Int?      @default(0)
  losses                Int?      @default(0)
  faction_id            Int?
  joined_faction_at     DateTime?
  discord_username      String?   @db.VarChar(100)
  discord_linked_at     DateTime?
  created_at            DateTime? @default(now())
  updated_at            DateTime? @default(now())
  last_seen             DateTime? @default(now())
  upkeep_debt_days      Int?      @default(0)
  last_upkeep_check     DateTime?
  faction_cooldown_until DateTime?
  faction_reward_cooldown_until DateTime?
  assigned_territory_id Int?
}
```

### Items Table
```prisma
model items {
  id                    Int       @id @default(autoincrement())
  name                  String    @unique @db.VarChar(100)
  type                  String    @db.VarChar(50)  // weapon, armor, business, housing
  tier                  String    @db.VarChar(50)  // common, uncommon, rare, legendary
  base_durability       Int?      @default(100)
  rob_bonus             Decimal?  @db.Decimal(5, 2)
  defense_bonus         Decimal?  @db.Decimal(5, 2)
  revenue_min           Int?
  revenue_max           Int?
  insurance_percent     Decimal?  @db.Decimal(5, 2)
  purchase_price        Int
  sell_price            Int?
  description           String?
  flavor_text           String?
  created_at            DateTime? @default(now())
  daily_revenue_potential Int?
  upkeep_cost           Int?
  operating_cost        Int?
}
```

### User Inventory Table
```prisma
model user_inventory {
  id                Int       @id @default(autoincrement())
  user_id           Int
  item_id           Int
  durability        Int
  is_equipped       Boolean?  @default(false)
  slot              String?   @db.VarChar(50)
  is_escrowed       Boolean?  @default(false)
  escrow_expires_at DateTime?
  acquired_at       DateTime? @default(now())
  equipped_at       DateTime?

  items             items     @relation(...)
  users             users     @relation(...)
}
```

### Cooldowns Table
```prisma
model cooldowns {
  id                Int       @id @default(autoincrement())
  user_id           Int
  command_type      String    @db.VarChar(50)  // play, rob, bail, etc.
  target_identifier String?   @db.VarChar(255) // For per-target cooldowns
  expires_at        DateTime
  created_at        DateTime? @default(now())

  @@unique([user_id, command_type, target_identifier])
}
```

### Leaderboard Snapshots
```prisma
model leaderboard_snapshots {
  id                    Int       @id @default(autoincrement())
  user_id               Int
  period_type           String    @db.VarChar(20)  // daily, weekly, monthly, annual
  period_start          Date
  period_end            Date
  wealth_earned         BigInt?   @default(0)
  xp_earned             BigInt?   @default(0)
  messages_sent         Int?      @default(0)
  watch_time_minutes    Int?      @default(0)
  play_count            Int?      @default(0)
  rob_count             Int?      @default(0)
  rob_success_count     Int?      @default(0)
  checkins              Int?      @default(0)
  crates_opened         Int?      @default(0)
  subs_count            Int?      @default(0)
  gift_subs_given       Int?      @default(0)
  bits_donated          Int?      @default(0)
  kicks_sent            Int?      @default(0)
  donations_usd         Decimal?  @default(0) @db.Decimal(10, 2)
  total_contributed_usd Decimal?  @default(0) @db.Decimal(10, 2)
  created_at            DateTime? @default(now())

  @@unique([user_id, period_type, period_start])
}
```

---

## Indexes

### Performance Indexes
```sql
-- Gambling sessions
CREATE INDEX idx_gambling_sessions_game_result ON gambling_sessions(game_type, result);
CREATE INDEX idx_gambling_sessions_user_created ON gambling_sessions(user_id, created_at);
CREATE INDEX idx_gambling_sessions_user_game ON gambling_sessions(user_id, game_type);

-- Coinflip challenges
CREATE INDEX idx_coinflip_acceptor ON coin_flip_challenges(acceptor_id);
CREATE INDEX idx_coinflip_challenger ON coin_flip_challenges(challenger_id);
CREATE INDEX idx_coinflip_status_expires ON coin_flip_challenges(status, expires_at);

-- Lottery
CREATE INDEX idx_lottery_status_draw ON lottery_draws(status, draw_at);
CREATE INDEX idx_lottery_type_status ON lottery_draws(draw_type, status);
CREATE INDEX idx_lottery_tickets_draw ON lottery_tickets(draw_id);
CREATE INDEX idx_lottery_tickets_user ON lottery_tickets(user_id);

-- OAuth states
CREATE INDEX idx_oauth_link_expires ON oauth_link_states(expires_at);
CREATE INDEX idx_oauth_link_state ON oauth_link_states(state);

-- Business revenue
CREATE INDEX idx_business_revenue_user_date ON business_revenue_history(user_id, collected_at DESC);
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `DATABASE_SSL` | No | Enable SSL (default: true for Neon) |

---

## Prisma Schema Configuration

**File:** `web/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
}
```

---

## Database Operations

### Common Query Patterns

**Find User by Platform:**
```typescript
const user = await prisma.users.findFirst({
  where: { kick_user_id: platformUserId },
  include: {
    factions: true,
    user_titles: { where: { is_equipped: true } },
  },
})
```

**Atomic Wealth Update:**
```typescript
await prisma.users.update({
  where: { id: userId },
  data: { wealth: { increment: amount } },
})
```

**Upsert Leaderboard Snapshot:**
```typescript
await prisma.leaderboard_snapshots.upsert({
  where: {
    user_id_period_type_period_start: {
      user_id: userId,
      period_type: 'daily',
      period_start: periodStart,
    },
  },
  update: { wealth_earned: { increment: amount } },
  create: {
    user_id: userId,
    period_type: 'daily',
    period_start: periodStart,
    period_end: periodEnd,
    wealth_earned: amount,
  },
})
```

**Transaction Example:**
```typescript
await prisma.$transaction(async (tx) => {
  // Deduct from sender
  await tx.users.update({
    where: { id: senderId },
    data: { wealth: { decrement: amount } },
  })

  // Add to receiver
  await tx.users.update({
    where: { id: receiverId },
    data: { wealth: { increment: amount } },
  })
})
```

---

## Migrations

### Initial Setup
```bash
npx prisma db push    # Push schema to database
npx prisma generate   # Generate Prisma client
```

### Schema Changes
```bash
npx prisma db push --accept-data-loss  # Development only
npx prisma migrate dev                  # Create migration
npx prisma migrate deploy               # Production deploy
```

### Database Introspection
```bash
npx prisma db pull    # Pull schema from existing database
```

---

## System Interdependencies

### Used By All Services
- UserService
- PlayService
- RobService
- InventoryService
- ShopService
- BlackMarketService
- CrateService
- MissionService
- AchievementService
- LeaderboardService
- FactionService
- JuicernautService
- HeistService
- MonetizationService
- NotificationService
- JailService

### Data Flow
```
Service Layer
     |
     v
+-------------+
| Prisma      |
| Client      |
+-------------+
     |
     v
+-------------+
| Neon        |
| Adapter     |
+-------------+
     |
     v
+-------------+
| PostgreSQL  |
| (Neon)      |
+-------------+
```

---

## Configuration & Constants

### Prisma Client Options
```typescript
const prismaOptions = {
  log: ['query', 'error', 'warn'],  // Development
  // log: ['error'],                // Production
}
```

### Connection Pooling
Neon handles connection pooling automatically. The Prisma adapter uses serverless connections optimized for edge/serverless environments.

---

## Known Limitations & TODOs

### Completed Features
- Full schema implementation (38 tables)
- Proper indexes for performance
- BigInt support for wealth/XP
- Proper foreign key relationships
- Check constraints on percentage fields
- Cascading deletes where appropriate

### Technical Notes
- Using Neon serverless adapter for edge compatibility
- BigInt fields used for wealth/XP to prevent overflow
- Decimal fields for percentages with proper precision
- Global Prisma client singleton for connection reuse

### Potential Improvements
- Add database connection health checks
- Implement query result caching (Redis)
- Add database migration automation
- Add data archival for old records

---

**File Location:** `web/src/lib/db.ts`
**Related Files:**
- `web/prisma/schema.prisma` (schema definition)
- `.env` (DATABASE_URL)
