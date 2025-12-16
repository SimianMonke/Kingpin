# KINGPIN BUILD PROMPT

Use this prompt when starting a new conversation with Claude Opus 4.5 to build the Kingpin system. Upload all 19 documentation files along with this prompt.

---

## PROMPT START

---

I need you to help me build **Kingpin**, a comprehensive multi-platform chatbot and web application for my Kick/Twitch streams. I've attached 19 detailed specification documents that define every system, database schema, formula, and behavior.

## YOUR ROLE

You are my lead developer. Your job is to:
1. Read and internalize all attached documentation
2. Build each system according to the exact specifications
3. Ask clarifying questions ONLY when the documentation is genuinely ambiguous
4. Follow the phased build order defined in KINGPIN_INDEX.md
5. Write production-quality code with proper error handling
6. Test edge cases documented in each system file

## PROJECT OVERVIEW

**Kingpin** is a persistent RPG economy game embedded in my streaming chat, featuring:
- Cross-platform support (Kick, Twitch, Discord)
- Real-time donation competition (Juicernaut)
- Faction warfare with territory control
- 90+ achievements with unlockable titles
- Multi-period leaderboards
- Monetization tracking and rewards

## TECHNOLOGY STACK (Non-Negotiable)

| Component | Technology | Hosting |
|-----------|------------|---------|
| Frontend + API | Next.js 14+ (App Router) | Vercel |
| Database | PostgreSQL | Neon (free tier) |
| Bot Runtime | Node.js | Railway ($5/mo) |
| Styling | Tailwind CSS | - |
| Auth | NextAuth.js | - |
| ORM | Prisma or Drizzle | - |

**Domain:** kingpin.simianmonke.com

## ATTACHED DOCUMENTATION

I've attached these 19 files - read ALL of them before starting:

### Index
- **KINGPIN_INDEX.md** - Start here. Contains executive summary, phased build order, and file manifest.

### System Specifications (14 files)
1. **01_USERS_PROGRESSION.md** - User profiles, XP formula, levels, tiers, check-in streaks, account linking
2. **02_ECONOMY_PLAY.md** - !play command, wealth generation, tier-based events, crate drops
3. **03_ROB_SYSTEM.md** - PvP robbery, success formula, item theft, insurance
4. **04_ITEMS_INVENTORY.md** - Weapons, armor, businesses, housing, durability, shops, Black Market
5. **05_COOLDOWNS_JAIL.md** - Command cooldowns, jail mechanics, bail system
6. **06_LEADERBOARDS.md** - Daily/weekly/monthly/annual/lifetime tracking, Hall of Fame
7. **07_ACHIEVEMENTS_TITLES.md** - 47 achievements across 9 categories, title equip system
8. **08_JUICERNAUT.md** - Real-time donation competition, crown mechanics, session rewards
9. **09_MONETIZATION.md** - Kick/Twitch/Stripe webhook handling, reward formulas
10. **10_MISSIONS.md** - Daily/weekly missions, all-or-nothing rewards, tier scaling
11. **11_CRATES_LOOT.md** - 4 crate tiers, drop tables, 40 exclusive titles
12. **12_FACTIONS_TERRITORIES.md** - 3 factions, 12 territories, weekly competition
13. **13_COMMUNICATIONS.md** - Notifications, webhooks, event batching, Discord integration
14. **14_HEIST_ALERTS.md** - Random stream events, 6 event types, cross-platform

### Reference Documents (4 files)
15. **15_DATABASE_SCHEMA.md** - Complete PostgreSQL schema (copy-paste ready)
16. **REF_CHAT_COMMANDS.md** - All chat commands with syntax, cooldowns, permissions
17. **REF_SCHEDULED_JOBS.md** - All cron jobs and background tasks
18. **REF_ENVIRONMENT_VARIABLES.md** - All required environment variables

## BUILD ORDER

Follow this phased approach from KINGPIN_INDEX.md:

### Phase 1: Foundation
- Set up Next.js project with Tailwind
- Configure Neon PostgreSQL database
- Run all CREATE TABLE statements from 15_DATABASE_SCHEMA.md
- Set up environment variables per REF_ENVIRONMENT_VARIABLES.md
- Create basic project structure

### Phase 2: Core Identity
- Implement NextAuth.js with Kick, Twitch, Discord OAuth
- Build user registration (auto-create on first chat)
- Implement check-in system (first message of day)
- Build profile API and display

### Phase 3: Basic Economy
- Implement !play command with tier-based events
- Build jail/bust mechanics
- Create item system (equip/unequip)
- Build shop system

### Phase 4: Social Competition
- Implement !rob command with full formula
- Build leaderboard tracking and display
- Create Hall of Fame

### Phase 5: Engagement
- Build mission assignment and tracking
- Implement achievement system
- Create title equip/display

### Phase 6: Monetization
- Set up Stripe webhook handler
- Set up Kick webhook handler  
- Set up Twitch EventSub
- Implement reward distribution
- Build Juicernaut session management

### Phase 7: Advanced Economy
- Implement crate system with drop tables
- Build Black Market rotation
- Add durability decay

### Phase 8: Factions
- Build faction membership
- Implement territory scoring
- Create weekly faction rewards

### Phase 9: Events
- Build Heist Alert system
- Implement cross-platform answer detection

### Phase 10: Communications
- Build website notification system
- Set up Discord feed posting
- Implement event batching
- Configure Lumia webhooks

## CRITICAL REQUIREMENTS

