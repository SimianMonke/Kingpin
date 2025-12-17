# SHOP EXPANSION BOOTSTRAP (v1.2)

## Document Purpose

This document seeds a conversation to continue refining and implementing an expanded shop system for Kingpin. The goal is to enhance the existing Player Shop with two new subsystems:

1.  **Supply Depot** - Consumable stat-boost items
2.  **Stream Actions** - Real-world stream effect redemptions via Lumia Stream (Database-driven)

---

## PROJECT CONTEXT

### What is Kingpin?

Kingpin is a multi-platform chatbot RPG system for Kick/Twitch/Discord streams. It features:
-   Persistent player progression (levels, wealth, XP)
-   Economy gameplay (!play events, !rob PvP, businesses)
-   Faction warfare with territory control
-   Real-time donation competition (Juicernaut system)
-   Monetization tracking across platforms
-   90+ achievements, missions, crates/loot system

### Tech Stack
-   **Frontend + API**: Next.js 15 (App Router) on Vercel
-   **Database**: PostgreSQL on Neon (Prisma 6)
-   **Bot Runtime**: Node.js on Railway
-   **Stream Integration**: Lumia Stream webhooks
-   **Auth**: NextAuth.js (Kick, Twitch, Discord OAuth)

### Core Economic Loop
Channel Points → !play/!rob → Wealth + XP → Items/Progression ↓ Monetization → Juicernaut Buffs → Enhanced Rewards


---

## PROBLEM STATEMENT

### Current Wealth Sink Insufficiency

The game economy has these wealth sources (faucets):
-   !play events ($50 - $100,000 per play, tier-scaled)
-   Daily check-ins ($100 + milestone crates)
-   Business revenue ($200 - $5,000 every 2 hours)
-   Monetization rewards (subs, bits, donations)
-   Mission completion rewards
-   Juicernaut session rewards

Current wealth sinks are insufficient:
-   **Bail** (10% of wealth) - only affects jailed players
-   **Gambling losses** - voluntary, not all players participate
-   **Item purchases** - one-time, finite catalog
-   **Rob losses** - involuntary, housing insurance mitigates

**The Problem**: Once players reach Kingpin tier with all items, they accumulate wealth indefinitely with nothing to spend it on. This leads to:
-   Wealth hoarding at top tiers
-   Reduced engagement (no goals)
-   Hyperinflation pressure

### Solution: Recurring Wealth Sinks + Real-World Value

Two new shop subsystems address this:

1.  **Consumables (Supply Depot)** - Temporary stat buffs that expire, creating recurring purchases
2.  **Stream Actions** - Convert wealth to tangible stream effects, providing real-world value

---

## DESIGN DECISIONS MADE

### Consumables Philosophy

**DECIDED**: Consumables are **stat multipliers only**. They enhance existing mechanics without changing fundamental gameplay rules.

**DURATION LOGIC**:
-   **Real-Time (Wall Clock)**: Buffs last 24 hours from purchase time, regardless of whether the stream is live or the user is online.
-   **Expiry**: Passive notification (footer in !stats/!play) upon expiry. No active DMs.

**INCLUDED**: Pure stat boosts:
-   XP multipliers
-   Rob success/defense bonuses
-   Business revenue bonuses
-   Crate drop rate bonuses
-   Wealth gain bonuses
-   Single-use utility items (Bail Bond, Reroll Token, Crate Magnet)

### Stream Actions Philosophy

**DECIDED**: Stream actions provide tangible value for wealth, creating a reason to earn AND spend.

**DYNAMIC MANAGEMENT**:
-   Actions are defined in the database (`stream_action_types`), not hardcoded.
-   This allows adding/removing equipment (e.g., new fog machine) without redeploying code.
-   Actions can be "Soft Deleted" (toggled inactive) if equipment breaks mid-stream.

