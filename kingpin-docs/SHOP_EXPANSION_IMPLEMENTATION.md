# SHOP EXPANSION IMPLEMENTATION SPEC (v2.0)

## Document Purpose

This document defines the implementation plan for expanding the Kingpin shop system with two new subsystems:

1. **Supply Depot** - Consumable stat-boost items (always available)
2. **Stream Actions** - Real-world stream effect redemptions via Lumia Stream

This spec supersedes SHOP_EXPANSION.md as the authoritative implementation guide.

---

## ARCHITECTURAL DECISIONS

### Summary Matrix

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database Schema** | Hybrid - reuse `active_buffs` + new tables | Leverage existing buff infrastructure, add catalog tables for new item types |
| **Service Architecture** | Separate services, unified exports | `ConsumableService` + `StreamActionService` + `BuffService` - clear separation of concerns |
| **URL Structure** | Nested `/shop/*` | Cohesive API: `/shop/supplies`, `/shop/stream-actions` |
| **Buff Calculation** | Centralized `BuffService` | Single source of truth for all buff aggregation |
| **Stream Queue** | Redis (primary) / DB (fallback) | Railway has Redis; database acceptable for MVP |
| **Transactions** | Prisma `$transaction` | Consistent with existing shop purchase pattern |

### Design Principles

1. **Existing shop unchanged** - Equipment rotation mechanics in `ShopService` remain untouched
2. **Consumables always available** - Not rotating; direct purchase from catalog
3. **Stream actions database-driven** - Admin can add/remove without code deploy
4. **Buff stacking via BuffService** - Centralized calculation prevents inconsistencies

---

## DATABASE SCHEMA

### Migration: Add Source Column to active_buffs

```sql
-- Add source tracking to existing active_buffs table
ALTER TABLE active_buffs ADD COLUMN source VARCHAR(50) DEFAULT 'system';
-- source values: 'consumable', 'juicernaut', 'territory', 'system'

-- Add category for stacking logic
ALTER TABLE active_buffs ADD COLUMN category VARCHAR(50);
-- category values: 'xp', 'rob_attack', 'rob_defense', 'business', 'crate', 'wealth'
```

### New Table: consumable_types

```sql
-- Consumable catalog/definitions (seeded, rarely changes)
CREATE TABLE consumable_types (
    id VARCHAR(50) PRIMARY KEY,           -- e.g., 'xp_25', 'bail_bond'
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,        -- 'xp', 'combat', 'economy', 'utility'
    cost INTEGER NOT NULL,

    -- Duration buff fields (for boosters)
    is_duration_buff BOOLEAN DEFAULT TRUE,
    duration_hours INTEGER DEFAULT 24,
    buff_key VARCHAR(50),                 -- Maps to active_buffs.buff_type
    buff_value DECIMAL(5,2),              -- Multiplier value (e.g., 1.25 for +25%)

    -- Single-use fields (for utilities)
    is_single_use BOOLEAN DEFAULT FALSE,
    max_owned INTEGER,                    -- NULL = unlimited

    -- Metadata
    description TEXT,
    flavor_text TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New Table: user_consumables

```sql
-- User's owned single-use consumables (quantity-based)
CREATE TABLE user_consumables (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    consumable_id VARCHAR(50) REFERENCES consumable_types(id),
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, consumable_id)
);

CREATE INDEX idx_user_consumables_user ON user_consumables(user_id);
```

### New Table: consumable_purchases

```sql
-- Purchase audit trail
CREATE TABLE consumable_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    consumable_id VARCHAR(50) REFERENCES consumable_types(id),
    cost INTEGER NOT NULL,

    -- Buff interaction tracking
    was_extension BOOLEAN DEFAULT FALSE,  -- Extended existing buff
    was_upgrade BOOLEAN DEFAULT FALSE,    -- Replaced lower-tier buff
    previous_buff_remaining_minutes INTEGER,

    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consumable_purchases_user ON consumable_purchases(user_id);
