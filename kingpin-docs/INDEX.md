# Kingpin Game System - Documentation Index

## Overview

Kingpin is a multi-platform economy/gambling game with web dashboard integration. Players earn wealth and XP through various activities, compete on leaderboards, join factions, and participate in live stream events.

**Documentation Generated:** December 15, 2024
**Implementation Status:** Complete (All 16 Core Systems)

---

## Quick Links

| System | Status | Description |
|--------|--------|-------------|
| [User System](./USER_SYSTEM.md) | ✅ Complete | Registration, profiles, XP/leveling, tiers |
| [Economy System](./ECONOMY_SYSTEM.md) | ✅ Complete | !play command, wealth generation, bust mechanics |
| [Rob System](./ROB_SYSTEM.md) | ✅ Complete | Player robbery, success rates, item theft |
| [Inventory System](./INVENTORY_SYSTEM.md) | ✅ Complete | Items, equipping, durability, shops |
| [Cooldown System](./COOLDOWN_SYSTEM.md) | ✅ Complete | Cooldowns, jail mechanics, bail |
| [Leaderboard System](./LEADERBOARD_SYSTEM.md) | ✅ Complete | Rankings, snapshots, hall of fame |
| [Achievement System](./ACHIEVEMENT_SYSTEM.md) | ✅ Complete | Achievements, titles, progress tracking |
| [Juicernaut System](./JUICERNAUT_SYSTEM.md) | ✅ Complete | Streamer support crown, buffs |
| [Monetization System](./MONETIZATION_SYSTEM.md) | ✅ Complete | Subs, bits, donations, rewards |
| [Mission System](./MISSION_SYSTEM.md) | ✅ Complete | Daily/weekly objectives, rewards |
| [Crate System](./CRATE_SYSTEM.md) | ✅ Complete | Loot boxes, drop tables, escrow |
| [Faction System](./FACTION_SYSTEM.md) | ✅ Complete | Factions, territories, buffs |
| [Communication System](./COMMUNICATION_SYSTEM.md) | ✅ Complete | Chat tracking, Discord, notifications |
| [Heist System](./HEIST_SYSTEM.md) | ✅ Complete | Interactive stream events |
| [Database Layer](./DATABASE_LAYER.md) | ✅ Complete | Prisma, PostgreSQL, schema |
| [Lumia Stream System](./LUMIA_STREAM_SYSTEM.md) | ✅ Complete | Smart light integration via SDK |

---

## In-Progress Features

| Feature | Status | Description |
|---------|--------|-------------|
| [Shop Expansion](./SHOP_EXPANSION_IMPLEMENTATION.md) | ✅ Complete | Supply Depot (consumables) + Stream Actions (Lumia) |
| [Admin Panel](./ADMIN_PANEL_IMPLEMENTATION.md) | 🔄 Phase 1/3 | Global settings, player management, audit logs |

**Shop Expansion Progress:**
- ✅ Phase 1: Database & BuffService
- ✅ Phase 2: ConsumableService & API
- ✅ Phase 3: Service Integrations (Play, Rob, Business, Jail, Shop)
- ✅ Phase 4: Stream Actions Core (Lumia SDK integration)
- ✅ Phase 5: Stream Action Queue & Polish
- ✅ Phase 6: Admin Dashboard (Stream Actions CRUD, System Commands)

---

## Implementation Summary

### Core Statistics

| Metric | Count |
|--------|-------|
| Database Tables | 38 |
| Service Files | 26 |
| API Routes | 40+ |
| Achievement Types | 30+ |
| Play Events per Tier | 50 |
| Total Play Events | 300 |

### Key Formulas Implemented

| Formula | Location | Status |
|---------|----------|--------|
| XP for Level: `100 × 1.25^(N-1)` | formulas.ts | ✅ |
| Rob Success: `60% ± modifiers (45-85%)` | formulas.ts | ✅ |
| Steal Amount: `8-28% of target wealth` | formulas.ts | ✅ |
| Bail Cost: `10% of wealth (min $100)` | formulas.ts | ✅ |
| Tier Multiplier: `1.0 - 1.5x` | constants.ts | ✅ |

### Platform Support

| Platform | Authentication | Webhooks | Chat |
|----------|----------------|----------|------|
| Kick | ✅ OAuth | ✅ Subs/Kicks | ✅ |
| Twitch | ✅ OAuth | ✅ Subs/Bits/Raids | ✅ |
| Discord | ✅ OAuth | N/A | ✅ Feed |
| Stripe | N/A | ✅ Donations | N/A |

---

## System Dependencies Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER SYSTEM                               │
│         (Core entity - all systems depend on this)               │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ ECONOMY/PLAY  │       │  ROB SYSTEM   │       │   INVENTORY   │
│   SYSTEM      │       │               │       │    SYSTEM     │
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ COOLDOWN/JAIL │◄──────│  JUICERNAUT   │──────►│    CRATE      │
│    SYSTEM     │       │    SYSTEM     │       │   SYSTEM      │
└───────────────┘       └───────┬───────┘       └───────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  LEADERBOARD  │       │ MONETIZATION  │       │    HEIST      │
│    SYSTEM     │       │    SYSTEM     │       │   SYSTEM      │
└───────────────┘       └───────────────┘       └───────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  ACHIEVEMENT  │       │   MISSION     │
│    SYSTEM     │       │   SYSTEM      │
└───────────────┘       └───────────────┘
        │
        ▼