**QUEUEING LOGIC (Hybrid)**:
-   **Visuals (Lights/Fog)**: State-based. Do **not** queue. New actions overwrite/extend current state immediately to prevent backlog.
-   **Audio (TTS/SFX)**: Event-based. Must queue to prevent audio overlap.

**SAFETY LOGIC**:
-   **Availability**: Only purchasable when stream is detected LIVE.
-   **Validation**: "Ping-Check" against Lumia API before transaction processing.
-   **Filtering**: Strict pre-processing of TTS strings for abuse patterns (repeated chars, phonetic spam) before webhook dispatch.

---

## PROPOSED UNIFIED SHOP ARCHITECTURE

### Navigation Structure

KINGPIN SHOP (Unified) │ ├── 🏪 EQUIPMENT STORE (Current Player Shop - Enhanced) │ ├── Weapons, Armor, Businesses, Housing │ ├── Tier-gated inventory │ ├── Channel point reroll │ └── NEW: Integrated repair system │ ├── 💊 SUPPLY DEPOT (NEW - Consumables) │ ├── XP Boosters │ ├── Combat Enhancers │ ├── Economy Boosters │ └── Utility Items (single-use) │ ├── 🎭 STREAM ACTIONS (NEW - Redemptions) │ ├── Lights & Ambiance │ ├── Fog & Effects │ ├── Sound & Voice (TTS) │ └── Premium Actions │ ├── 🏆 PRESTIGE SHOP (Future consideration) │ └── (Exclusive titles, merchandise - not in initial scope) │ └── 🖤 BLACK MARKET (Existing - Unchanged) └── Global rotating legendary items


### URL Structure
/shop → Redirects to /shop/equipment /shop/equipment → Equipment Store /shop/supplies → Supply Depot (consumables) /shop/stream-actions → Stream Actions /shop/black-market → Black Market (existing) /admin/actions → (Admin Only) Manage stream action inventory


---

## SUPPLY DEPOT SPECIFICATION

### Consumable Categories

#### XP Boosters
| ID | Name | Cost | Duration | Effect |
|----|------|------|----------|--------|
| `xp_25` | XP Chip | $25,000 | 24h | +25% XP |
| `xp_50` | Neural Enhancer | $50,000 | 24h | +50% XP |
| `xp_100` | Cognitive Overclock | $100,000 | 24h | +100% XP (2x) |

#### Combat Enhancers
| ID | Name | Cost | Duration | Effect |
|----|------|------|----------|--------|
| `rob_atk_5` | Targeting Module | $35,000 | 24h | +5% rob success |
| `rob_atk_10` | Combat Stims | $60,000 | 24h | +10% rob success |
| `rob_def_5` | Reflex Amplifier | $40,000 | 24h | +5% defense |
| `rob_def_10` | Nano-Weave Boost | $75,000 | 24h | +10% defense |

#### Economy Boosters
| ID | Name | Cost | Duration | Effect |
|----|------|------|----------|--------|
| `biz_25` | Business License | $30,000 | 24h | +25% business revenue |
| `biz_50` | Corporate Contracts | $65,000 | 24h | +50% business revenue |
| `crate_3` | Lucky Coin | $35,000 | 24h | +3% crate drop rate |
| `crate_5` | Fortune's Favor | $80,000 | 24h | +5% crate drop rate |
| `wealth_10` | Street Smarts | $40,000 | 24h | +10% wealth from !play |
| `wealth_20` | Kingpin's Touch | $90,000 | 24h | +20% wealth from !play |

#### Single-Use Utility Items
| ID | Name | Cost | Effect | Max Owned |
|----|------|------|--------|-----------|
| `bail_bond` | Bail Bond | $15,000 | Skip 10% bail cost | 5 |
| `reroll_token` | Reroll Token | $10,000 | Free shop reroll | 10 |
| `crate_magnet` | Crate Magnet | $75,000 | **Set Crate Drop Rate to 50%** (Max Luck) | 3 |

### Stacking Rules

**Same Category**: Cannot stack. Higher tier replaces lower tier and resets to 24h. Same tier extends duration by 24h.