```

### New Table: stream_action_types

```sql
-- Stream action catalog (admin-managed via UI)
CREATE TABLE stream_action_types (
    id VARCHAR(50) PRIMARY KEY,           -- e.g., 'fog_burst', 'tts_short'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,        -- 'lights', 'fog', 'sound', 'tts'

    -- Pricing & limits
    cost INTEGER NOT NULL,
    cooldown_seconds INTEGER NOT NULL,
    limit_per_stream INTEGER,             -- NULL = unlimited

    -- Lumia integration
    lumia_command_id VARCHAR(100),        -- Command trigger sent to Lumia
    queue_behavior VARCHAR(20) DEFAULT 'overwrite', -- 'overwrite' | 'queue'

    -- TTS-specific
    max_characters INTEGER,               -- For TTS actions

    -- Admin controls
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New Table: stream_action_usage

```sql
-- Stream action history/analytics
CREATE TABLE stream_action_usage (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(id),
    user_id INTEGER REFERENCES users(id),
    action_id VARCHAR(50) REFERENCES stream_action_types(id),

    cost INTEGER NOT NULL,
    payload JSONB,                        -- TTS text, color values, etc.

    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'overwritten'
    error_message TEXT,

    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_stream_action_usage_session ON stream_action_usage(session_id);
CREATE INDEX idx_stream_action_usage_user ON stream_action_usage(user_id);
```

### New Table: stream_action_cooldowns

```sql
-- Global cooldowns per action type (not per-user)
CREATE TABLE stream_action_cooldowns (
    id SERIAL PRIMARY KEY,
    action_id VARCHAR(50) REFERENCES stream_action_types(id) UNIQUE,
    expires_at TIMESTAMP NOT NULL
);
```

---

## SEED DATA

### Consumable Types

```sql
INSERT INTO consumable_types (id, name, category, cost, is_duration_buff, duration_hours, buff_key, buff_value, description, sort_order) VALUES
-- XP Boosters
('xp_25', 'XP Chip', 'xp', 25000, TRUE, 24, 'xp_multiplier', 1.25, '+25% XP gains for 24 hours', 1),
('xp_50', 'Neural Enhancer', 'xp', 50000, TRUE, 24, 'xp_multiplier', 1.50, '+50% XP gains for 24 hours', 2),
('xp_100', 'Cognitive Overclock', 'xp', 100000, TRUE, 24, 'xp_multiplier', 2.00, '+100% XP gains for 24 hours', 3),

-- Combat Enhancers
('rob_atk_5', 'Targeting Module', 'combat', 35000, TRUE, 24, 'rob_attack', 1.05, '+5% rob success rate', 10),
('rob_atk_10', 'Combat Stims', 'combat', 60000, TRUE, 24, 'rob_attack', 1.10, '+10% rob success rate', 11),
('rob_def_5', 'Reflex Amplifier', 'combat', 40000, TRUE, 24, 'rob_defense', 1.05, '+5% defense rating', 12),
('rob_def_10', 'Nano-Weave Boost', 'combat', 75000, TRUE, 24, 'rob_defense', 1.10, '+10% defense rating', 13),

-- Economy Boosters
('biz_25', 'Business License', 'economy', 30000, TRUE, 24, 'business_revenue', 1.25, '+25% business revenue', 20),
('biz_50', 'Corporate Contracts', 'economy', 65000, TRUE, 24, 'business_revenue', 1.50, '+50% business revenue', 21),
('crate_3', 'Lucky Coin', 'economy', 35000, TRUE, 24, 'crate_drop', 1.03, '+3% crate drop rate', 22),
('crate_5', 'Fortune''s Favor', 'economy', 80000, TRUE, 24, 'crate_drop', 1.05, '+5% crate drop rate', 23),
('wealth_10', 'Street Smarts', 'economy', 40000, TRUE, 24, 'wealth_gain', 1.10, '+10% wealth from !play', 24),
('wealth_20', 'Kingpin''s Touch', 'economy', 90000, TRUE, 24, 'wealth_gain', 1.20, '+20% wealth from !play', 25);

-- Single-Use Utilities
INSERT INTO consumable_types (id, name, category, cost, is_duration_buff, is_single_use, max_owned, description, sort_order) VALUES
('bail_bond', 'Bail Bond', 'utility', 15000, FALSE, TRUE, 5, 'Skip the 10% bail cost once', 30),
('reroll_token', 'Reroll Token', 'utility', 10000, FALSE, TRUE, 10, 'Free equipment shop reroll', 31),
('crate_magnet', 'Crate Magnet', 'utility', 75000, FALSE, TRUE, 3, 'Guarantees 50% crate drop on next !play', 32);
```

### Stream Action Types (Initial)

```sql
INSERT INTO stream_action_types (id, name, category, cost, cooldown_seconds, limit_per_stream, lumia_command_id, queue_behavior, description, sort_order) VALUES
-- Lights & Ambiance
('color_shift', 'Color Shift', 'lights', 10000, 120, NULL, 'color_shift', 'overwrite', 'Change stream light color', 1),
('flash_pulse', 'Flash Pulse', 'lights', 15000, 180, NULL, 'flash_pulse', 'overwrite', 'Quick light flash effect', 2),
('rainbow_cycle', 'Rainbow Cycle', 'lights', 25000, 600, 10, 'rainbow', 'overwrite', '10-second rainbow lights', 3),
('blackout', 'Blackout', 'lights', 50000, 1800, 3, 'blackout', 'overwrite', 'Lights off for 5 seconds', 4),

-- Fog & Effects
('fog_burst', 'Fog Burst', 'fog', 25000, 300, NULL, 'fog_burst', 'overwrite', 'Single fog machine burst', 10),
('fog_wave', 'Fog Wave', 'fog', 75000, 900, 5, 'fog_wave', 'overwrite', '10-second continuous fog', 11),
('atmosphere', 'The Atmosphere', 'fog', 150000, 3600, 2, 'atmosphere', 'overwrite', 'Fog + dim lights combo', 12),

-- Sound & Voice
('sound_alert', 'Sound Alert', 'sound', 20000, 180, NULL, 'sound_alert', 'queue', 'Play sound from approved list', 20),
('tts_short', 'TTS Short', 'tts', 35000, 300, NULL, 'tts', 'queue', 'Text-to-speech (50 chars)', 21),
('tts_long', 'TTS Long', 'tts', 60000, 300, NULL, 'tts', 'queue', 'Text-to-speech (100 chars)', 22),
('tts_premium', 'TTS Premium', 'tts', 100000, 600, 10, 'tts', 'queue', 'Text-to-speech (200 chars)', 23);

UPDATE stream_action_types SET max_characters = 50 WHERE id = 'tts_short';
UPDATE stream_action_types SET max_characters = 100 WHERE id = 'tts_long';
UPDATE stream_action_types SET max_characters = 200 WHERE id = 'tts_premium';
```

---

## SERVICE LAYER

### File Structure

```
web/src/lib/services/
├── shop.service.ts              # EXISTING - Equipment rotation (unchanged)
├── black-market.service.ts      # EXISTING - Legendary items (unchanged)
├── buff.service.ts              # NEW - Centralized buff management
├── consumable.service.ts        # NEW - Supply Depot logic
├── stream-action.service.ts     # NEW - Lumia Stream integration
├── tts-sanitizer.ts             # NEW - TTS input filtering
└── index.ts                     # Updated exports
```

### BuffService Interface

```typescript
// web/src/lib/services/buff.service.ts

export interface ActiveBuffInfo {
  buffType: string
  category: string
  multiplier: number
  source: 'consumable' | 'juicernaut' | 'territory' | 'system'
  expiresAt: Date | null
  remainingMinutes: number | null
}

export const BuffService = {
  /**
   * Get all active buffs for a user
   */
  async getActiveBuffs(userId: number): Promise<ActiveBuffInfo[]>,

  /**
   * Get aggregated multiplier for a specific buff key
   * Applies stacking rules: consumable + territory (additive), then juicernaut (multiplicative)
   */
  async getMultiplier(userId: number, buffKey: string): Promise<number>,

  /**
   * Apply a new buff (handles upgrade/extension logic for same category)
   */
  async applyBuff(
    userId: number,
    buffType: string,
    category: string,
    multiplier: number,
    durationHours: number,
    source: string
  ): Promise<{ wasExtension: boolean; wasUpgrade: boolean; previousRemaining?: number }>,

  /**
   * Check if user has a specific buff active
   */
  async hasBuff(userId: number, buffType: string): Promise<boolean>,

  /**
   * Remove expired buffs (called by cron job)
   */
  async cleanupExpired(): Promise<number>,
}
```

### ConsumableService Interface

```typescript
// web/src/lib/services/consumable.service.ts

export interface ConsumableType {
  id: string
  name: string
  category: string
  cost: number
  isDurationBuff: boolean
  durationHours: number | null
  buffKey: string | null
  buffValue: number | null
  isSingleUse: boolean
  maxOwned: number | null
  description: string
}

export interface UserConsumableInventory {
  consumableId: string
  name: string
  quantity: number
}

export interface PurchaseResult {
  success: boolean
  reason?: string
  consumableName?: string
  pricePaid?: number
  newWealth?: bigint
  buffApplied?: boolean
  wasExtension?: boolean
  wasUpgrade?: boolean
}

export const ConsumableService = {
  /**
   * Get all available consumables (catalog)
   */
  async getConsumables(): Promise<ConsumableType[]>,

  /**
   * Get user's single-use consumable inventory
   */
  async getUserInventory(userId: number): Promise<UserConsumableInventory[]>,

  /**
   * Purchase a consumable (buff or single-use)
   */
  async purchase(userId: number, consumableId: string): Promise<PurchaseResult>,

  /**
   * Use a single-use consumable
   */
  async useSingleUse(userId: number, consumableId: string): Promise<{ success: boolean; reason?: string }>,

  /**
   * Check if user owns a specific single-use consumable
   */
  async hasConsumable(userId: number, consumableId: string): Promise<boolean>,

  /**
   * Get count of specific consumable owned
   */
  async getConsumableCount(userId: number, consumableId: string): Promise<number>,
}
```

### StreamActionService Interface

```typescript
// web/src/lib/services/stream-action.service.ts

export interface StreamActionType {
  id: string
  name: string
  description: string
  category: string
  cost: number
  cooldownSeconds: number
  limitPerStream: number | null
  queueBehavior: 'overwrite' | 'queue'
  maxCharacters: number | null  // For TTS
}

export interface ActionAvailability {
  available: boolean
  reason?: string  // 'cooldown', 'limit_reached', 'stream_offline', 'lumia_offline'
  cooldownRemaining?: number  // seconds
  usedThisStream?: number
  limitPerStream?: number
}

export interface TriggerResult {
  success: boolean
  reason?: string
  usageId?: number
  queuePosition?: number  // For queued audio actions
}

export const StreamActionService = {
  /**
   * Get all active stream actions (catalog)
   */
  async getAvailableActions(): Promise<StreamActionType[]>,

  /**
   * Check if stream is currently live
   */
  async isStreamLive(): Promise<boolean>,

  /**
   * Validate Lumia Stream connection
   */
  async validateLumiaConnection(): Promise<boolean>,

  /**
   * Check if action can be triggered (cooldowns, limits, stream status)
   */
  async canTrigger(actionId: string): Promise<ActionAvailability>,

  /**
   * Trigger a stream action
   */
  async trigger(userId: number, actionId: string, payload?: { text?: string; color?: string }): Promise<TriggerResult>,

  /**
   * Get user's action history for current stream
   */
  async getUserHistory(userId: number, sessionId?: number): Promise<StreamActionUsage[]>,

  /**
   * Process audio queue (called by worker)
   */
  async processQueue(): Promise<void>,
}
```

### TTS Sanitizer

```typescript
// web/src/lib/services/tts-sanitizer.ts

export interface SanitizeResult {
  valid: boolean
  sanitized: string
  rejectionReason?: string
}

export const TTSSanitizer = {
  /**
   * Sanitize TTS input for spam and abuse patterns
   */
  sanitize(input: string, maxLength: number): SanitizeResult,
}

// Rules:
// 1. Blocklist: Standard profanity filter
// 2. Repetition: Detect repeated chars (wwwwww, !!!!!!!, 7777777)
// 3. Phonetic spam: Common TTS exploits (soi soi, fuh fuh, rapid consonants)
// 4. Max length: Hard truncate at character limit
// 5. Empty/whitespace: Reject
```

---

## API ROUTES

### Supply Depot Routes

```
GET  /api/shop/supplies
     - Returns: { consumables: ConsumableType[], userBuffs: ActiveBuffInfo[], userInventory: UserConsumableInventory[] }

POST /api/shop/supplies/buy
     - Body: { consumableId: string }
     - Returns: PurchaseResult

POST /api/shop/supplies/use
     - Body: { consumableId: string }
     - Returns: { success: boolean, reason?: string }
```

### Stream Action Routes

```
GET  /api/shop/stream-actions
     - Returns: { actions: StreamActionType[], streamLive: boolean, lumiaOnline: boolean }

GET  /api/shop/stream-actions/status
     - Returns: { [actionId]: ActionAvailability }

POST /api/shop/stream-actions/trigger
     - Body: { actionId: string, payload?: { text?: string, color?: string } }
     - Returns: TriggerResult

GET  /api/shop/stream-actions/history
     - Query: ?limit=20
     - Returns: StreamActionUsage[]
```

### Admin Routes

```
GET  /api/admin/stream-actions
     - Returns: StreamActionType[] (including inactive)

POST /api/admin/stream-actions
     - Body: StreamActionType (create new)

PATCH /api/admin/stream-actions/:id
      - Body: Partial<StreamActionType> (update)

DELETE /api/admin/stream-actions/:id
       - Soft delete (sets is_active = false)
```

---

## BUFF APPLICATION ORDER

When calculating final rewards, apply buffs in this order:

```
1. Base Reward (from formulas.ts)
   ↓
2. Consumable Buff (ADDITIVE)
   - e.g., base * 1.25 for +25% XP boost
   ↓
3. Territory Buff (ADDITIVE with consumable)
   - e.g., (base * 1.25) * 1.10 for territory bonus
   ↓
4. Juicernaut Buff (MULTIPLICATIVE)
   - e.g., ((base * 1.25) * 1.10) * juicernaut_multiplier
   ↓
5. Final Reward
```

### Integration Points

Services that need BuffService integration:

| Service | Buff Keys Used |
|---------|----------------|
| `PlayService` | `xp_multiplier`, `wealth_gain`, `crate_drop` |
| `RobService` | `rob_attack`, `rob_defense` |
| `BusinessService` | `business_revenue` |
| `JailService` | Check for `bail_bond` consumable |
| `ShopService` | Check for `reroll_token` consumable |
| `CrateService` | `crate_drop`, check for `crate_magnet` |

---

## IMPLEMENTATION PHASES

### Phase 1: Database & BuffService ✅ COMPLETE

**Tasks:**
- [x] Create Prisma migration for schema changes
- [x] Add `source` and `category` columns to `active_buffs`
- [x] Create `consumable_types`, `user_consumables`, `consumable_purchases` tables
- [x] Run seed data for consumable_types (16 items seeded)
- [x] Implement `BuffService` with all methods
- [x] Add unit tests for buff stacking logic (19 tests passing)

**Deliverable:** BuffService working with existing active_buffs table

**Files Created/Modified:**
- `web/prisma/schema.prisma` - Added source/category to active_buffs, added 3 new tables
- `web/src/lib/services/buff.service.ts` - New service with 10+ methods
- `web/src/lib/services/index.ts` - Added BuffService export
- `web/prisma/seed-consumables.ts` - Standalone seed script for consumable_types
- `web/src/lib/services/__tests__/buff.service.test.ts` - 19 unit tests

### Phase 2: ConsumableService & API ✅ COMPLETE

**Tasks:**
- [x] Implement `ConsumableService` with all methods
- [x] Create `/api/shop/supplies` routes (GET catalog, POST purchase)
- [x] Integrate BuffService.applyBuff for duration buffs
- [x] Handle single-use consumable inventory (user_consumables table)
- [x] Add purchase transaction logic with Prisma.$transaction
- [x] Unit tests for purchase flows (31 tests)

**Deliverable:** Supply Depot purchasable via API

**Files Created/Modified:**
- `web/src/lib/services/consumable.service.ts` - Full service with 10+ methods
- `web/src/app/api/shop/supplies/*` - 4 API routes
- `web/src/lib/services/__tests__/consumable.service.test.ts` - 31 unit tests
- `web/src/lib/services/index.ts` - Added export

**ConsumableService Methods to Implement:**
```typescript
// web/src/lib/services/consumable.service.ts
ConsumableService = {
  getCatalog()                    // Get all active consumable_types
  getUserInventory(userId)        // Get user's single-use items from user_consumables
  purchase(userId, consumableId)  // Main purchase flow:
                                  //   - Check wealth
                                  //   - For duration buffs: call BuffService.applyBuff
                                  //   - For single-use: add to user_consumables (check max_owned)
                                  //   - Deduct wealth
                                  //   - Log to consumable_purchases
  useConsumable(userId, consumableId)  // Consume single-use item (decrement quantity)
  canPurchase(userId, consumableId)    // Pre-check for UI (wealth + max_owned check)
}
```

**API Routes to Create:**
```
GET  /api/shop/supplies           - List all consumable types
GET  /api/shop/supplies/inventory - Get user's owned single-use items
POST /api/shop/supplies/purchase  - Buy a consumable { consumableId: string }
POST /api/shop/supplies/use       - Use a single-use item { consumableId: string }
```

### Phase 3: Service Integrations ✅ COMPLETE

**Tasks:**
- [x] Integrate BuffService.getMultiplier into PlayService
- [x] Integrate BuffService.getMultiplier into RobService
- [x] Integrate BuffService.getMultiplier into BusinessService
- [x] Add bail_bond check to JailService
- [x] Add reroll_token check to ShopService
- [x] Add crate_magnet check to PlayService (crate drops happen in PlayService)
- [ ] Integration tests (deferred to Phase 6)

**Deliverable:** Consumable buffs affect gameplay

**Files Modified:**
- `web/src/lib/services/play.service.ts` - Added xp_multiplier, wealth_gain, crate_drop buffs + crate_magnet consumable
- `web/src/lib/services/rob.service.ts` - Added rob_attack, rob_defense buffs to success rate calculation
- `web/src/lib/services/business.service.ts` - Added business_revenue buff to collectRevenue
- `web/src/lib/services/jail.service.ts` - Added bail_bond consumable check in payBail
- `web/src/lib/services/shop.service.ts` - Added reroll_token consumable check in rerollShop

**Implementation Guide:**

#### 1. PlayService Integration (`web/src/lib/services/play.service.ts`)
Add buff multipliers to XP, wealth, and crate drop calculations:
```typescript
import { BuffService } from './buff.service'

// In the play() method, after calculating base rewards:
const xpMultiplier = await BuffService.getMultiplier(userId, 'xp_multiplier')
const wealthMultiplier = await BuffService.getMultiplier(userId, 'wealth_gain')
const crateDropMultiplier = await BuffService.getMultiplier(userId, 'crate_drop')

// Apply multipliers
finalXp = Math.floor(baseXp * xpMultiplier)
finalWealth = Math.floor(baseWealth * wealthMultiplier)
crateChance = baseCrateChance * crateDropMultiplier
```

#### 2. RobService Integration (`web/src/lib/services/rob.service.ts`)
Add attack/defense multipliers to success rate calculation:
```typescript
import { BuffService } from './buff.service'

// Get attacker's attack buff and defender's defense buff
const attackMultiplier = await BuffService.getMultiplier(attackerId, 'rob_attack')
const defenseMultiplier = await BuffService.getMultiplier(defenderId, 'rob_defense')

// Apply to success calculation (existing formula)
const buffedSuccessRate = baseSuccessRate * attackMultiplier / defenseMultiplier
```

#### 3. BusinessService Integration (`web/src/lib/services/business.service.ts`)
Add revenue multiplier to business collection:
```typescript
import { BuffService } from './buff.service'

// In collectRevenue():
const revenueMultiplier = await BuffService.getMultiplier(userId, 'business_revenue')
finalRevenue = Math.floor(baseRevenue * revenueMultiplier)
```

#### 4. JailService - bail_bond (`web/src/lib/services/jail.service.ts`)
Check for bail_bond consumable to skip bail cost:
```typescript
import { ConsumableService } from './consumable.service'

// In bail() method:
const hasBailBond = await ConsumableService.hasConsumable(userId, 'bail_bond')
if (hasBailBond) {
  await ConsumableService.useConsumable(userId, 'bail_bond')
  // Skip bail cost deduction
  bailCost = 0
}
```

#### 5. ShopService - reroll_token (`web/src/lib/services/shop.service.ts`)
Check for reroll_token to get free shop reroll:
```typescript
import { ConsumableService } from './consumable.service'

// In rerollShop() method:
const hasRerollToken = await ConsumableService.hasConsumable(userId, 'reroll_token')
if (hasRerollToken) {
  await ConsumableService.useConsumable(userId, 'reroll_token')
  // Skip reroll cost
}
```

#### 6. CrateService - crate_magnet (`web/src/lib/services/crate.service.ts`)
Check for crate_magnet to guarantee crate drop:
```typescript
import { ConsumableService } from './consumable.service'

// In crate drop check:
const hasCrateMagnet = await ConsumableService.hasConsumable(userId, 'crate_magnet')
if (hasCrateMagnet) {
  // Guarantee at least 50% drop chance
  if (Math.random() < 0.5) {
    await ConsumableService.useConsumable(userId, 'crate_magnet')
    // Award crate
  }
}
```

**Files to Modify:**
- `web/src/lib/services/play.service.ts`
- `web/src/lib/services/rob.service.ts`
- `web/src/lib/services/business.service.ts`
- `web/src/lib/services/jail.service.ts`
- `web/src/lib/services/shop.service.ts`
- `web/src/lib/services/crate.service.ts`

**Testing Approach:**
- Add integration tests that verify buff multipliers affect actual rewards
- Test bail_bond skips bail cost
- Test reroll_token provides free reroll
- Test crate_magnet increases drop chance

### Phase 4: Stream Actions Core ✅ COMPLETE

**Tasks:**
- [x] Create stream action tables migration (3 tables: stream_action_types, stream_action_usage, stream_action_cooldowns)
- [x] Run seed data for stream_action_types (11 initial actions)
- [x] Implement `TTSSanitizer` utility (30 unit tests)
- [x] Implement `StreamActionService` core methods
- [x] Create Lumia Stream webhook integration (stubbed)
- [x] Implement cooldown tracking (global per-action)
- [x] Create `/api/shop/stream-actions` routes

**Deliverable:** Stream actions purchasable (without queue)

**Implementation Guide:**

#### Step 1: Database Migration

Add these tables to `web/prisma/schema.prisma`:

```prisma
model stream_action_types {
  id                String   @id @db.VarChar(50)
  name              String   @db.VarChar(100)
  description       String?  @db.Text
  category          String   @db.VarChar(50)  // 'lights', 'fog', 'sound', 'tts'
  cost              Int
  cooldown_seconds  Int
  limit_per_stream  Int?
  lumia_command_id  String?  @db.VarChar(100)
  queue_behavior    String   @default("overwrite") @db.VarChar(20)  // 'overwrite' | 'queue'
  max_characters    Int?     // For TTS actions
  is_active         Boolean  @default(true)
  sort_order        Int      @default(0)
  created_at        DateTime @default(now())

  stream_action_usage     stream_action_usage[]
  stream_action_cooldowns stream_action_cooldowns?
}

model stream_action_usage {
  id           Int       @id @default(autoincrement())
  session_id   Int?
  user_id      Int
  action_id    String    @db.VarChar(50)
  cost         Int
  payload      Json?     // TTS text, color values, etc.
  status       String    @default("pending") @db.VarChar(20)  // 'pending', 'processing', 'completed', 'failed', 'overwritten'
  error_message String?  @db.Text
  triggered_at DateTime  @default(now())
  completed_at DateTime?

  users               users                @relation(fields: [user_id], references: [id])
  streaming_sessions  streaming_sessions?  @relation(fields: [session_id], references: [id])
  stream_action_types stream_action_types  @relation(fields: [action_id], references: [id])

  @@index([session_id])
  @@index([user_id])
}

model stream_action_cooldowns {
  id         Int      @id @default(autoincrement())
  action_id  String   @unique @db.VarChar(50)
  expires_at DateTime

  stream_action_types stream_action_types @relation(fields: [action_id], references: [id])
}
```

Then run: `npx prisma db push`

#### Step 2: Seed Stream Action Types

Create `web/prisma/seed-stream-actions.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STREAM_ACTIONS = [
  // Lights & Ambiance
  { id: 'color_shift', name: 'Color Shift', category: 'lights', cost: 10000, cooldown_seconds: 120, lumia_command_id: 'color_shift', description: 'Change stream light color', sort_order: 1 },
  { id: 'flash_pulse', name: 'Flash Pulse', category: 'lights', cost: 15000, cooldown_seconds: 180, lumia_command_id: 'flash_pulse', description: 'Quick light flash effect', sort_order: 2 },
  { id: 'rainbow_cycle', name: 'Rainbow Cycle', category: 'lights', cost: 25000, cooldown_seconds: 600, limit_per_stream: 10, lumia_command_id: 'rainbow', description: '10-second rainbow lights', sort_order: 3 },
  { id: 'blackout', name: 'Blackout', category: 'lights', cost: 50000, cooldown_seconds: 1800, limit_per_stream: 3, lumia_command_id: 'blackout', description: 'Lights off for 5 seconds', sort_order: 4 },

  // Fog & Effects
  { id: 'fog_burst', name: 'Fog Burst', category: 'fog', cost: 25000, cooldown_seconds: 300, lumia_command_id: 'fog_burst', description: 'Single fog machine burst', sort_order: 10 },
  { id: 'fog_wave', name: 'Fog Wave', category: 'fog', cost: 75000, cooldown_seconds: 900, limit_per_stream: 5, lumia_command_id: 'fog_wave', description: '10-second continuous fog', sort_order: 11 },
  { id: 'atmosphere', name: 'The Atmosphere', category: 'fog', cost: 150000, cooldown_seconds: 3600, limit_per_stream: 2, lumia_command_id: 'atmosphere', description: 'Fog + dim lights combo', sort_order: 12 },

  // Sound & Voice
  { id: 'sound_alert', name: 'Sound Alert', category: 'sound', cost: 20000, cooldown_seconds: 180, lumia_command_id: 'sound_alert', queue_behavior: 'queue', description: 'Play sound from approved list', sort_order: 20 },
  { id: 'tts_short', name: 'TTS Short', category: 'tts', cost: 35000, cooldown_seconds: 300, lumia_command_id: 'tts', queue_behavior: 'queue', max_characters: 50, description: 'Text-to-speech (50 chars)', sort_order: 21 },
  { id: 'tts_long', name: 'TTS Long', category: 'tts', cost: 60000, cooldown_seconds: 300, lumia_command_id: 'tts', queue_behavior: 'queue', max_characters: 100, description: 'Text-to-speech (100 chars)', sort_order: 22 },
  { id: 'tts_premium', name: 'TTS Premium', category: 'tts', cost: 100000, cooldown_seconds: 600, limit_per_stream: 10, lumia_command_id: 'tts', queue_behavior: 'queue', max_characters: 200, description: 'Text-to-speech (200 chars)', sort_order: 23 },
]

async function main() {
  for (const action of STREAM_ACTIONS) {
    await prisma.stream_action_types.upsert({
      where: { id: action.id },
      update: action,
      create: action,
    })
  }
  console.log(`Seeded ${STREAM_ACTIONS.length} stream action types`)
}

main()
```

Run: `npx tsx web/prisma/seed-stream-actions.ts`

#### Step 3: Create TTSSanitizer

Create `web/src/lib/services/tts-sanitizer.ts`:

```typescript
export interface SanitizeResult {
  valid: boolean
  sanitized: string
  rejectionReason?: string
}

// Blocklist patterns (customize as needed)
const BLOCKLIST_PATTERNS = [
  /\b(fuck|shit|bitch|ass|damn|cunt|cock|dick|pussy)\b/gi,
  // Add more patterns as needed
]

// Repetition patterns (spam detection)
const REPETITION_THRESHOLD = 4  // More than 4 repeated chars in a row

export const TTSSanitizer = {
  sanitize(input: string, maxLength: number): SanitizeResult {
    // 1. Empty check
    if (!input || input.trim().length === 0) {
      return { valid: false, sanitized: '', rejectionReason: 'Empty message' }
    }

    let text = input.trim()

    // 2. Length check
    if (text.length > maxLength) {
      text = text.slice(0, maxLength)
    }

    // 3. Blocklist check
    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(text)) {
        return { valid: false, sanitized: '', rejectionReason: 'Contains blocked words' }
      }
    }

    // 4. Repetition check (e.g., "aaaaaa", "!!!!!", "777777")
    const repetitionRegex = new RegExp(`(.)\\1{${REPETITION_THRESHOLD},}`, 'g')
    if (repetitionRegex.test(text)) {
      return { valid: false, sanitized: '', rejectionReason: 'Excessive character repetition' }
    }

    // 5. Phonetic spam patterns (TTS exploits)
    const phoneticSpam = [
      /\b(soi\s*)+/gi,
      /\b(fuh\s*)+/gi,
      /\b([a-z])\1{3,}\b/gi,  // Repeated letters in words
    ]
    for (const pattern of phoneticSpam) {
      if (pattern.test(text)) {
        return { valid: false, sanitized: '', rejectionReason: 'Phonetic spam detected' }
      }
    }

    // 6. Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim()

    return { valid: true, sanitized: text }
  },
}
```

#### Step 4: Create StreamActionService

Create `web/src/lib/services/stream-action.service.ts` with these methods:
- `getAvailableActions()` - Get all active stream actions
- `canTrigger(actionId)` - Check cooldown, limits, stream status
- `trigger(userId, actionId, payload?)` - Execute action
- `getCooldownStatus(actionId)` - Get remaining cooldown
- `getUserHistory(userId, sessionId?)` - Get user's action history

#### Step 5: Create API Routes

```
GET  /api/shop/stream-actions           - List actions + availability status
POST /api/shop/stream-actions/trigger   - Trigger an action
GET  /api/shop/stream-actions/history   - User's action history
```

**Files to Create:**
- `web/src/lib/services/tts-sanitizer.ts`
- `web/src/lib/services/stream-action.service.ts`
- `web/src/app/api/shop/stream-actions/route.ts`
- `web/src/app/api/shop/stream-actions/trigger/route.ts`
- `web/src/app/api/shop/stream-actions/history/route.ts`
- `web/prisma/seed-stream-actions.ts`

**Files to Modify:**
- `web/prisma/schema.prisma` - Add 3 new tables
- `web/src/lib/services/index.ts` - Export new services

### Phase 5: Stream Action Queue & Polish ✅ COMPLETE

**Tasks:**
- [x] Implement database-based queue for audio actions (DB fallback approach)
- [x] Add queue worker/processor methods
- [x] Stream live detection (already implemented in Phase 4)
- [x] Add Lumia health check with caching
- [x] Handle overwrite logic for visual actions
- [x] Error handling and refund logic

**Deliverable:** Full stream action system working

**Implementation Guide:**

#### Step 1: Audio Queue System

For TTS and sound actions (queue_behavior = 'queue'), implement a queue system:

**Option A: Redis Queue (Recommended for Railway)**
```typescript
// web/src/lib/services/stream-action-queue.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export const StreamActionQueue = {
  async enqueue(usageId: number, actionId: string, payload: object): Promise<number> {
    const queueKey = 'stream:audio:queue'
    const position = await redis.rpush(queueKey, JSON.stringify({ usageId, actionId, payload, enqueuedAt: Date.now() }))
    return position
  },

  async dequeue(): Promise<QueuedAction | null> {
    const item = await redis.lpop('stream:audio:queue')
    return item ? JSON.parse(item) : null
  },

  async getPosition(usageId: number): Promise<number> {
    const items = await redis.lrange('stream:audio:queue', 0, -1)
    return items.findIndex(item => JSON.parse(item).usageId === usageId) + 1
  },

  async getQueueLength(): Promise<number> {
    return redis.llen('stream:audio:queue')
  }
}
```

**Option B: Database Fallback (MVP)**
Use the existing `stream_action_usage` table with status='pending' as a queue:
```typescript
// Query pending audio actions ordered by triggered_at
const queue = await prisma.stream_action_usage.findMany({
  where: {
    status: 'pending',
    stream_action_types: { queue_behavior: 'queue' }
  },
  orderBy: { triggered_at: 'asc' }
})
```

#### Step 2: Queue Worker

Create a background processor that runs every 5-10 seconds:

```typescript
// web/src/lib/workers/audio-queue-worker.ts
export async function processAudioQueue(): Promise<void> {
  // 1. Check if currently playing audio (track in Redis/memory)
  // 2. If not playing, dequeue next item
  // 3. Send to Lumia
  // 4. Mark as 'processing', wait for completion callback
  // 5. Mark as 'completed'
}
```

#### Step 3: Overwrite Logic for Visual Actions

For lights/fog actions (queue_behavior = 'overwrite'):

```typescript
// In StreamActionService.trigger(), before creating new usage:
if (action.queueBehavior === 'overwrite') {
  // Mark any pending/processing visual actions as 'overwritten'
  await tx.stream_action_usage.updateMany({
    where: {
      session_id: session.id,
      status: { in: ['pending', 'processing'] },
      stream_action_types: { queue_behavior: 'overwrite' }
    },
    data: { status: 'overwritten' }
  })
}
```

#### Step 4: Lumia Health Check

```typescript
// web/src/lib/services/lumia.service.ts - Add to existing service
async checkHealth(): Promise<{ online: boolean; latency?: number }> {
  const healthUrl = process.env.LUMIA_HEALTH_URL
  if (!healthUrl) return { online: true } // Assume online if not configured

  const start = Date.now()
  try {
    const response = await fetch(healthUrl, { timeout: 5000 })
    return { online: response.ok, latency: Date.now() - start }
  } catch {
    return { online: false }
  }
}
```

#### Step 5: Error Handling & Refunds

```typescript
// Add to StreamActionService
async handleFailedAction(usageId: number, error: string): Promise<void> {
  const usage = await prisma.stream_action_usage.findUnique({
    where: { id: usageId },
    include: { users: true }
  })

  if (!usage) return

  await prisma.$transaction([
    // Mark as failed
    prisma.stream_action_usage.update({
      where: { id: usageId },
      data: { status: 'failed', error_message: error }
    }),
    // Refund wealth
    prisma.users.update({
      where: { id: usage.user_id },
      data: { wealth: { increment: usage.cost } }
    })
  ])
}
```

**Files to Create:**
- `web/src/lib/services/stream-action-queue.ts` - Queue management
- `web/src/lib/workers/audio-queue-worker.ts` - Background processor

**Files to Modify:**
- `web/src/lib/services/stream-action.service.ts` - Add overwrite logic, health checks
- `web/src/lib/services/lumia.service.ts` - Add health check method

**Environment Variables:**
```env
REDIS_URL=redis://localhost:6379  # Or Railway Redis URL
LUMIA_HEALTH_URL=<health_endpoint>
LUMIA_WEBHOOK_STREAM_ACTION=<webhook_url>
```

### Phase 6: Admin & Chat Commands ✅ COMPLETE

**Tasks:**
- [x] Create `/api/admin/stream-actions` CRUD routes
- [ ] Create `/api/admin/consumables` CRUD routes (optional - deferred)
- [x] Add `!buffs` chat command - show active buffs with time remaining
- [x] Add `!supplies` chat command - show purchasable consumables
- [x] Add buff status section to `!stats` output
- [x] Add buff expiry warning to `!play` output (buffs expiring within 1 hour)
- [x] Add cron job for audio queue processing

**Deliverable:** Admin management and chat integration

**Implementation Guide:**

#### Step 1: Admin Routes for Stream Actions

Create `web/src/app/api/admin/stream-actions/route.ts`:
```typescript
// GET - List all stream actions (including inactive)
// POST - Create new stream action
```

Create `web/src/app/api/admin/stream-actions/[id]/route.ts`:
```typescript
// GET - Get single action details
// PATCH - Update action properties
// DELETE - Soft delete (set is_active = false)
```

**Admin Route Protection:**
- Check for admin role in session
- Return 403 if not authorized

#### Step 2: Chat Commands

**!buffs Command:**
```
Usage: !buffs
Output:
🔥 Active Buffs:
• XP Boost +50% (14h 32m remaining)
• Rob Attack +10% (2h 15m remaining)
No active buffs? Use !supplies to browse boosters!
```

**!supplies Command:**
```
Usage: !supplies [category]
Categories: xp, combat, economy, utility
Output:
📦 Supply Depot - XP Boosters:
• XP Chip (+25% XP) - $25,000
• Neural Enhancer (+50% XP) - $50,000
• Cognitive Overclock (+100% XP) - $100,000
Buy with: !buy <item_id>
```

**!stats Integration:**
Add buff section after existing stats output.

#### Step 3: Buff Expiry Warnings

In `PlayService.play()` result, add:
```typescript
expiringBuffs: Array<{
  buffType: string
  remainingMinutes: number
}>
```

Only include buffs expiring within 60 minutes.

#### Step 4: Audio Queue Cron Job

Create Vercel cron or Railway cron that calls:
```
POST /api/shop/stream-actions/queue
Authorization: Bearer <CRON_SECRET>
```

Run every 5-10 seconds during active streams.

**Files to Create:**
- `web/src/app/api/admin/stream-actions/route.ts`
- `web/src/app/api/admin/stream-actions/[id]/route.ts`
- Bot command handlers (location depends on bot architecture)

**Files to Modify:**
- `web/src/lib/services/play.service.ts` - Add expiring buffs to result
- Bot command registry - Add !buffs, !supplies commands
- `!stats` command - Add buff section

---

## TESTING CHECKLIST

### Unit Tests
- [x] BuffService.getMultiplier stacking logic (6 tests)
- [x] BuffService.applyBuff upgrade/extension logic (4 tests)
- [x] BuffService.hasBuff and cleanup methods (5 tests)
- [x] BuffService.getActiveBuffs formatting (2 tests)
- [x] Stacking formula verification (2 tests)
- [x] ConsumableService.getCatalog and getUserInventory (4 tests)
- [x] ConsumableService.hasConsumable and getConsumableCount (5 tests)
- [x] ConsumableService.canPurchase validation (4 tests)
- [x] ConsumableService.purchase duration buffs (2 tests)
- [x] ConsumableService.purchase single-use items (2 tests)
- [x] ConsumableService.useConsumable (4 tests)
- [x] ConsumableService.getTotalSpent (2 tests)
- [x] ConsumableService helper methods (8 tests)
- [x] TTSSanitizer all filter rules (30 tests)
- [ ] StreamActionService.canTrigger cooldown logic

### Integration Tests
- [ ] Purchase consumable → buff appears in active_buffs
- [ ] Buff multiplier applies to !play rewards
- [ ] Same-category buff replacement works
- [ ] Single-use consumable quantity tracking
- [ ] Stream action triggers Lumia webhook

### E2E Tests
- [ ] Full purchase flow via API
- [ ] Buff expiry cleanup
- [ ] Stream action cooldown enforcement
- [ ] TTS rejection for spam patterns

---

## ENVIRONMENT VARIABLES

```env
# Lumia Stream Integration
LUMIA_API_URL=https://api.lumiastream.com
LUMIA_API_TOKEN=your_token_here

# Redis (for stream action queue)
REDIS_URL=redis://localhost:6379

# Feature Flags
ENABLE_SUPPLY_DEPOT=true
ENABLE_STREAM_ACTIONS=true
```

---

## ROLLBACK PLAN

If issues arise:

1. **Disable via feature flags** - Set `ENABLE_*` to false
2. **Database rollback** - Migration down scripts prepared
3. **Service isolation** - New services don't affect existing shop

---

## PROGRESS LOG

### Session 1 (Dec 16, 2024) - Phase 1 Complete

**Consensus Review:**
- gemini-2.5-flash (9/10 confidence): Endorsed architecture, recommended Crate Magnet safeguards
- Other models rate-limited, proceeded with gemini analysis

**Completed:**
1. Schema changes pushed to Neon database via `prisma db push`
2. BuffService implemented with full stacking logic:
   - `Final = consumable * territory * juicernaut`
   - Same-category: highest wins
   - Upgrade/extension/reject-downgrade logic
3. 16 consumable types seeded (3 XP, 4 combat, 6 economy, 3 utility)
4. 19 unit tests all passing

**Key Decisions Made:**
- Used plain number values in mocks (not Decimal objects) for test compatibility
- Created standalone `seed-consumables.ts` (main seed.ts has naming mismatches with regenerated client)
- Buffs use `Number(buff.multiplier)` for Prisma Decimal conversion

**Next Session:** Begin Phase 2 - ConsumableService & API routes

### Session 2 (Dec 16, 2024) - Phase 2 Complete

**Completed:**
1. `ConsumableService` implemented with full purchase and usage logic:
   - `getCatalog()` - Get all active consumable types
   - `getUserInventory()` - Get user's single-use items
   - `hasConsumable()` / `getConsumableCount()` - Inventory checks
   - `canPurchase()` - Pre-check for UI (wealth + max_owned)
   - `purchase()` - Main purchase flow with transaction
   - `useConsumable()` - Decrement single-use item quantity
   - `getPurchaseHistory()` / `getTotalSpent()` - Statistics

2. API Routes created:
   - `GET /api/shop/supplies` - Catalog with user buffs & inventory
   - `GET /api/shop/supplies/inventory` - User's single-use items
   - `POST /api/shop/supplies/purchase` - Buy consumable
   - `POST /api/shop/supplies/use` - Use single-use item

3. 31 unit tests all passing covering:
   - Catalog retrieval and ordering
   - User inventory management
   - Purchase validation (wealth, max_owned)
   - Duration buff purchase + BuffService integration
   - Single-use item purchase and increment
   - Consumable usage and decrement
   - Helper method mapping

**Files Created:**
- `web/src/lib/services/consumable.service.ts` - ConsumableService
- `web/src/app/api/shop/supplies/route.ts` - GET catalog
- `web/src/app/api/shop/supplies/inventory/route.ts` - GET inventory
- `web/src/app/api/shop/supplies/purchase/route.ts` - POST purchase
- `web/src/app/api/shop/supplies/use/route.ts` - POST use
- `web/src/lib/services/__tests__/consumable.service.test.ts` - 31 tests

**Files Modified:**
- `web/src/lib/services/index.ts` - Added ConsumableService export

### Session 3 (Dec 16, 2024) - Phase 3 Complete

**Completed:**
1. **PlayService Integration:**
   - Added BuffService import and ConsumableService import
   - Get xp_multiplier, wealth_gain, crate_drop multipliers in parallel
   - Apply consumable buffs BEFORE Juicernaut/faction buffs
   - Added consumableBuffBonuses to PlayResult for reporting
   - Added crate_magnet consumable check (50% trigger chance → guaranteed drop)
   - Added usedCrateMagnet to PlayResult

2. **RobService Integration:**
   - Get rob_attack for attacker and rob_defense for defender
   - Apply as: `successRate = baseRate * attackMultiplier / defenseMultiplier`
   - Capped at 0.05 min and 0.95 max

3. **BusinessService Integration:**
   - Get business_revenue multiplier in collectRevenue()
   - Apply to net revenue after operating costs

4. **JailService - bail_bond:**
   - Check for bail_bond consumable in payBail()
   - If present, use it and set actualCost = 0
   - Added usedBailBond to BailResult

5. **ShopService - reroll_token:**
   - Check for reroll_token consumable in rerollShop()
   - If present, use it (infrastructure ready for when reroll costs added)
   - Added usedRerollToken to return type

**Key Design Decisions:**
- crate_magnet implemented in PlayService (not CrateService) since crate drops happen during play
- Consumable buffs apply BEFORE existing Juicernaut/faction buffs (proper stacking order)
- Rob buffs use multiplicative formula with floor/ceiling caps

**Files Modified:**
- `web/src/lib/services/play.service.ts`
- `web/src/lib/services/rob.service.ts`
- `web/src/lib/services/business.service.ts`
- `web/src/lib/services/jail.service.ts`
- `web/src/lib/services/shop.service.ts`

---

## PHASE 6 QUICK START (Next Conversation)

**Command to resume:** "Continue Phase 6 of shop expansion from SHOP_EXPANSION_IMPLEMENTATION.md"

**What's done (Phases 1-5):**
- ✅ Database schema (6 new tables: consumable_types, user_consumables, consumable_purchases, stream_action_types, stream_action_usage, stream_action_cooldowns)
- ✅ BuffService (stacking logic, apply/upgrade/extend, cleanup) - 19 tests
- ✅ ConsumableService (purchase, use, inventory, catalog) - 31 tests
- ✅ API routes (`/api/shop/supplies/*`) - 4 endpoints
- ✅ Service integrations (PlayService, RobService, BusinessService, JailService, ShopService)
- ✅ TTSSanitizer (blocklist, repetition, phonetic spam, URLs, caps) - 30 tests
- ✅ StreamActionService (catalog, trigger, cooldowns, limits, history, analytics, queue, overwrite, refunds)
- ✅ API routes (`/api/shop/stream-actions/*`) - 4 endpoints (including queue)
- ✅ LumiaService health check + stream action commands
- ✅ Seed data: 16 consumables + 11 stream actions
- ✅ **180 total tests passing**

**Current State (Phase 5 Complete):**
- Stream actions fully functional with queue system
- Visual actions (lights/fog) execute immediately with overwrite logic
- Audio actions (TTS/sounds) queue for processing via cron
- Lumia health check integrated (cached 30 seconds)
- Error handling with automatic refunds
- Usage history and analytics available

**What's missing (Phase 6 scope):**
1. Admin CRUD routes for stream action management
2. `!buffs` chat command - show active buffs with remaining time
3. `!supplies` chat command - show purchasable consumables
4. Buff status section in `!stats` output
5. Buff expiry warnings in `!play` output
6. Audio queue cron job setup

---

### Phase 6 Implementation Order

**Recommended order (start with highest value):**

1. **Admin Routes** (enables content management without deploys)
   - `GET/POST /api/admin/stream-actions`
   - `GET/PATCH/DELETE /api/admin/stream-actions/[id]`
   - Check existing admin patterns in codebase

2. **Chat Commands** (user-facing features)
   - Find bot command handler location first
   - `!buffs` → calls `BuffService.getActiveBuffs(userId)`
   - `!supplies` → calls `ConsumableService.getCatalog()`
   - `!buy <id>` → calls `ConsumableService.purchase(userId, id)`

3. **Buff Expiry Warnings** (quality of life)
   - Modify `PlayService.play()` return type
   - Add `getExpiringBuffs()` method to BuffService
   - Bot formats warning in play response

4. **Cron Job** (production requirement)
   - Vercel: `vercel.json` cron config
   - Railway: Scheduled task
   - Calls `POST /api/shop/stream-actions/queue` with CRON_SECRET

---

### Key Services to Use

| Feature | Service | Method |
|---------|---------|--------|
| Show active buffs | BuffService | `getActiveBuffs(userId)` |
| Show consumable catalog | ConsumableService | `getCatalog()` |
| Purchase consumable | ConsumableService | `purchase(userId, consumableId)` |
| User's single-use inventory | ConsumableService | `getUserInventory(userId)` |
| Process audio queue | StreamActionService | `processAudioQueue()` |
| Get expiring buffs | BuffService | Need to add `getExpiringBuffs(userId, withinMinutes)` |

---

### Environment Variables (Already Set)
```env
LUMIA_API_URL=https://api.lumiastream.com
LUMIA_API_TOKEN=your_token_here
LUMIA_WEBHOOK_STREAM_ACTION=<webhook_url>
LUMIA_HEALTH_URL=<health_endpoint>  # Optional - assumes online if not set
CRON_SECRET=<secret_for_queue_cron>
```

---

### Files to Reference

**Service Implementations:**
- `web/src/lib/services/buff.service.ts` - Buff management
- `web/src/lib/services/consumable.service.ts` - Consumable purchase/use
- `web/src/lib/services/stream-action.service.ts` - Stream actions + queue

**Existing API Patterns:**
- `web/src/app/api/shop/supplies/route.ts` - GET catalog pattern
- `web/src/app/api/shop/stream-actions/trigger/route.ts` - POST with auth pattern

**Existing Admin Routes (for pattern reference):**
- Check `web/src/app/api/admin/` for existing admin route patterns

### Session 4 (Dec 16, 2024) - Phase 4 Complete

**Completed:**
1. **Database Schema:**
   - Added 3 new tables to `schema.prisma`:
     - `stream_action_types` - Catalog of available stream actions
     - `stream_action_usage` - History/audit trail per user per session
     - `stream_action_cooldowns` - Global cooldown tracking per action
   - Added relations to `users` and `streaming_sessions`
   - Ran `prisma db push` successfully

2. **Seed Data:**
   - Created `seed-stream-actions.ts` with 11 initial actions:
     - Lights: color_shift, flash_pulse, rainbow_cycle, blackout
     - Fog: fog_burst, fog_wave, atmosphere
     - Sound/TTS: sound_alert, tts_short, tts_long, tts_premium
   - Uses Neon adapter pattern from existing seed scripts

3. **TTSSanitizer Utility:**
   - Blocklist filtering (profanity, slurs, dangerous phrases)
   - Repetition detection (>4 consecutive chars)
   - Phonetic spam patterns (soi soi, uwu, etc.)
   - URL detection and rejection
   - Excessive caps detection (>80% caps on long messages)
   - Whitespace normalization
   - Length truncation
   - 30 unit tests all passing

4. **StreamActionService:**
   - `getAvailableActions()` - Get catalog with category grouping
   - `getAction(actionId)` - Get single action details
   - `isStreamLive()` - Check if streaming session active
   - `getCurrentSession()` - Get active session ID
   - `getCooldownStatus(actionId)` - Check remaining cooldown
   - `getUsageThisStream(actionId, sessionId)` - Count for limits
   - `canTrigger(actionId, userId, payload)` - Full availability check
   - `trigger(userId, actionId, payload)` - Execute action with transaction
   - `triggerLumiaCommand()` - Webhook stub for Lumia integration
   - `getUserHistory(userId, sessionId, limit)` - User's action history
   - `getAllActionStatus(userId)` - All actions availability map
   - `cleanupExpiredCooldowns()` - Maintenance method
   - `getSessionAnalytics(sessionId)` - Analytics aggregation

5. **API Routes:**
   - `GET /api/shop/stream-actions` - Catalog with user-specific availability
   - `POST /api/shop/stream-actions/trigger` - Trigger action
   - `GET /api/shop/stream-actions/history` - User's action history

6. **Exports:**
   - Added `StreamActionService` and `TTSSanitizer` to `services/index.ts`

**Files Created:**
- `web/prisma/seed-stream-actions.ts`
- `web/src/lib/services/tts-sanitizer.ts`
- `web/src/lib/services/stream-action.service.ts`
- `web/src/app/api/shop/stream-actions/route.ts`
- `web/src/app/api/shop/stream-actions/trigger/route.ts`
- `web/src/app/api/shop/stream-actions/history/route.ts`
- `web/src/lib/services/__tests__/tts-sanitizer.test.ts`

**Files Modified:**
- `web/prisma/schema.prisma` - Added 3 new tables + relations
- `web/src/lib/services/index.ts` - Added exports

**Key Design Decisions:**
- Cooldowns are global per-action (not per-user) as per spec
- Usage limits are per-stream-session
- TTS validation happens before wealth deduction
- Lumia integration uses webhook pattern (stubbed for now)
- Prisma transaction ensures atomic wealth deduction + usage logging

**Next Session:** Phase 6 - Admin & Chat Commands

### Session 5 (Dec 16, 2024) - Phase 5 Complete

**Completed:**
1. **LumiaService Health Check:**
   - Added `checkStreamActionHealth()` with 30-second caching
   - Added `isStreamActionOnline()` quick check
   - Added stream action command methods: `sendTTS()`, `sendLights()`, `sendFog()`, `sendSound()`
   - Bearer token authentication support

2. **StreamActionService Queue System:**
   - `isAudioProcessing()` - Check if audio is currently playing
   - `getNextAudioInQueue()` - Get next pending audio action
   - `getAudioQueueLength()` - Get queue length for display
   - `processAudioQueue()` - Process next audio action (for cron)
   - `cancelPendingAudioQueue()` - Cancel and refund all pending when stream ends
   - `getQueueStatus()` - Full queue status for display

3. **Overwrite Logic for Visual Actions:**
   - New visual action (lights/fog) marks pending visual actions as 'overwritten'
   - Implemented in `trigger()` transaction
   - Visual actions execute immediately via Lumia
   - Audio actions stay in queue for processing

4. **Error Handling with Refunds:**
   - `handleFailedAction()` - Mark as failed + refund wealth atomically
   - Prevents double-refunds via status checks
   - Visual action failures refund immediately
   - Audio action failures refund during queue processing

5. **Health Check Integration:**
   - `canTrigger()` now checks `LumiaService.isStreamActionOnline()`
   - Returns `lumia_offline` reason when Lumia unavailable
   - GET `/api/shop/stream-actions` includes `lumiaOnline` and `lumiaLatency`

6. **API Routes:**
   - `GET /api/shop/stream-actions/queue` - Get queue status
   - `POST /api/shop/stream-actions/queue` - Process queue (cron endpoint with CRON_SECRET auth)
   - Updated main route to include lumia health and queue status

**Files Modified:**
- `web/src/lib/services/lumia.service.ts` - Added health check + stream action commands
- `web/src/lib/services/stream-action.service.ts` - Added queue, overwrite, error handling
- `web/src/app/api/shop/stream-actions/route.ts` - Added lumia/queue status
- `web/src/app/api/shop/stream-actions/queue/route.ts` - New queue endpoint

**Environment Variables Added:**
```env
LUMIA_HEALTH_URL=<health_check_endpoint>  # Optional - assumes online if not set
CRON_SECRET=<secret_for_queue_cron>       # Required in production for queue endpoint
```

**Key Design Decisions:**
- Used database-based queue (Option B) instead of Redis for simpler MVP
- Visual actions execute immediately; audio actions queue for processing
- Overwrite logic only affects same-session visual actions
- Health check caches for 30 seconds to reduce latency
- Refunds are atomic with status updates to prevent double-refund

**Test Results:** 180 tests passing

### Session 6 (Dec 16, 2024) - Phase 6 Complete

**Completed:**
1. **Admin CRUD Routes for Stream Actions:**
   - `GET /api/admin/stream-actions` - List all actions (including inactive)
   - `POST /api/admin/stream-actions` - Create new action
   - `GET /api/admin/stream-actions/[id]` - Get action with usage stats
   - `PATCH /api/admin/stream-actions/[id]` - Update action
   - `DELETE /api/admin/stream-actions/[id]` - Soft delete (set is_active=false)
   - Uses x-api-key header authentication with ADMIN_API_KEY

2. **Bot Commands - Supply Depot:**
   - `!buffs` - Show active buffs with remaining time (aliases: mybuffs, activebuffs)
   - `!supplies [category]` - Browse consumable catalog (aliases: depot, supplydepot)
   - `!buysupply <id>` - Purchase consumable (aliases: buyboost, purchasesupply)
   - `!myitems` - Show owned single-use consumables (aliases: myconsumables, consumables)

3. **Profile Buff Integration:**
   - Added `formatBuffSummary()` to formatter
   - `!profile` now shows active buff summary for own profile
   - Format: `🔥 XP+50%, Wealth+25% +1`

4. **Play Result Expiring Buffs Warning:**
   - Added `expiringBuffs` to PlayResult interface
   - BuffService.getExpiringBuffs(userId, 60) called after successful play
   - Added `formatPlayResultWithBuffWarning()` to formatter
   - Warns when buffs expire within 60 minutes

5. **Cron Jobs:**
   - `/api/cron/audio-queue` - Process pending TTS/sounds (every minute)
     - Processes up to 5 audio items per run
     - Skips if stream is offline
   - `/api/cron/buff-cleanup` - Clean expired buffs and cooldowns (hourly)
   - Added both to vercel.json cron configuration

6. **API Client Updates:**
   - Added `getUserBuffs(userId)` method
   - Added `getSupplyCatalog()` method
   - Added `getUserSupplyInventory(userId)` method
   - Added `purchaseConsumable(userId, consumableId)` method
   - Added `expiringBuffs` to PlayResult interface

7. **New API Route:**
   - `GET /api/users/[userId]/buffs` - Get user's active buffs (for bot)

**Files Created:**
- `web/src/app/api/admin/stream-actions/route.ts` - Admin list/create
- `web/src/app/api/admin/stream-actions/[id]/route.ts` - Admin CRUD
- `web/src/app/api/users/[userId]/buffs/route.ts` - User buffs endpoint
- `web/src/app/api/cron/audio-queue/route.ts` - Audio queue cron
- `web/src/app/api/cron/buff-cleanup/route.ts` - Buff cleanup cron
- `bot/src/commands/supplies.ts` - Supply depot commands

**Files Modified:**
- `bot/src/api-client.ts` - Added supply/buff methods
- `bot/src/commands/index.ts` - Registered new commands
- `bot/src/commands/profile.ts` - Added buff summary to profile
- `bot/src/utils/formatter.ts` - Added buff formatters
- `web/src/lib/services/play.service.ts` - Added expiring buffs to result
- `web/vercel.json` - Added cron jobs

**Key Design Decisions:**
- Admin routes use x-api-key header (matches existing admin/give pattern)
- Bot commands use existing apiClient pattern
- Buff summary shows max 3 buffs with "+N more" count
- Expiring buff warnings only shown for buffs < 60 minutes remaining
- Audio queue processes up to 5 items per cron run (once per minute)

---

**Document Version:** 2.8
**Created:** December 2024
**Last Updated:** December 16, 2024
**Based On:** Consensus analysis from gemini-2.5-flash + architectural review
**Status:** Phase 6 Complete - Shop Expansion Implementation DONE

---

## QUICK REFERENCE - API Endpoints

### Supply Depot (Consumables)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shop/supplies` | Catalog + user buffs + inventory |
| GET | `/api/shop/supplies/inventory` | User's single-use items |
| POST | `/api/shop/supplies/purchase` | Buy consumable `{ consumableId }` |
| POST | `/api/shop/supplies/use` | Use single-use item `{ consumableId }` |

### Stream Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shop/stream-actions` | Catalog + availability + queue status |
| POST | `/api/shop/stream-actions/trigger` | Trigger action `{ actionId, payload? }` |
| GET | `/api/shop/stream-actions/history` | User's action history |
| GET | `/api/shop/stream-actions/queue` | Audio queue status |
| POST | `/api/shop/stream-actions/queue` | Process queue (cron, needs CRON_SECRET) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stream-actions` | All actions (including inactive) |
| POST | `/api/admin/stream-actions` | Create new action |
| GET | `/api/admin/stream-actions/[id]` | Action details + usage stats |
| PATCH | `/api/admin/stream-actions/[id]` | Update action |
| DELETE | `/api/admin/stream-actions/[id]` | Soft delete action |

### User Buffs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/[userId]/buffs` | User's active buffs + expiring |

### Cron Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cron/audio-queue` | Process TTS/sound queue (every minute) |
| POST | `/api/cron/buff-cleanup` | Clean expired buffs (hourly) |
