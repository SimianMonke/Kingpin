# KINGPIN CHATBOT - MASTER INDEX
**Version:** 4.0  
**Date:** December 12, 2025  
**Stream:** kick.com/simianmonke  

---

## EXECUTIVE SUMMARY

Kingpin is a comprehensive, multi-platform chatbot system for Kick/Twitch streams that manages a persistent RPG economy game set in Lazarus City 2098. The system integrates real-time chat engagement, monetization tracking, competitive leaderboards, and deep progression mechanics.

### Core Features
- Persistent RPG game with wealth, XP, levels, and items
- Real-time donation competition (Juicernaut System)
- Multi-period leaderboards (daily/weekly/monthly/annual/lifetime)
- 90+ achievements with unlockable titles
- Faction warfare with territory control
- Cross-platform monetization rewards (Kick, Twitch, Discord, Stripe)
- Random engagement events (Heist Alerts)

---

## TECHNOLOGY STACK

| Component | Technology | Notes |
|-----------|------------|-------|
| **Frontend** | Next.js | Hosted on Vercel (kingpin.simianmonke.com) |
| **API** | Next.js API Routes | Hosted on Vercel |
| **Database** | Neon PostgreSQL | Free tier |
| **Bot Runtime** | Node.js | Hosted on Railway ($5/mo) |
| **Streaming Platforms** | Kick + Twitch | Developer apps registered |
| **Community Platform** | Discord | Full integration with bot presence |
| **Payments** | Stripe | Monke LLC account |
| **Stream Alerts** | Lumia Stream | Webhook integration |

---

## PLATFORM INTEGRATION

### Chat Platforms (3)
1. **Kick** - Primary streaming platform
2. **Twitch** - Secondary streaming platform  
3. **Discord** - Community platform (24/7 activity tracking)

### Account Linking Requirements
- Users MUST link Kick OR Twitch before Discord can be linked
- Discord-only participation is NOT allowed
- Profiles are auto-created on first chat message (Kick/Twitch)

---

## DOCUMENT STRUCTURE

### System Specifications (14 Documents)

| # | Document | Description |
|---|----------|-------------|
| 01 | [01_USERS_PROGRESSION.md](./01_USERS_PROGRESSION.md) | User profiles, XP, levels, tiers, check-in streaks, account linking |
| 02 | [02_ECONOMY_PLAY.md](./02_ECONOMY_PLAY.md) | !play command, wealth generation, event tiers, crate drops |
| 03 | [03_ROB_SYSTEM.md](./03_ROB_SYSTEM.md) | PvP robbery, success calculations, item theft, insurance |
| 04 | [04_ITEMS_INVENTORY.md](./04_ITEMS_INVENTORY.md) | Weapons, armor, businesses, housing, durability, shops |
| 05 | [05_COOLDOWNS_JAIL.md](./05_COOLDOWNS_JAIL.md) | Command cooldowns, jail system, bail mechanics |
| 06 | [06_LEADERBOARDS.md](./06_LEADERBOARDS.md) | Multi-period tracking, rankings, hall of fame |
| 07 | [07_ACHIEVEMENTS_TITLES.md](./07_ACHIEVEMENTS_TITLES.md) | Achievement categories, unlock requirements, title system |
| 08 | [08_JUICERNAUT.md](./08_JUICERNAUT.md) | Real-time donation competition, buffs, session rewards |
| 09 | [09_MONETIZATION.md](./09_MONETIZATION.md) | Platform rewards, Stripe integration, reward values |
| 10 | [10_MISSIONS.md](./10_MISSIONS.md) | Daily/weekly missions, objectives, all-or-nothing rewards |
| 11 | [11_CRATES_LOOT.md](./11_CRATES_LOOT.md) | Crate tiers, drop tables, exclusive titles, opening mechanics |
| 12 | [12_FACTIONS_TERRITORIES.md](./12_FACTIONS_TERRITORIES.md) | Three factions, 12 territories, control mechanics |
| 13 | [13_COMMUNICATIONS.md](./13_COMMUNICATIONS.md) | Notifications, webhooks, chat announcements, batching |
| 14 | [14_HEIST_ALERTS.md](./14_HEIST_ALERTS.md) | Random drop events, puzzles, rewards |