**Different Categories**: All stack with each other.

**With Juicernaut**: Consumables stack multiplicatively with Juicernaut buffs.

**With Territory**: Consumables stack additively with territory buffs.

### Buff Application Order
Base Reward ↓ Apply Consumable Buff (additive) ↓ Apply Territory Buff (additive) ↓ Apply Juicernaut Buff (multiplicative) ↓ Final Reward


---

## STREAM ACTIONS SPECIFICATION

### Initial Action Configuration (Seed Data)
*Note: These will be inserted into the database initially, but can be modified via Admin UI later.*

#### Lights & Ambiance (Overwrite Logic)
| Action | Cost | Cooldown | Limit | Description |
|--------|------|----------|-------|-------------|
| Color Shift | $10,000 | 2 min | Unlimited | Change light color |
| Flash Pulse | $15,000 | 3 min | Unlimited | Quick light flash |
| Rainbow Cycle | $25,000 | 10 min | 10/stream | 10-second rainbow |
| Blackout | $50,000 | 30 min | 3/stream | Lights off 5 seconds |

#### Fog & Effects (Overwrite Logic)
| Action | Cost | Cooldown | Limit | Description |
|--------|------|----------|-------|-------------|
| Fog Burst | $25,000 | 5 min | Unlimited | Single fog shot |
| Fog Wave | $75,000 | 15 min | 5/stream | 10-second continuous |
| "The Atmosphere" | $150,000 | 1 hour | 2/stream | Fog + dim lights combo |

#### Sound & Voice (Queue Logic)
| Action | Cost | Cooldown | Limit | Description |
|--------|------|----------|-------|-------------|
| Sound Alert | $20,000 | 3 min | Unlimited | From approved list |
| TTS Short (50 char) | $35,000 | 5 min | Unlimited | Text-to-speech |
| TTS Long (100 char) | $60,000 | 5 min | Unlimited | Extended TTS |
| TTS Premium (200 char) | $100,000 | 10 min | 10/stream | Long-form TTS |

### TTS Filtering Requirements
Before sending to Lumia, the backend must sanitize the input:
1.  **Blocklist**: Standard profanity filter.
2.  **Repetition**: Detect `wwwwww`, `!!!!!!!`, `7777777`.
3.  **Phonetic Spam**: Detect common TTS exploits (e.g., "soi soi", "fuh fuh", rapid consonant clusters).
4.  **Max Length**: Hard truncate at character limit.

---

## DATABASE SCHEMA (DRAFT)

### New Tables Required