┌───────────────┐       ┌───────────────┐
│   FACTION     │       │ COMMUNICATION │
│   SYSTEM      │       │    SYSTEM     │
└───────────────┘       └───────────────┘
```

---

## Tier System Overview

| Tier | Levels | Multiplier | Shop Access | Features |
|------|--------|------------|-------------|----------|
| Rookie | 1-19 | 1.0x | Common | Basic play |
| Associate | 20-39 | 1.1x | Common, Uncommon | Faction joining |
| Soldier | 40-59 | 1.2x | Common-Rare | Full features |
| Captain | 60-79 | 1.3x | Common-Rare | Discord promotions |
| Underboss | 80-99 | 1.4x | Uncommon-Rare | Advanced gambling |
| Kingpin | 100+ | 1.5x | Uncommon-Rare | Max benefits |

---

## Scheduled Jobs

| Job | Schedule | Function |
|-----|----------|----------|
| Daily Reset | 00:00 UTC | Reset dailies, archive leaderboards |
| Weekly Reset | Monday 00:00 UTC | Reset weeklies, evaluate territories |
| Black Market Rotation | Every 6 hours | Refresh black market inventory |
| Heist Check | Every minute | Trigger heists during active sessions |
| Gambling Maintenance | Hourly | Process lottery, expire coinflips |
| Cooldown Cleanup | Daily | Remove expired cooldowns |

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `web/src/lib/game/constants.ts` | All game configuration values |
| `web/src/lib/game/formulas.ts` | All calculation functions |
| `web/src/types/index.ts` | TypeScript type definitions |
| `web/prisma/schema.prisma` | Database schema |
| `.env` | Environment variables |

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth encryption key |
| `NEXTAUTH_URL` | Application URL |
| `KICK_CLIENT_ID` | Kick OAuth app ID |
| `KICK_CLIENT_SECRET` | Kick OAuth secret |
| `TWITCH_CLIENT_ID` | Twitch OAuth app ID |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth secret |
| `DISCORD_CLIENT_ID` | Discord OAuth app ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth secret |
| `DISCORD_WEBHOOK_URL` | Discord feed webhook |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `BOT_API_KEY` | Chat bot authentication |
| `LUMIA_API_TOKEN` | Lumia Stream SDK token |

---

## Deviation Notes

### Specification vs Implementation

| Spec Item | Status | Notes |
|-----------|--------|-------|
| 50 events per tier | ✅ Implemented | Phase 12 expansion |
| Negative play events | ✅ Implemented | CRIT-07 fix (15% chance) |
| Titles from rare+ only | ✅ Implemented | MED-01 fix |
| Durability ranges | ✅ Implemented | HIGH-01 fix (2-3 random) |
| Stolen item 48h escrow | ✅ Implemented | HIGH-02 fix |
| Perpetual streak rewards | ✅ Implemented | CRIT-06 fix |
| Juicernaut wealth 1.25x | ✅ Implemented | Corrected from 2x |

### Missing/Planned Features

None identified - all specification features implemented.

---

## Code Quality Notes

- **Type Safety:** Full TypeScript with strict mode
- **Error Handling:** `safeVoid` pattern for non-critical operations
- **Transactions:** Atomic operations for wealth transfers
- **Logging:** Structured logging for debugging
- **Testing:** Unit tests for formulas (recommended)

---

## Related Documentation

- **Specification Files:** `01_USERS_PROGRESSION.md` through `15_DATABASE_SCHEMA.md`
- **Reference Files:** `REF_CHAT_COMMANDS.md`, `REF_ENVIRONMENT_VARIABLES.md`, `REF_SCHEDULED_JOBS.md`
- **Build Guide:** `BUILD_PROMPT.md`
- **Master Index:** `KINGPIN_INDEX.md`

---

## Document Locations

All documentation files are located in:
```
kingpin-docs/
├── INDEX.md (this file)
├── USER_SYSTEM.md
├── ECONOMY_SYSTEM.md
├── ROB_SYSTEM.md
├── INVENTORY_SYSTEM.md
├── COOLDOWN_SYSTEM.md
├── LEADERBOARD_SYSTEM.md
├── ACHIEVEMENT_SYSTEM.md
├── JUICERNAUT_SYSTEM.md
├── MONETIZATION_SYSTEM.md
├── MISSION_SYSTEM.md
├── CRATE_SYSTEM.md
├── FACTION_SYSTEM.md
├── COMMUNICATION_SYSTEM.md
├── HEIST_SYSTEM.md
├── DATABASE_LAYER.md
├── LUMIA_STREAM_SYSTEM.md
├── SHOP_EXPANSION.md (original bootstrap)
├── SHOP_EXPANSION_IMPLEMENTATION.md (implementation spec)
├── ADMIN_PANEL_REFERENCE.md (architecture reference)
└── ADMIN_PANEL_IMPLEMENTATION.md (implementation spec)
```

---

*Generated by Claude Code - December 15, 2024*