### Reference Documents (4 Documents)

| Document | Description |
|----------|-------------|
| [15_DATABASE_SCHEMA.md](./15_DATABASE_SCHEMA.md) | Complete consolidated database schema |
| [REF_CHAT_COMMANDS.md](./REF_CHAT_COMMANDS.md) | All chat commands across platforms |
| [REF_SCHEDULED_JOBS.md](./REF_SCHEDULED_JOBS.md) | All background jobs and schedules |
| [REF_ENVIRONMENT_VARIABLES.md](./REF_ENVIRONMENT_VARIABLES.md) | Required configuration variables |

---

## PHASED BUILD ORDER

### Phase 1: Foundation
**Systems:** Database schema, Auth/OAuth (Kick, Twitch, Discord), Basic API structure  
**Dependencies:** None  
**Documents:** 15_DATABASE_SCHEMA.md, REF_ENVIRONMENT_VARIABLES.md

**Deliverables:**
- PostgreSQL database provisioned on Neon
- All tables created with indexes
- OAuth flows for Kick, Twitch, Discord
- Basic Express/Next.js API structure
- Environment configuration

---

### Phase 2: Core Identity
**Systems:** Users & Progression, Account Linking  
**Dependencies:** Phase 1  
**Documents:** 01_USERS_PROGRESSION.md

**Deliverables:**
- User registration on first chat message
- Profile storage (wealth, XP, level, tier)
- Check-in system (first message of day)
- Account linking flow (website OAuth)
- Profile merging logic

---

### Phase 3: Basic Economy
**Systems:** Economy (!play), Cooldowns & Jail, Items & Inventory (basic)  
**Dependencies:** Phase 2  
**Documents:** 02_ECONOMY_PLAY.md, 05_COOLDOWNS_JAIL.md, 04_ITEMS_INVENTORY.md

**Deliverables:**
- !play command with tier-based events
- Jail/bust mechanics with bail
- Basic item system (equip/unequip)
- Shop system (tier-based inventory)
- Durability tracking

---

### Phase 4: Social Competition
**Systems:** Rob System, Leaderboards  
**Dependencies:** Phase 3  
**Documents:** 03_ROB_SYSTEM.md, 06_LEADERBOARDS.md

**Deliverables:**
- !rob command with full combat calculations
- Item theft mechanics
- Multi-period leaderboard tracking
- Leaderboard display commands
- Hall of fame

---

### Phase 5: Engagement
**Systems:** Missions, Achievements & Titles  
**Dependencies:** Phase 4  
**Documents:** 10_MISSIONS.md, 07_ACHIEVEMENTS_TITLES.md

**Deliverables:**
- Daily/weekly mission assignment
- Mission progress tracking
- All-or-nothing reward distribution
- Achievement unlock system
- Title equip/display

---

### Phase 6: Monetization
**Systems:** Monetization Integration, Juicernaut  
**Dependencies:** Phase 5  
**Documents:** 09_MONETIZATION.md, 08_JUICERNAUT.md

**Deliverables:**
- Kick/Twitch/Stripe webhook handlers
- Monetization reward distribution
- Juicernaut session management
- Crown change mechanics
- Session-end rewards

---

### Phase 7: Advanced Economy
**Systems:** Crates & Loot, Items (full: Black Market, durability decay)  
**Dependencies:** Phase 6  
**Documents:** 11_CRATES_LOOT.md, 04_ITEMS_INVENTORY.md

**Deliverables:**
- Crate inventory system
- Crate opening mechanics
- Drop tables implementation
- Exclusive title drops
- Black Market rotation
- Full durability decay

