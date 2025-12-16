# KINGPIN DEPLOYMENT READINESS REPORT

**Generated:** 2025-12-15
**Project:** Kingpin Multi-Platform Chatbot RPG
**Database:** Neon PostgreSQL (square-recipe-87275243)
**Domain:** kingpin.simianmonke.com

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Database Audit](#1-database-audit)
3. [GitHub Repository](#2-github-repository)
4. [Web Application](#3-web-application)
5. [Bot Application](#4-bot-application)
6. [Platform Integrations](#5-platform-integrations)
7. [Environment Variables](#6-environment-variables)
8. [Deployment Checklist](#7-deployment-checklist)
9. [Post-Deployment Testing](#8-post-deployment-testing)

---

## EXECUTIVE SUMMARY

### Overall Status: PARTIALLY READY

| Area | Status | Blocking? |
|------|--------|-----------|
| Database | READY | No |
| Local Codebase | READY | No |
| GitHub Push | NOT DONE | **YES** |
| Vercel Deployment | NOT DONE | **YES** |
| Platform Credentials | NOT CONFIGURED | **YES** |
| Bot Deployment | NOT DONE | **YES** |

### Critical Blockers (Must Resolve Before Testing)

1. **Code not pushed to GitHub** - Full codebase exists locally but only README is on GitHub
2. **Vercel not deployed** - Domain returns connection refused
3. **Platform apps not registered** - Need Kick, Twitch, Discord developer applications
4. **Bot not deployed** - Railway deployment not configured

### Estimated Time to Launch-Ready

| Task | Estimated Time |
|------|----------------|
| Push code + Deploy Vercel | 30 minutes |
| Register platform apps | 1-2 hours |
| Configure all credentials | 1-2 hours |
| Deploy bot to Railway | 30 minutes |
| Create channel point rewards | 30 minutes |
| End-to-end testing | 2-3 hours |
| **Total** | **6-9 hours** |

---

## 1. DATABASE AUDIT

### Status: READY

The Neon PostgreSQL database is fully configured with all required tables and seed data.

### 1.1 Table Inventory

**Found: 48 tables** (Requirement: 40+)

<details>
<summary>Click to expand full table list</summary>

| # | Table Name | Purpose |
|---|------------|---------|
| 1 | achievements | Achievement definitions |
| 2 | active_buffs | Player active buff tracking |
| 3 | black_market_inventory | Rotating market items |
| 4 | bot_config | Bot configuration storage |
| 5 | chat_messages | Chat message tracking |
| 6 | coin_flip_challenges | PvP coinflip games |
| 7 | cooldowns | Command/action cooldowns |
| 8 | crate_loot_tables | Crate reward probabilities |
| 9 | crate_opens | Crate opening history |
| 10 | crate_titles | Exclusive crate titles |
| 11 | crate_types | Crate tier definitions |
| 12 | discord_activity_channels | Discord activity tracking |
| 13 | discord_server_config | Discord server settings |
| 14 | event_batch_queue | Event processing queue |
| 15 | factions | Faction definitions |
| 16 | gambling_sessions | Active gambling games |
| 17 | game_events | Game event log |
| 18 | hall_of_fame_records | Record holders |
| 19 | heist_events | Heist event history |
| 20 | heist_quick_grab_pool | Quick grab phrases |
| 21 | heist_recent_events | Recent heist tracking |
| 22 | heist_riddle_pool | Heist riddles |
| 23 | heist_schedule | Scheduled heists |
| 24 | heist_trivia_pool | Trivia questions |
| 25 | heist_word_scramble_pool | Scramble words |
| 26 | items | Item definitions |
| 27 | leaderboard_history | Historical leaderboards |
| 28 | leaderboard_snapshots | Period snapshots |
| 29 | lottery_draws | Lottery draw records |
| 30 | lottery_tickets | Player tickets |
| 31 | mission_completions | Completed missions |
| 32 | mission_templates | Mission definitions |
| 33 | monetization_events | Sub/donation tracking |
| 34 | oauth_link_states | OAuth state tokens |
| 35 | player_gambling_stats | Gambling statistics |
| 36 | player_shop_inventory | Personal shop items |
| 37 | reward_config | Monetization rewards |
| 38 | session_contributions | Session donations |
| 39 | slot_jackpots | Progressive jackpot |
| 40 | streaming_sessions | Active sessions |
| 41 | territories | Territory definitions |
| 42 | user_achievements | Unlocked achievements |
| 43 | user_crates | Player crate inventory |
| 44 | user_inventory | Player item inventory |
| 45 | user_missions | Active missions |
| 46 | user_notifications | Player notifications |
| 47 | user_titles | Unlocked titles |
| 48 | users | Player accounts |

</details>

### 1.2 Seed Data Verification

| Data Type | Expected | Found | Status |
|-----------|----------|-------|--------|
| Factions | 3 | 3 | PASS |
| Territories | 12 | 12 | PASS |
| Items | 32+ | 32 | PASS |
| Achievements | 59 | 41 | NOTE |
| Mission Templates | 22 | 33 | PASS |
| Crate Titles | 40 | 40 | PASS |
| Reward Config | 8 | 8 | PASS |
| Heist Trivia | 50 | 52 | PASS |
| Heist Riddles | - | 25 | PASS |
| Heist Scrambles | - | 30 | PASS |
| Quick Grabs | - | 30 | PASS |
| Slot Jackpot | $10,000 | $10,000 | PASS |
| Crate Types | 5 | 5 | PASS |

#### Faction Details
```
ID | Name              | Starting Territory | Color
---|-------------------|-------------------|--------
1  | The Volkov Bratva | The Ports         | #DC143C
2  | Dead Circuit      | The Hollows       | #00FFFF
3  | Kessler Group     | Midtown           | #808000
```

#### Territory Control
```
Controlled (3):
  - The Ports (Volkov Bratva)
  - The Hollows (Dead Circuit)
  - Midtown (Kessler Group)

Unclaimed (9):
  - Chrome Heights, Neon Mile, Silicon Sprawl, Black Bazaar,
    Rustlands, Memorial District, Ashfall, Deadzone, Freeport
```

#### Item Breakdown
```
Type      | Count | Tiers
----------|-------|------------------
Weapons   | 8     | Common to Legendary
Armor     | 8     | Common to Legendary
Businesses| 8     | Common to Legendary
Housing   | 8     | Common to Legendary
```

#### Achievement Categories
```
Category    | Count
------------|------
Gambling    | 11
Wealth      | 8
Progression | 6
Loyalty     | 6
Combat      | 5
Activity    | 5
------------|------
Total       | 41
```

### 1.3 Index Verification

**Found: 88 indexes** - Comprehensive coverage for all tables

Key performance indexes verified:
- `idx_gambling_sessions_user_created` - Gambling queries
- `idx_coinflip_status_expires` - Open coinflip lookups
- `idx_lottery_tickets_user` - Lottery ticket queries
- `idx_oauth_link_state` - OAuth flow performance

### 1.4 Foreign Key Constraints

**Found: 45 foreign key constraints** - All relationships properly enforced

### 1.5 Database Issues & Resolutions

#### Issue: Achievement count lower than spec
- **Finding:** 41 achievements found vs 59 in original spec
- **Impact:** Low - core achievements exist
- **Resolution:** Optional - can add more achievements post-launch
- **Action Required:** None (design decision to simplify)

### 1.6 Database Action Items

| Priority | Action | Status |
|----------|--------|--------|
| None | Database is fully ready | COMPLETE |

---

## 2. GITHUB REPOSITORY

### Status: NOT READY - Code Not Pushed

### 2.1 Current State

| Check | Result |
|-------|--------|
| Repository exists | YES |
| Repository URL | https://github.com/SimianMonke/Kingpin |
| Commits | 4 |
| Visible files | README.md only |
| Full codebase pushed | **NO** |

### 2.2 Local Codebase Inventory

The complete codebase exists locally at:
```
C:\Users\Cam\Onedrive\Desktop\Monke\Kingpin
```

**Directory Structure:**
```
Kingpin/
├── web/                          # Next.js web application
│   ├── prisma/
│   │   ├── schema.prisma         # 48 model definitions
│   │   └── seed.ts               # All seed data
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # Authentication pages
│   │   │   ├── (dashboard)/      # 11 dashboard pages
│   │   │   └── api/              # 60+ API routes
│   │   ├── components/           # React components
│   │   ├── lib/
│   │   │   ├── db.ts             # Database client
│   │   │   ├── game/             # Game constants & formulas
│   │   │   └── services/         # 22 service files
│   │   └── types/                # TypeScript definitions
│   ├── package.json
│   ├── vercel.json               # Cron configuration
│   ├── .env.example              # Environment template
│   └── [config files]
├── bot/                          # Node.js chatbot
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── config.ts             # Configuration
│   │   ├── api-client.ts         # Web API client
│   │   ├── platforms/            # 3 platform connectors
│   │   ├── commands/             # 9 command modules
│   │   ├── handlers/             # Event handlers
│   │   └── utils/                # Utilities
│   ├── package.json
│   ├── .env.example
│   └── tsconfig.json
├── [21 specification documents]
└── DEPLOYMENT_READINESS_REPORT.md
```

### 2.3 Resolution Steps

#### Step 1: Open Terminal in Project Directory
```powershell
cd "C:\Users\Cam\Onedrive\Desktop\Monke\Kingpin"
```

#### Step 2: Check Current Git Status
```powershell
git status
```

#### Step 3: Create .gitignore (if not exists)
Create or verify `.gitignore` contains:
```gitignore
# Dependencies
node_modules/
.pnp/
.pnp.js

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
.next/
out/
build/
dist/

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Prisma
prisma/migrations/

# Vercel
.vercel
```

#### Step 4: Stage All Files
```powershell
git add .
```

#### Step 5: Verify What Will Be Committed
```powershell
git status
```

Verify these directories are included:
- `web/` (entire directory)
- `bot/` (entire directory)
- All `*.md` files

Verify these are NOT included:
- `node_modules/`
- `.env` files (only `.env.example`)

#### Step 6: Create Commit
```powershell
git commit -m "feat: Complete Kingpin codebase

- Web app: Next.js 16 with 22 services, 60+ API routes
- Bot: Multi-platform chatbot (Kick, Twitch, Discord)
- Database: Prisma schema with 48 models
- Features: Gambling, factions, heists, achievements, missions
- Specs: 21 design documents"
```

#### Step 7: Push to GitHub
```powershell
git push origin main
```

#### Step 8: Verify Push
1. Go to https://github.com/SimianMonke/Kingpin
2. Confirm `web/` and `bot/` directories are visible
3. Confirm file count increased significantly

### 2.4 GitHub Action Items

| Priority | Action | Command/Steps |
|----------|--------|---------------|
| CRITICAL | Push code to GitHub | See steps above |
| HIGH | Verify push successful | Check GitHub web UI |

---

## 3. WEB APPLICATION

### Status: CODE READY - Deployment Pending

### 3.1 Architecture Overview

```
Next.js 16 Application
├── Authentication: NextAuth.js with Kick/Twitch/Discord OAuth
├── Database: Prisma ORM with Neon PostgreSQL
├── API: 60+ REST endpoints
├── Cron: 4 scheduled jobs via Vercel
└── Webhooks: Kick, Twitch, Stripe handlers
```

### 3.2 Service Layer (22 Services)

| Service File | Purpose | Status |
|-------------|---------|--------|
| user.service.ts | User CRUD, profiles | COMPLETE |
| play.service.ts | !play action logic | COMPLETE |
| rob.service.ts | Robbery mechanics | COMPLETE |
| jail.service.ts | Jail/bail system | COMPLETE |
| inventory.service.ts | Item management | COMPLETE |
| shop.service.ts | Tier-based shop | COMPLETE |
| black-market.service.ts | Rotating market | COMPLETE |
| leaderboard.service.ts | All leaderboards | COMPLETE |
| achievement.service.ts | Achievement tracking | COMPLETE |
| title.service.ts | Title management | COMPLETE |
| mission.service.ts | Daily/weekly missions | COMPLETE |
| crate.service.ts | Crate system | COMPLETE |
| faction.service.ts | Faction management | COMPLETE |
| juicernaut.service.ts | Session competition | COMPLETE |
| heist.service.ts | Heist alerts | COMPLETE |
| monetization.service.ts | Sub/donation rewards | COMPLETE |
| notification.service.ts | Player notifications | COMPLETE |
| discord.service.ts | Discord webhooks | COMPLETE |
| lumia.service.ts | Stream overlays | COMPLETE |
| gambling.service.ts | All gambling games | COMPLETE |
| oauth-link.service.ts | Account linking | COMPLETE |
| economy-mode.service.ts | Economy controls | COMPLETE |

### 3.3 API Routes (60+ Endpoints)

<details>
<summary>Click to expand full API route list</summary>

**Authentication**
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET /api/auth/link/[platform]` - Start OAuth link
- `GET /api/auth/link/[platform]/callback` - OAuth callback

**Users**
- `GET /api/users/me` - Current user profile
- `GET /api/users/me/stats` - Detailed statistics
- `POST /api/users/me/checkin` - Daily check-in
- `GET /api/users/me/inventory` - Inventory list
- `POST /api/users/me/inventory/equip` - Equip item
- `POST /api/users/me/inventory/unequip` - Unequip item
- `POST /api/users/me/inventory/sell` - Sell item
- `POST /api/users/me/inventory/claim` - Claim business revenue
- `GET /api/users/me/shop` - Personal shop
- `POST /api/users/me/shop/buy` - Purchase from shop
- `POST /api/users/me/shop/reroll` - Reroll shop
- `GET /api/users/me/cooldowns` - Active cooldowns
- `GET /api/users/me/link` - Linked accounts
- `GET /api/users/[userId]` - Get user by ID
- `GET /api/users/lookup` - Lookup by platform ID
- `GET /api/users/by-name/[username]` - Lookup by username

**Gameplay**
- `POST /api/play` - Execute play action
- `POST /api/rob` - Execute rob action
- `POST /api/bail` - Bail out of jail

**Leaderboards**
- `GET /api/leaderboards` - Get leaderboard
- `GET /api/leaderboards/rank` - Get user rank
- `GET /api/leaderboards/records` - Hall of fame

**Missions & Achievements**
- `GET /api/missions` - Active missions
- `POST /api/missions/claim` - Claim mission reward
- `GET /api/achievements` - Achievement list
- `GET /api/titles` - Title list

**Factions**
- `GET /api/factions` - All factions
- `POST /api/factions` - Join faction
- `POST /api/factions/leave` - Leave faction
- `GET /api/factions/my-faction` - Current faction
- `GET /api/factions/territories` - Territory map
- `GET /api/factions/leaderboard` - Faction rankings

**Juicernaut**
- `GET /api/juicernaut` - Session standings
- `POST /api/juicernaut/admin` - Admin controls

**Crates**
- `GET /api/crates` - Crate inventory
- `POST /api/crates/claim` - Claim crate
- `POST /api/crates/open` - Open crate

**Heists**
- `GET /api/heist` - Current heist
- `GET /api/heist/history` - Heist history
- `POST /api/heist/admin` - Admin controls

**Gambling**
- `POST /api/gambling/slots` - Play slots
- `POST /api/gambling/blackjack` - Blackjack actions
- `POST /api/gambling/coinflip` - Coinflip actions
- `GET /api/gambling/lottery` - Lottery info
- `POST /api/gambling/lottery` - Buy ticket
- `GET /api/gambling/stats` - Gambling stats

**Market**
- `GET /api/market` - Black market items
- `POST /api/market/buy` - Purchase item

**Notifications**
- `GET /api/notifications` - Get notifications
- `GET /api/notifications/count` - Unread count
- `POST /api/notifications/clear` - Mark as read

**Webhooks**
- `POST /api/webhooks/kick` - Kick events
- `POST /api/webhooks/twitch` - Twitch EventSub
- `POST /api/webhooks/stripe` - Stripe payments

**Admin**
- `POST /api/admin/give` - Give items/wealth/XP

**Cron Jobs**
- `GET /api/cron/daily` - Daily reset
- `GET /api/cron/weekly` - Weekly reset
- `GET /api/cron/heist-check` - Heist scheduling
- `GET /api/cron/gambling` - Lottery draws, cleanup

</details>

### 3.4 Cron Job Configuration

File: `web/vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/weekly",
      "schedule": "0 0 * * 0"
    },
    {
      "path": "/api/cron/heist-check",
      "schedule": "*/2 * * * *"
    },
    {
      "path": "/api/cron/gambling",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

| Job | Schedule | Purpose |
|-----|----------|---------|
| daily | Midnight UTC | Reset daily missions, check-ins |
| weekly | Sunday midnight | Reset weekly missions, leaderboards |
| heist-check | Every 2 min | Schedule/trigger heist alerts |
| gambling | Every 5 min | Lottery draws, expire coinflips |

### 3.5 Dependencies

```json
{
  "dependencies": {
    "@auth/prisma-adapter": "^2.11.1",
    "@neondatabase/serverless": "^1.0.2",
    "@prisma/adapter-neon": "^7.1.0",
    "@prisma/client": "^7.1.0",
    "bcryptjs": "^3.0.3",
    "next": "16.0.10",
    "next-auth": "^4.24.13",
    "prisma": "^7.1.0",
    "react": "19.2.1",
    "react-dom": "19.2.1",
    "stripe": "^20.0.0",
    "zod": "^4.1.13"
  }
}
```

### 3.6 Vercel Deployment Steps

#### Step 1: Ensure Code is on GitHub
Complete [Section 2.3](#23-resolution-steps) first.

#### Step 2: Create Vercel Account/Login
1. Go to https://vercel.com
2. Sign in with GitHub account

#### Step 3: Import Project
1. Click "Add New..." → "Project"
2. Select "Import Git Repository"
3. Find `SimianMonke/Kingpin`
4. Click "Import"

#### Step 4: Configure Project Settings
```
Framework Preset: Next.js (auto-detected)
Root Directory: web
Build Command: (leave default)
Output Directory: (leave default)
Install Command: (leave default)
```

#### Step 5: Add Environment Variables

Click "Environment Variables" and add each variable from the list below.

**Required for initial deployment:**
```
DATABASE_URL=postgresql://[from Neon dashboard]
NEXTAUTH_SECRET=[generate: openssl rand -base64 32]
NEXTAUTH_URL=https://kingpin.simianmonke.com
```

**Add remaining variables after initial deployment** (see Section 6).

#### Step 6: Deploy
1. Click "Deploy"
2. Wait for build to complete (2-5 minutes)
3. Note the deployment URL

#### Step 7: Configure Custom Domain
1. Go to Project Settings → Domains
2. Add `kingpin.simianmonke.com`
3. Follow DNS configuration instructions
4. Add these DNS records to your domain:

```
Type  | Name | Value
------|------|---------------------------
A     | @    | 76.76.21.21
CNAME | www  | cname.vercel-dns.com
```

#### Step 8: Verify Deployment
1. Visit https://kingpin.simianmonke.com
2. Should see the application (may show auth errors until OAuth configured)

#### Step 9: Verify Cron Jobs
1. Go to Project Settings → Cron Jobs
2. Confirm all 4 jobs are listed
3. Jobs won't run until CRON_SECRET is set

### 3.7 Web Application Action Items

| Priority | Action | Status |
|----------|--------|--------|
| CRITICAL | Push code to GitHub | See Section 2 |
| CRITICAL | Deploy to Vercel | See steps above |
| CRITICAL | Configure domain | After deployment |
| HIGH | Set environment variables | See Section 6 |
| HIGH | Configure OAuth providers | See Section 5 |

---

## 4. BOT APPLICATION

### Status: CODE READY - Deployment Pending

### 4.1 Architecture Overview

```
Node.js Chatbot
├── Platforms: Kick (Pusher), Twitch (tmi.js), Discord (discord.js)
├── Commands: 40+ commands across 9 modules
├── API Client: Communicates with web app via REST
└── Event Handlers: Chat messages, redemptions
```

### 4.2 Platform Connectors

| Platform | Library | Features |
|----------|---------|----------|
| Kick | pusher-js | WebSocket chat, redemptions |
| Twitch | tmi.js | IRC chat, basic redemptions |
| Discord | discord.js | Full bot integration |

### 4.3 Command Modules

| Module | Commands |
|--------|----------|
| profile.ts | `!profile`, `!balance`, `!level` |
| inventory.ts | `!inventory`, `!crates`, `!shop`, `!market`, `!titles` |
| leaderboard.ts | `!lb`, `!rank` |
| faction.ts | `!factions`, `!faction`, `!territories` |
| juicernaut.ts | `!juice`, `!juicehall` |
| missions.ts | `!missions`, `!achievements` |
| heist.ts | `!grab` |
| gambling.ts | `!slots`, `!jackpot`, `!blackjack`, `!hit`, `!stand`, `!double`, `!flip`, `!accept`, `!flips`, `!cancelflip`, `!lottery`, `!lotto`, `!gamblestats` |
| admin.ts | `!startSession`, `!endSession`, `!giveWealth`, `!giveXp`, `!giveCrate` |

### 4.4 Dependencies

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1",
    "pusher-js": "^8.4.0-rc2",
    "tmi.js": "^1.8.5",
    "ws": "^8.16.0"
  }
}
```

### 4.5 Railway Deployment Steps

#### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign in with GitHub

#### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Find `SimianMonke/Kingpin`
4. Select repository

#### Step 3: Configure Service
1. Railway will detect multiple directories
2. Click on the created service
3. Go to Settings
4. Set **Root Directory**: `bot`
5. Set **Start Command**: `npm start`

#### Step 4: Add Environment Variables

Go to Variables tab and add:

```env
# API Configuration
API_BASE_URL=https://kingpin.simianmonke.com
BOT_API_KEY=[generate: openssl rand -hex 32]
ADMIN_API_KEY=[same as web app]

# Kick Configuration
KICK_ENABLED=true
KICK_CHANNEL_ID=[your Kick channel ID]
KICK_CHANNEL_SLUG=[your Kick username]
KICK_PUSHER_KEY=eb1d5f283081a78b932c
KICK_PUSHER_CLUSTER=us2

# Twitch Configuration
TWITCH_ENABLED=true
TWITCH_CHANNEL=[your Twitch channel]
TWITCH_BOT_USERNAME=[bot account username]
TWITCH_BOT_OAUTH=oauth:[token from twitchtokengenerator.com]

# Discord Configuration
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=[from Discord Developer Portal]
DISCORD_GUILD_ID=[your server ID]

# Bot Settings
NODE_ENV=production
LOG_LEVEL=info
COMMAND_PREFIX=!
COMMAND_COOLDOWN_MS=3000
```

#### Step 5: Deploy
1. Railway will automatically deploy when variables are set
2. Check deployment logs for errors
3. Verify bot connects to platforms

#### Step 6: Verify Bot Running
Check logs for:
```
============================================================
  KINGPIN BOT
  Multi-platform chatbot for Kingpin RPG
============================================================
Validating configuration...
Configuration valid
Initializing platform connections...
Connected to Kick
Connected to Twitch
Logged in to Discord as KingpinBot#1234
Bot is ready!
============================================================
```

### 4.6 Known Limitations

#### Kick Message Sending
- **Issue:** Kick's Pusher API is read-only for messages
- **Impact:** Bot can receive commands but cannot respond in Kick chat
- **Workaround:** Players see responses in web dashboard, or use Twitch/Discord
- **Future:** Kick may release official API with message support

### 4.7 Bot Action Items

| Priority | Action | Status |
|----------|--------|--------|
| HIGH | Create Twitch bot account | See Section 5.2 |
| HIGH | Create Discord bot | See Section 5.3 |
| HIGH | Deploy to Railway | See steps above |
| MEDIUM | Test all platforms | After deployment |

---

## 5. PLATFORM INTEGRATIONS

### 5.1 Kick Integration

#### Status: PARTIAL - Developer App Needed

#### What's Implemented
- WebSocket connection via Pusher
- Chat message parsing
- Channel point redemption handling
- Webhook handler with HMAC verification

#### What's Needed
1. Kick Developer Application
2. Channel point rewards
3. Webhook configuration

#### Step-by-Step Setup

##### A. Register Developer Application
1. Go to https://kick.com/dashboard/developer (when available)
2. Create new application
3. Note the Client ID and Client Secret
4. Set redirect URI: `https://kingpin.simianmonke.com/api/auth/callback/kick`

##### B. Get Channel Information
1. Go to your Kick channel
2. Note your channel slug (username)
3. Get channel ID from browser dev tools:
   - Open Network tab
   - Load your channel page
   - Look for API requests containing your channel ID

##### C. Create Channel Point Rewards
Create these rewards on your Kick channel:

| Reward Title | Cost | User Input | Purpose |
|-------------|------|------------|---------|
| Play Kingpin | 100 | No | Trigger !play |
| Rob Player | 500 | Yes (target) | Trigger !rob |
| Bail Out | 1000 | No | Trigger !bail |
| Reroll Shop | 250 | No | Refresh shop |

##### D. Configure Webhook (After Web Deployment)
1. In Kick developer dashboard, add webhook
2. URL: `https://kingpin.simianmonke.com/api/webhooks/kick`
3. Events to subscribe:
   - `channel.subscription.new`
   - `channel.subscription.gifts`
   - `kicks.gifted`
   - `channel.reward.redemption.updated`
4. Note the webhook secret
5. Add to Vercel environment: `KICK_WEBHOOK_SECRET`

#### Environment Variables for Kick
```env
# Web App
KICK_CLIENT_ID=your_client_id
KICK_CLIENT_SECRET=your_client_secret
KICK_WEBHOOK_SECRET=your_webhook_secret

# Bot
KICK_ENABLED=true
KICK_CHANNEL_ID=12345678
KICK_CHANNEL_SLUG=simianmonke
KICK_PUSHER_KEY=eb1d5f283081a78b932c
KICK_PUSHER_CLUSTER=us2
```

---

### 5.2 Twitch Integration

#### Status: PARTIAL - Developer App & Bot Account Needed

#### What's Implemented
- tmi.js chat connection
- EventSub webhook handler with verification + replay protection
- Channel point redemption handling (via EventSub)
- Subscription, gift, bits, raid processing

#### What's Needed
1. Twitch Developer Application
2. Bot account with OAuth token
3. EventSub webhook subscriptions
4. Channel point rewards

#### Step-by-Step Setup

##### A. Register Developer Application
1. Go to https://dev.twitch.tv/console
2. Click "Register Your Application"
3. Fill in details:
   - Name: `Kingpin Bot`
   - OAuth Redirect URLs: `https://kingpin.simianmonke.com/api/auth/callback/twitch`
   - Category: `Chat Bot`
4. Click "Create"
5. Note the Client ID
6. Click "New Secret" and note the Client Secret

##### B. Create Bot Account
1. Create new Twitch account for the bot (e.g., `KingpinBot`)
2. Go to https://twitchtokengenerator.com
3. Select "Bot Chat Token"
4. Authorize with the bot account
5. Copy the Access Token (starts with `oauth:`)

##### C. Create Channel Point Rewards
On your main Twitch channel:
1. Go to Creator Dashboard → Viewer Rewards → Channel Points
2. Create custom rewards:

| Reward Title | Cost | User Input | Purpose |
|-------------|------|------------|---------|
| Play Kingpin | 100 | No | Trigger !play |
| Rob Player | 500 | Yes (target) | Trigger !rob |
| Bail Out | 1000 | No | Trigger !bail |
| Reroll Shop | 250 | No | Refresh shop |

3. Note the Reward IDs (visible in URL when editing)

##### D. Configure EventSub Webhooks
After web app is deployed, use Twitch CLI or API:

```bash
# Install Twitch CLI
npm install -g twitch-cli

# Login
twitch configure

# Create webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "Save this: $WEBHOOK_SECRET"

# Subscribe to events
twitch api post eventsub/subscriptions -b '{
  "type": "channel.subscribe",
  "version": "1",
  "condition": {"broadcaster_user_id": "YOUR_CHANNEL_ID"},
  "transport": {
    "method": "webhook",
    "callback": "https://kingpin.simianmonke.com/api/webhooks/twitch",
    "secret": "YOUR_WEBHOOK_SECRET"
  }
}'

# Repeat for other event types:
# - channel.subscription.gift
# - channel.cheer
# - channel.raid
# - channel.channel_points_custom_reward_redemption.add
```

##### E. Get Channel/User IDs
```bash
# Get your broadcaster user ID
twitch api get users -q login=YOUR_CHANNEL_NAME
```

#### Environment Variables for Twitch
```env
# Web App
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_WEBHOOK_SECRET=your_webhook_secret

# Bot
TWITCH_ENABLED=true
TWITCH_CHANNEL=your_channel
TWITCH_BOT_USERNAME=kingpinbot
TWITCH_BOT_OAUTH=oauth:your_token_here
```

---

### 5.3 Discord Integration

#### Status: PARTIAL - Bot Creation Needed

#### What's Implemented
- discord.js bot with full message handling
- Permission checks (admin, mod, subscriber roles)
- Message sending to channels
- Activity tracking

#### What's Needed
1. Discord Developer Application
2. Bot token
3. Server invite with permissions
4. Channel configuration

#### Step-by-Step Setup

##### A. Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name: `Kingpin`
4. Click "Create"

##### B. Create Bot
1. Go to "Bot" section
2. Click "Add Bot"
3. Under "Privileged Gateway Intents", enable:
   - PRESENCE INTENT
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
4. Click "Reset Token" and copy the token
   - **SAVE THIS TOKEN SECURELY - You can only see it once!**

##### C. Configure OAuth2
1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Read Message History
   - Embed Links
   - Use External Emojis
   - Add Reactions
   - Manage Webhooks
4. Copy the generated URL

##### D. Invite Bot to Server
1. Open the OAuth2 URL in browser
2. Select your Discord server
3. Click "Authorize"

##### E. Get Server/Channel IDs
1. Enable Developer Mode in Discord:
   - User Settings → App Settings → Advanced → Developer Mode
2. Right-click server → "Copy Server ID"
3. Right-click channels → "Copy Channel ID"

##### F. Create Webhook for Feed Channel
1. Go to your #kingpin-feed channel settings
2. Click "Integrations" → "Webhooks"
3. Create new webhook named "Kingpin Feed"
4. Copy webhook URL

##### G. (Optional) Create Admin Webhook
Repeat for admin alerts channel

#### Environment Variables for Discord
```env
# Web App
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_FEED_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_ADMIN_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Bot
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_COMMAND_CHANNEL_ID=optional_specific_channel
DISCORD_FEED_CHANNEL_ID=feed_channel_id
```

---

### 5.4 Lumia Stream Integration

#### Status: CODE READY - Configuration Needed

#### What's Implemented
- LumiaService with 4 webhook triggers
- Session start/end alerts
- Crown change notifications
- Leaderboard updates

#### Setup Steps

##### A. Get Lumia Stream
1. Download from https://lumiastream.com
2. Install and configure

##### B. Create Webhooks in Lumia
1. Open Lumia Stream
2. Go to Alerts → Webhooks
3. Create 4 incoming webhooks:
   - Session Start
   - Session End
   - Crown Change
   - Leaderboard Update
4. Copy each webhook URL

#### Environment Variables for Lumia
```env
# Web App (all optional)
LUMIA_WEBHOOK_SESSION_START=https://lumia-webhook-url/session-start
LUMIA_WEBHOOK_SESSION_END=https://lumia-webhook-url/session-end
LUMIA_WEBHOOK_CROWN_CHANGE=https://lumia-webhook-url/crown-change
LUMIA_WEBHOOK_LEADERBOARD=https://lumia-webhook-url/leaderboard
```

---

### 5.5 Stripe Integration

#### Status: PARTIAL - Account Connection Needed

#### What's Implemented
- Stripe webhook handler with signature verification
- Checkout session handling
- Payment intent handling
- User metadata extraction

#### Setup Steps

##### A. Create/Access Stripe Account
1. Go to https://dashboard.stripe.com
2. Sign in or create account under Monke LLC

##### B. Get API Keys
1. Go to Developers → API Keys
2. Copy the Secret Key (starts with `sk_live_` or `sk_test_`)
3. Copy the Publishable Key (starts with `pk_live_` or `pk_test_`)

##### C. Create Donation Product
1. Go to Products
2. Click "Add Product"
3. Name: "Kingpin Donation"
4. Pricing: Customer chooses amount (or set fixed amounts)
5. Note the Price ID

##### D. Configure Webhook
1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://kingpin.simianmonke.com/api/webhooks/stripe`
4. Events to send:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
5. Click "Add endpoint"
6. Click "Reveal" under Signing Secret and copy it

##### E. Test with Stripe CLI (Optional)
```bash
# Install Stripe CLI
# Forward webhooks to local dev
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

#### Environment Variables for Stripe
```env
# Web App
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_DONATION_PRICE_ID=price_...
```

---

### 5.6 Platform Integration Checklist

| Platform | App Created | Credentials | Webhooks | Rewards | Ready |
|----------|-------------|-------------|----------|---------|-------|
| Kick | [ ] | [ ] | [ ] | [ ] | NO |
| Twitch | [ ] | [ ] | [ ] | [ ] | NO |
| Discord | [ ] | [ ] | [ ] | N/A | NO |
| Lumia | N/A | N/A | [ ] | N/A | NO |
| Stripe | [ ] | [ ] | [ ] | N/A | NO |

---

## 6. ENVIRONMENT VARIABLES

### 6.1 Web Application Variables

Location: Vercel Dashboard → Project → Settings → Environment Variables

#### Required Variables (Must set before first use)

```env
# Database (CRITICAL)
DATABASE_URL="postgresql://neondb_owner:***@ep-***.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Authentication (CRITICAL)
NEXTAUTH_SECRET="[generate: openssl rand -base64 32]"
NEXTAUTH_URL="https://kingpin.simianmonke.com"

# Application
NODE_ENV="production"
BASE_URL="https://kingpin.simianmonke.com"
```

#### Platform OAuth Variables (Required for user login)

```env
# Kick OAuth
KICK_CLIENT_ID=""
KICK_CLIENT_SECRET=""

# Twitch OAuth
TWITCH_CLIENT_ID=""
TWITCH_CLIENT_SECRET=""

# Discord OAuth
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
```

#### Webhook Variables (Required for monetization)

```env
# Webhook Secrets
KICK_WEBHOOK_SECRET=""
TWITCH_WEBHOOK_SECRET=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Cron Security
CRON_SECRET="[generate: openssl rand -hex 32]"
```

#### Integration Variables (Optional)

```env
# Discord Webhooks (for notifications)
DISCORD_FEED_WEBHOOK_URL=""
DISCORD_ADMIN_WEBHOOK_URL=""

# Lumia Stream (for overlay triggers)
LUMIA_WEBHOOK_SESSION_START=""
LUMIA_WEBHOOK_SESSION_END=""
LUMIA_WEBHOOK_CROWN_CHANGE=""
LUMIA_WEBHOOK_LEADERBOARD=""

# Stripe Product
STRIPE_PUBLISHABLE_KEY=""
STRIPE_DONATION_PRICE_ID=""
```

#### API Security Variables

```env
# Bot API Key (shared with bot)
BOT_API_KEY="[generate: openssl rand -hex 32]"
ADMIN_API_KEY="[generate: openssl rand -hex 32]"
```

### 6.2 Bot Application Variables

Location: Railway Dashboard → Service → Variables

```env
# API Configuration (CRITICAL)
API_BASE_URL="https://kingpin.simianmonke.com"
BOT_API_KEY="[same as web app BOT_API_KEY]"
ADMIN_API_KEY="[same as web app ADMIN_API_KEY]"

# Kick Configuration
KICK_ENABLED="true"
KICK_CHANNEL_ID="[your channel ID]"
KICK_CHANNEL_SLUG="[your username]"
KICK_PUSHER_KEY="eb1d5f283081a78b932c"
KICK_PUSHER_CLUSTER="us2"

# Twitch Configuration
TWITCH_ENABLED="true"
TWITCH_CHANNEL="[your channel]"
TWITCH_BOT_USERNAME="[bot account name]"
TWITCH_BOT_OAUTH="oauth:[token]"

# Discord Configuration
DISCORD_ENABLED="true"
DISCORD_BOT_TOKEN="[from Discord Developer Portal]"
DISCORD_GUILD_ID="[your server ID]"
DISCORD_COMMAND_CHANNEL_ID=""
DISCORD_FEED_CHANNEL_ID=""

# Bot Settings
NODE_ENV="production"
LOG_LEVEL="info"
COMMAND_PREFIX="!"
COMMAND_COOLDOWN_MS="3000"
```

### 6.3 Generate Secrets

Run these commands to generate required secrets:

```bash
# NEXTAUTH_SECRET (32 bytes, base64)
openssl rand -base64 32

# BOT_API_KEY (32 bytes, hex)
openssl rand -hex 32

# ADMIN_API_KEY (32 bytes, hex)
openssl rand -hex 32

# CRON_SECRET (32 bytes, hex)
openssl rand -hex 32

# TWITCH_WEBHOOK_SECRET (32 bytes, hex)
openssl rand -hex 32
```

**Example output:**
```
NEXTAUTH_SECRET=K7xN9QmZ3rT1vB8cF4dA2eH6jL0pU5wY1sI3gO7mX=
BOT_API_KEY=a1b2c3d4e5f6789012345678901234567890abcdef123456
ADMIN_API_KEY=f1e2d3c4b5a6789012345678901234567890fedcba654321
CRON_SECRET=9876543210abcdef9876543210abcdef9876543210abcdef
TWITCH_WEBHOOK_SECRET=abcdef1234567890abcdef1234567890abcdef1234567890
```

### 6.4 Environment Variable Checklist

#### Web App (Vercel)

| Variable | Required | Value Source | Set? |
|----------|----------|--------------|------|
| DATABASE_URL | YES | Neon Dashboard | [ ] |
| NEXTAUTH_SECRET | YES | Generate | [ ] |
| NEXTAUTH_URL | YES | Your domain | [ ] |
| NODE_ENV | YES | "production" | [ ] |
| BASE_URL | YES | Your domain | [ ] |
| KICK_CLIENT_ID | YES | Kick Dev Portal | [ ] |
| KICK_CLIENT_SECRET | YES | Kick Dev Portal | [ ] |
| KICK_WEBHOOK_SECRET | YES | Kick Dev Portal | [ ] |
| TWITCH_CLIENT_ID | YES | Twitch Dev Console | [ ] |
| TWITCH_CLIENT_SECRET | YES | Twitch Dev Console | [ ] |
| TWITCH_WEBHOOK_SECRET | YES | Generate | [ ] |
| DISCORD_CLIENT_ID | YES | Discord Dev Portal | [ ] |
| DISCORD_CLIENT_SECRET | YES | Discord Dev Portal | [ ] |
| STRIPE_SECRET_KEY | YES | Stripe Dashboard | [ ] |
| STRIPE_WEBHOOK_SECRET | YES | Stripe Dashboard | [ ] |
| BOT_API_KEY | YES | Generate | [ ] |
| ADMIN_API_KEY | YES | Generate | [ ] |
| CRON_SECRET | YES | Generate | [ ] |
| DISCORD_FEED_WEBHOOK_URL | NO | Discord Channel | [ ] |
| LUMIA_* | NO | Lumia Stream | [ ] |

#### Bot (Railway)

| Variable | Required | Value Source | Set? |
|----------|----------|--------------|------|
| API_BASE_URL | YES | Your domain | [ ] |
| BOT_API_KEY | YES | Same as web | [ ] |
| ADMIN_API_KEY | YES | Same as web | [ ] |
| KICK_ENABLED | YES | "true"/"false" | [ ] |
| KICK_CHANNEL_ID | YES* | Kick | [ ] |
| KICK_CHANNEL_SLUG | YES* | Kick | [ ] |
| KICK_PUSHER_KEY | YES* | Public | [ ] |
| TWITCH_ENABLED | YES | "true"/"false" | [ ] |
| TWITCH_CHANNEL | YES* | Your channel | [ ] |
| TWITCH_BOT_USERNAME | YES* | Bot account | [ ] |
| TWITCH_BOT_OAUTH | YES* | Token Gen | [ ] |
| DISCORD_ENABLED | YES | "true"/"false" | [ ] |
| DISCORD_BOT_TOKEN | YES* | Discord Dev | [ ] |
| DISCORD_GUILD_ID | YES* | Your server | [ ] |

*Required if platform is enabled

---

## 7. DEPLOYMENT CHECKLIST

### Phase 1: Code & Database (Day 1)

- [ ] **1.1** Verify database is seeded (already complete)
- [ ] **1.2** Create/verify `.gitignore` file
- [ ] **1.3** Stage all files: `git add .`
- [ ] **1.4** Commit: `git commit -m "Full Kingpin codebase"`
- [ ] **1.5** Push to GitHub: `git push origin main`
- [ ] **1.6** Verify code visible on GitHub

### Phase 2: Vercel Deployment (Day 1)

- [ ] **2.1** Create Vercel project
- [ ] **2.2** Import GitHub repository
- [ ] **2.3** Set root directory to `web`
- [ ] **2.4** Add DATABASE_URL environment variable
- [ ] **2.5** Add NEXTAUTH_SECRET (generate new)
- [ ] **2.6** Add NEXTAUTH_URL
- [ ] **2.7** Deploy initial version
- [ ] **2.8** Configure custom domain
- [ ] **2.9** Update DNS records
- [ ] **2.10** Verify domain works

### Phase 3: Platform Apps (Day 1-2)

#### Kick
- [ ] **3.1** Register Kick Developer Application
- [ ] **3.2** Note Client ID and Secret
- [ ] **3.3** Get channel ID and slug

#### Twitch
- [ ] **3.4** Register Twitch Developer Application
- [ ] **3.5** Note Client ID and Secret
- [ ] **3.6** Create bot account
- [ ] **3.7** Generate bot OAuth token
- [ ] **3.8** Get broadcaster user ID

#### Discord
- [ ] **3.9** Create Discord Application
- [ ] **3.10** Create bot and get token
- [ ] **3.11** Configure OAuth2 URL
- [ ] **3.12** Invite bot to server
- [ ] **3.13** Get server and channel IDs
- [ ] **3.14** Create feed channel webhook

#### Stripe
- [ ] **3.15** Access Stripe dashboard
- [ ] **3.16** Get API keys
- [ ] **3.17** Create donation product

### Phase 4: Environment Variables (Day 2)

- [ ] **4.1** Generate all secrets (see 6.3)
- [ ] **4.2** Add Kick credentials to Vercel
- [ ] **4.3** Add Twitch credentials to Vercel
- [ ] **4.4** Add Discord credentials to Vercel
- [ ] **4.5** Add Stripe credentials to Vercel
- [ ] **4.6** Add API keys to Vercel
- [ ] **4.7** Add CRON_SECRET to Vercel
- [ ] **4.8** Redeploy Vercel

### Phase 5: Webhooks (Day 2)

- [ ] **5.1** Configure Kick webhook endpoint
- [ ] **5.2** Configure Twitch EventSub subscriptions
- [ ] **5.3** Configure Stripe webhook endpoint
- [ ] **5.4** Add webhook secrets to Vercel
- [ ] **5.5** Redeploy Vercel

### Phase 6: Bot Deployment (Day 2)

- [ ] **6.1** Create Railway project
- [ ] **6.2** Connect GitHub repository
- [ ] **6.3** Set root directory to `bot`
- [ ] **6.4** Add all bot environment variables
- [ ] **6.5** Deploy bot
- [ ] **6.6** Verify bot connects to all platforms

### Phase 7: Channel Point Rewards (Day 2)

#### Kick
- [ ] **7.1** Create "Play Kingpin" reward (100 points)
- [ ] **7.2** Create "Rob Player" reward (500 points)
- [ ] **7.3** Create "Bail Out" reward (1000 points)
- [ ] **7.4** Create "Reroll Shop" reward (250 points)

#### Twitch
- [ ] **7.5** Create "Play Kingpin" reward (100 points)
- [ ] **7.6** Create "Rob Player" reward (500 points)
- [ ] **7.7** Create "Bail Out" reward (1000 points)
- [ ] **7.8** Create "Reroll Shop" reward (250 points)

### Phase 8: Testing (Day 3)

- [ ] **8.1** Test user registration via web
- [ ] **8.2** Test OAuth login (all platforms)
- [ ] **8.3** Test bot commands on Twitch
- [ ] **8.4** Test bot commands on Discord
- [ ] **8.5** Test channel point redemptions
- [ ] **8.6** Test gambling features
- [ ] **8.7** Test cron jobs execute
- [ ] **8.8** Test webhook receives events

---

## 8. POST-DEPLOYMENT TESTING

### 8.1 Web Application Tests

#### Authentication
```
[ ] Visit https://kingpin.simianmonke.com
[ ] Click "Login with Twitch" → Complete OAuth → Redirected to dashboard
[ ] Click "Login with Discord" → Complete OAuth → Redirected to dashboard
[ ] Click "Login with Kick" → Complete OAuth → Redirected to dashboard
[ ] Verify user created in database
```

#### Dashboard
```
[ ] Profile page loads with correct data
[ ] Inventory page shows empty inventory
[ ] Shop page shows tier-appropriate items
[ ] Leaderboards page loads
[ ] Missions page shows daily/weekly missions
[ ] Achievements page shows locked achievements
[ ] Faction page shows all factions
```

#### API Endpoints
```bash
# Test health check
curl https://kingpin.simianmonke.com/api/webhooks/kick
# Expected: {"status":"ok","webhook":"kick",...}

curl https://kingpin.simianmonke.com/api/webhooks/twitch
# Expected: {"status":"ok","webhook":"twitch",...}

curl https://kingpin.simianmonke.com/api/webhooks/stripe
# Expected: {"status":"ok","webhook":"stripe",...}
```

### 8.2 Bot Tests

#### Twitch
```
[ ] Bot joins channel
[ ] !profile responds with user data
[ ] !balance responds with wealth
[ ] !lb responds with leaderboard
[ ] !slots 100 plays slots game
[ ] !blackjack 100 starts blackjack
[ ] Admin commands work for broadcaster
```

#### Discord
```
[ ] Bot appears online in server
[ ] !profile responds in configured channel
[ ] !balance responds
[ ] !lb responds
[ ] Commands ignored in non-configured channels (if set)
```

#### Kick
```
[ ] Bot connects (check Railway logs)
[ ] Messages received (check logs)
[ ] Note: Bot cannot respond in Kick chat
```

### 8.3 Webhook Tests

#### Stripe (Use test mode)
```bash
# Using Stripe CLI
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.twitch_user_id=123456 \
  --add checkout_session:metadata.username=testuser
```

#### Twitch EventSub
```bash
# Trigger test event
twitch event trigger channel.subscribe \
  --secret YOUR_WEBHOOK_SECRET \
  -F https://kingpin.simianmonke.com/api/webhooks/twitch
```

### 8.4 Cron Job Tests

Check Vercel dashboard → Project → Cron Jobs:
```
[ ] /api/cron/daily shows in list
[ ] /api/cron/weekly shows in list
[ ] /api/cron/heist-check shows in list
[ ] /api/cron/gambling shows in list
[ ] Check logs after scheduled run time
```

### 8.5 Gambling Tests

```
[ ] !slots 100 - Verify money deducted, reels shown
[ ] !slots 100 - Play multiple times, verify jackpot contribution
[ ] !jackpot - Shows current jackpot pool
[ ] !blackjack 100 - Starts hand, shows cards
[ ] !hit - Draws card
[ ] !stand - Dealer plays, result shown
[ ] !double - Doubles bet, draws one card
[ ] !flip 500 heads - Creates coinflip challenge
[ ] !flips - Lists open challenges
[ ] !accept [id] - Accepts challenge, resolves flip
[ ] !lottery 5 10 15 - Buys ticket
[ ] !lotto - Shows lottery info
[ ] !gamblestats - Shows gambling statistics
```

### 8.6 Full User Journey Test

```
1. [ ] New user visits site
2. [ ] Logs in via Twitch
3. [ ] Sees empty profile (Level 1, $0)
4. [ ] Goes to stream, uses "Play Kingpin" reward
5. [ ] Receives wealth and XP
6. [ ] Uses !profile in chat, sees updated stats
7. [ ] Uses !shop in chat, sees available items
8. [ ] Plays !slots 100, wins/loses
9. [ ] Checks !missions, sees progress
10. [ ] Returns to web dashboard, sees all updates
```

---

## APPENDIX A: TROUBLESHOOTING

### Database Connection Issues
```
Error: Can't reach database server
Solution:
1. Check DATABASE_URL is correct
2. Verify Neon project is active
3. Check IP allowlist in Neon (should allow all: 0.0.0.0/0)
```

### OAuth Redirect Errors
```
Error: Redirect URI mismatch
Solution:
1. Check redirect URIs in platform dev portal match exactly:
   - https://kingpin.simianmonke.com/api/auth/callback/kick
   - https://kingpin.simianmonke.com/api/auth/callback/twitch
   - https://kingpin.simianmonke.com/api/auth/callback/discord
2. No trailing slashes
3. HTTPS required
```

### Bot Not Responding
```
Issue: Bot shows connected but doesn't respond
Solutions:
1. Check Railway logs for errors
2. Verify BOT_API_KEY matches between web and bot
3. Verify API_BASE_URL is correct and accessible
4. Check command prefix matches (default: !)
```

### Webhook Not Receiving Events
```
Issue: Webhooks registered but events not processing
Solutions:
1. Verify webhook URL is accessible (test with curl)
2. Check webhook secret matches
3. Review Vercel function logs for errors
4. For Twitch, verify EventSub subscription is "enabled"
```

### Cron Jobs Not Running
```
Issue: Scheduled jobs not executing
Solutions:
1. Cron jobs require Vercel Pro plan for < 1 day intervals
2. Check CRON_SECRET is set
3. Review cron job logs in Vercel dashboard
4. Verify vercel.json is in web/ root
```

---

## APPENDIX B: USEFUL COMMANDS

### Database
```bash
# Connect to database
npx prisma studio

# Reset database (DESTRUCTIVE)
npx prisma migrate reset

# Re-run seed
npx tsx prisma/seed.ts
```

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# View logs
vercel logs kingpin.simianmonke.com
```

### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs
```

### Twitch CLI
```bash
# Install
npm i -g twitch-cli

# Configure
twitch configure

# Test webhook
twitch event trigger channel.subscribe -F https://your-url/api/webhooks/twitch
```

### Stripe CLI
```bash
# Install (Windows)
scoop install stripe

# Login
stripe login

# Listen to webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

---

## APPENDIX C: SUPPORT RESOURCES

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org/getting-started/introduction)
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)

### Platform Developer Portals
- [Kick Developer](https://kick.com/dashboard/developer)
- [Twitch Developer Console](https://dev.twitch.tv/console)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Stripe Dashboard](https://dashboard.stripe.com)

### API Documentation
- [Twitch API](https://dev.twitch.tv/docs/api)
- [Twitch EventSub](https://dev.twitch.tv/docs/eventsub)
- [Discord API](https://discord.com/developers/docs)
- [Stripe API](https://stripe.com/docs/api)

---

**END OF DOCUMENT**

*Last Updated: 2025-12-15*