```sql
-- Consumable type definitions
CREATE TABLE consumable_types (
    consumable_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    cost INTEGER NOT NULL,
    is_duration_buff BOOLEAN DEFAULT TRUE,
    duration_hours INTEGER DEFAULT 24,
    buff_key VARCHAR(50),
    buff_value DECIMAL(5,2),
    is_single_use BOOLEAN DEFAULT FALSE,
    max_owned INTEGER,
    config JSONB, -- Stores metadata like { "target_drop_rate": 0.50 } or { "skip_bail": true }
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User's owned single-use consumables
CREATE TABLE user_consumables (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    consumable_id VARCHAR(50) REFERENCES consumable_types(consumable_id),
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, consumable_id)
);

-- Consumable purchase history
CREATE TABLE consumable_purchases (
    purchase_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    consumable_id VARCHAR(50) REFERENCES consumable_types(consumable_id),
    cost INTEGER NOT NULL,
    was_extension BOOLEAN DEFAULT FALSE,
    was_upgrade BOOLEAN DEFAULT FALSE,
    previous_buff_remaining_minutes INTEGER,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream Action DEFINITIONS (The Menu)
CREATE TABLE stream_action_types (
    action_id VARCHAR(50) PRIMARY KEY, -- e.g. 'fog_burst'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'lights', 'fog', 'sound', 'tts'
    cost INTEGER NOT NULL,
    cooldown_seconds INTEGER NOT NULL,
    limit_per_stream INTEGER, -- NULL if unlimited
    lumia_command_id VARCHAR(100), -- The command trigger sent to Lumia
    is_active BOOLEAN DEFAULT TRUE, -- Soft delete: toggle false to hide from shop
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream Action USAGE (The History)
CREATE TABLE stream_action_usage (
    usage_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    user_id INTEGER REFERENCES users(user_id),
    action_id VARCHAR(50) REFERENCES stream_action_types(action_id), -- Linked to definition
    cost INTEGER NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'overwritten'
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream Action COOLDOWNS
CREATE TABLE stream_action_cooldowns (
    cooldown_id SERIAL PRIMARY KEY,
    action_id VARCHAR(50) REFERENCES stream_action_types(action_id),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(action_id)
);
Existing Table Modifications
SQL

-- Add source column to active_buffs to distinguish consumable buffs
ALTER TABLE active_buffs ADD COLUMN source VARCHAR(50) DEFAULT 'system';
-- source values: 'juicernaut', 'territory', 'consumable', 'system'
SERVICE LAYER (DRAFT)
ConsumableService Methods
TypeScript

class ConsumableService {
  getConsumables(): Promise<ConsumableType[]>
  getActiveBuffs(userId: number): Promise<ActiveBuff[]>
  getSingleUseInventory(userId: number): Promise<UserConsumable[]>
  purchase(userId: number, consumableId: string): Promise<PurchaseResult>
  useSingleUse(userId: number, consumableId: string): Promise<void>
  hasBuff(userId: number, buffKey: string): Promise<boolean>
  getBuffMultiplier(userId: number, buffKey: string): Promise<number>
  hasConsumable(userId: number, consumableId: string): Promise<boolean>
  cleanupExpiredBuffs(): Promise<number>
}
StreamActionService Methods
TypeScript

class StreamActionService {
  // Fetch available actions from DB where is_active = true
  getAvailableActions(): Promise<StreamActionType[]>
  
  // Pre-check Lumia API status; throw error if offline
  validateLumiaConnection(): Promise<boolean>
  
  // Sanitizes TTS input for spam/exploits
  sanitizePayload(type: string, payload: any): any 
  
  trigger(userId: number, actionId: string, payload?: any): Promise<TriggerResult>
  processQueue(): Promise<void> // For Audio/TTS queue management
  canTrigger(actionId: string): Promise<{ available: boolean; cooldownRemaining?: number }>
}
API ROUTES (DRAFT)
GET  /api/shop/supplies              - List consumables + user's buffs/inventory
POST /api/shop/supplies/buy          - Purchase consumable

GET  /api/shop/stream-actions        - List active stream actions (from DB)
GET  /api/shop/stream-actions/status - Get cooldowns, limits, stream status
POST /api/shop/stream-actions/trigger - Trigger stream action
GET  /api/shop/stream-actions/history - User's action history
IMPLEMENTATION PHASES
Phase A: Supply Depot (Consumables)
Database schema + seed data

ConsumableService implementation

Integration with Play/Rob/Business/Jail/Shop services

API routes

UI components (Mobile-First)

Chat commands (!buffs, !supplies)

Estimated: 12-16 hours

Phase B: Stream Actions (Core)
Database schema (stream_action_types)

Lumia webhook integration + "Ping Check"

StreamActionService + TTS Sanitizer utility

Queue management (Audio) vs Overwrite logic (Visuals)

API routes

UI components (Offline state handling)

Estimated: 14-20 hours

Phase C: Admin & Maintenance
Admin UI: /admin/actions to view/edit/toggle stream actions

Soft-delete logic for broken equipment

Repair system integration (Equipment Shop)

Unified shop navigation

Estimated: 8-10 hours

Document Version: 1.2 Updated: December 2024 Purpose: Implementation Spec for Shop Expansion (Dynamic Actions)