### Channel Point Redemptions (NOT Chat Commands!)
The following actions are triggered via **channel point redemptions**, NOT chat commands:
- **Play** - Kick webhook / Twitch EventSub
- **Rob** - Kick webhook / Twitch EventSub (target in input field)
- **Bail** - Kick webhook / Twitch EventSub
- **Reroll Shop** - Kick webhook / Twitch EventSub

You must set up channel point rewards on Kick and Twitch, then listen for redemption events via webhooks/EventSub. These are NOT parsed from chat messages.

### Two Shop Systems
1. **Player Shop** - Unique per player, tier-based inventory, refreshed via channel points
2. **Black Market** - Global shop, same for all players, limited stock, 6-hour rotation

Players can ONLY buy from their own shop or the Black Market. There is no player-to-player trading.

### Item Theft Rules
During robbery, players can ONLY steal **equipped items** from the defender:
- Weapon slot
- Armor slot  
- Business slot
- Housing slot

**Unequipped inventory items are PROTECTED and cannot be stolen.**

### Code Quality
- Use TypeScript throughout
- Implement proper error handling (try/catch, error boundaries)
- Use database transactions for multi-table operations
- Add input validation on all endpoints
- Write code comments for complex logic

### Database
- Use the EXACT schema from 15_DATABASE_SCHEMA.md
- All times stored as UTC
- Use parameterized queries (Prisma/Drizzle handle this)
- Create indexes as specified

### Formulas
Follow these EXACTLY as documented:

**XP per Level:**
```
XP required for Level N = 100 × 1.25^(N-1)
```

**Rob Success Rate:**
```
Base: 60%
+ Attacker weapon bonus (0-15%)
- Defender armor bonus (0-15%)
± Level difference × 1% (max ±10%)
= Final rate (clamped 45-85%)
```

**Tier Multipliers (Missions):**
| Tier | Level | Multiplier |
|------|-------|------------|
| Rookie | 1-19 | 1.0x |
| Associate | 20-39 | 1.1x |
| Soldier | 40-59 | 1.2x |
| Captain | 60-79 | 1.3x |
| Underboss | 80-99 | 1.4x |
| Kingpin | 100+ | 1.5x |

### Bot Architecture
The bot runs as a separate Node.js service on Railway that:
- Connects to Kick via WebSocket (Pusher protocol)
- Connects to Twitch via TMI.js
- Connects to Discord via discord.js
- Shares the same Neon database as the website
- Processes commands and sends responses

### Website Features
- Dashboard showing player stats
- Inventory management
- Crate opening UI
- Leaderboards
- Achievement showcase
- Black Market
- Account linking
- Profile pages

## HOW TO WORK WITH ME

1. **Start each session** by confirming which phase/system we're building
2. **Show me the file structure** before writing code
3. **Build incrementally** - one system at a time
4. **Create complete, working code** - not pseudocode or snippets
5. **Test edge cases** listed in each document
6. **Ask questions** if any specification is unclear

## FIRST TASK

Let's start with **Phase 1: Foundation**. Please:

1. Confirm you've read and understood all 19 documents
2. Show me the proposed project file structure
3. Begin setting up the Next.js project with the database schema

Let me know when you're ready to begin.

---

## PROMPT END

---

## USAGE INSTRUCTIONS

### Before Starting

1. **Create a new conversation** with Claude Opus 4.5
2. **Upload all 19 markdown files** from the kingpin-docs folder
3. **Paste the prompt above** (everything between PROMPT START and PROMPT END)
4. **Wait for Claude to confirm** it has read the documentation

### During Development

- Work through one phase at a time
- When a phase is complete, say "Let's move to Phase X"
- If Claude's context gets full, start a new conversation and say:
  "We're continuing Kingpin development. We completed Phases 1-X. Let's continue with Phase Y."
- Re-upload the documentation files in each new conversation

### Tips for Best Results

1. **Be specific** - "Build the !play command handler" is better than "work on economy"
2. **Review generated code** before moving on
3. **Test locally** after each phase
4. **Commit to git** after each working phase
5. **Keep a log** of what's been completed

### If Claude Gets Confused

Say: "Please re-read [specific document].md and follow the specification exactly."

### For Complex Debugging

Upload the problematic code file and say: "This code should implement [system] per [document].md but it's not working correctly. Please fix it to match the specification."

---

## DOCUMENT CHECKLIST

Before starting, ensure you have all 19 files:

- [ ] KINGPIN_INDEX.md
- [ ] 01_USERS_PROGRESSION.md
- [ ] 02_ECONOMY_PLAY.md
- [ ] 03_ROB_SYSTEM.md
- [ ] 04_ITEMS_INVENTORY.md
- [ ] 05_COOLDOWNS_JAIL.md
- [ ] 06_LEADERBOARDS.md
- [ ] 07_ACHIEVEMENTS_TITLES.md
- [ ] 08_JUICERNAUT.md
- [ ] 09_MONETIZATION.md
- [ ] 10_MISSIONS.md
- [ ] 11_CRATES_LOOT.md
- [ ] 12_FACTIONS_TERRITORIES.md
- [ ] 13_COMMUNICATIONS.md
- [ ] 14_HEIST_ALERTS.md
- [ ] 15_DATABASE_SCHEMA.md
- [ ] REF_CHAT_COMMANDS.md
- [ ] REF_SCHEDULED_JOBS.md
- [ ] REF_ENVIRONMENT_VARIABLES.md

---

**Total documentation size:** ~202KB
**Estimated build time:** 40-60 hours across multiple sessions
**Recommended approach:** 1-2 phases per session