---

### Phase 8: Factions
**Systems:** Factions & Territories  
**Dependencies:** Phase 7  
**Documents:** 12_FACTIONS_TERRITORIES.md

**Deliverables:**
- Faction membership system
- Territory assignment
- Daily score calculation
- Territory control evaluation
- Weekly faction rewards

---

### Phase 9: Events
**Systems:** Heist Alerts  
**Dependencies:** Phase 8  
**Documents:** 14_HEIST_ALERTS.md

**Deliverables:**
- Random event scheduling
- Event type handlers (trivia, riddles, etc.)
- Cross-platform answer detection
- Crate reward distribution

---

### Phase 10: Communications
**Systems:** Full notification system, Discord feed, Admin webhooks, Lumia  
**Dependencies:** Phase 9  
**Documents:** 13_COMMUNICATIONS.md

**Deliverables:**
- Website notification system
- Discord feed channel posting
- Admin webhook alerts
- Lumia Stream integration
- Event batching system
- Full polish pass

---

## CORE DESIGN PRINCIPLES

1. **Persistent State** - All player data survives across sessions
2. **Multi-Platform** - Seamless integration of Kick + Twitch + Discord + Stripe
3. **Engagement First** - Every system rewards participation
4. **Fair Monetization** - Supporters get rewards, but F2P players can compete
5. **Real-Time Competition** - Live leaderboards and crown changes
6. **Long-Term Progression** - Levels, achievements, hall of fame

---

## KEY FORMULAS

### XP Per Level
```
XP required for Level N = 100 × 1.25^(N-1)
```

### Rob Success Rate
```
Base: 60%
+ Attacker weapon bonus (0-15%)
- Defender armor bonus (0-15%)
± Level difference × 1% (max ±10%)
= Final rate (clamped 45-85%)
```

### Territory Score
```
Daily Score = (Messages × 1) + (Play Count × 10) + (Robberies × 20) + (Missions × 25)
```

### Tier Multipliers (Missions)
| Tier | Level | Multiplier |
|------|-------|------------|
| Rookie | 1-19 | 1.0x |
| Associate | 20-39 | 1.1x |
| Soldier | 40-59 | 1.2x |
| Captain | 60-79 | 1.3x |
| Underboss | 80-99 | 1.4x |
| Kingpin | 100+ | 1.5x |

---

## FILE MANIFEST

```
kingpin-docs/
├── KINGPIN_INDEX.md (this file)
├── 01_USERS_PROGRESSION.md
├── 02_ECONOMY_PLAY.md
├── 03_ROB_SYSTEM.md
├── 04_ITEMS_INVENTORY.md
├── 05_COOLDOWNS_JAIL.md
├── 06_LEADERBOARDS.md
├── 07_ACHIEVEMENTS_TITLES.md
├── 08_JUICERNAUT.md
├── 09_MONETIZATION.md
├── 10_MISSIONS.md
├── 11_CRATES_LOOT.md
├── 12_FACTIONS_TERRITORIES.md
├── 13_COMMUNICATIONS.md
├── 14_HEIST_ALERTS.md
├── 15_DATABASE_SCHEMA.md
├── REF_CHAT_COMMANDS.md
├── REF_SCHEDULED_JOBS.md
└── REF_ENVIRONMENT_VARIABLES.md
```

---

## IMPLEMENTATION NOTES FOR CLAUDE

When implementing this system:

1. **Read the relevant document(s) before starting each phase**
2. **Follow the database schema exactly** - foreign keys and constraints are intentional
3. **Use transactions** for all multi-table operations
4. **Implement cooldowns with Redis** for performance (PostgreSQL as fallback)
5. **All times are UTC** unless displaying to users
6. **Test edge cases** documented in each system file
7. **Chat commands must work cross-platform** (Kick, Twitch, Discord where allowed)

---

**END OF INDEX**
