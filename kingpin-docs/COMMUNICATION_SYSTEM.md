# COMMUNICATION SYSTEM - Implementation Documentation

## Overview

The Communication System handles multi-platform chat integration (Kick, Twitch, Discord), message tracking, command parsing, and Discord feed notifications for major game events.

**Current Implementation Status:** Complete

---

## Database Schema

### Chat Messages: `chat_messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Message ID |
| `user_id` | INT (FK) | Sender user ID |
| `platform` | VARCHAR(20) | kick, twitch, discord |
| `message_content` | TEXT | Message text |
| `is_command` | BOOLEAN | Whether it's a command |
| `channel_id` | VARCHAR(100) | Channel identifier |
| `created_at` | TIMESTAMP | Message timestamp |

### Discord Server Config: `discord_server_config`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Config ID |
| `server_id` | VARCHAR(50) | Discord server ID |
| `feed_channel_id` | VARCHAR(50) | Kingpin feed channel |
| `admin_role_id` | VARCHAR(50) | Admin role |
| `is_active` | BOOLEAN | Whether enabled |

### Bot Config: `bot_config`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Config ID |
| `platform` | VARCHAR(20) | Platform |
| `channel_name` | VARCHAR(100) | Channel name |
| `bot_username` | VARCHAR(100) | Bot username |
| `is_active` | BOOLEAN | Whether active |
| `settings` | JSONB | Platform-specific settings |

---

## Discord Feed Events

### Event Types Posted to Discord

```typescript
const DISCORD_FEED_CONFIG = {
  // Filters for major events only
  TIER_PROMOTION_MIN_TIER: 'Captain',   // Captain+ promotions
  ACHIEVEMENT_MIN_TIER: 'platinum',      // Platinum+ achievements
  CRATE_DROP_MIN_TIER: 'rare',           // Rare+ crate opens

  COLORS: {
    PURPLE: 0x9146FF,      // Monetization/Juicernaut
    GOLD: 0xFFD700,        // Achievements/Legendary
    GREEN: 0x00FF00,       // Success events
    RED: 0xFF0000,         // Territory lost
    BLUE: 0x0099FF,        // Faction events
    ORANGE: 0xFF9900,      // Heist events
  },
}
```

### Events Posted

| Event | Condition | Color |
|-------|-----------|-------|
| Tier Promotion | Captain+ | Gold |
| Achievement Unlock | Platinum+ | Gold |
| Crate Open | Rare+ | Varies |
| Juicernaut Crown | Always | Purple |
| Item Theft | Always | Red |
| Territory Change | Always | Blue |
| Hall of Fame Record | Always | Gold |
| Heist Winner | Always | Orange |

---

## Service Layer Implementation

**File:** `web/src/lib/services/discord.service.ts`

### Public Methods

```typescript
export const DiscordService = {
  /**
   * Post embed to Discord feed channel
   */
  async postToFeed(embed: DiscordEmbed): Promise<void>

  /**
   * Post tier promotion announcement
   */
  async postTierPromotion(userId: number, newTier: string): Promise<void>

  /**
   * Post achievement unlock
   */
  async postAchievement(userId: number, achievement: Achievement): Promise<void>

  /**
   * Post crate opening result
   */
  async postCrateOpen(userId: number, crateTier: string, result: CrateResult): Promise<void>

  /**
   * Post Juicernaut crown change
   */
  async postJuicernautCrown(userId: number, totalUsd: number): Promise<void>

  /**
   * Post item theft notification
   */
  async postItemTheft(
    attackerName: string,
    victimName: string,
    itemName: string,
    itemTier: string
  ): Promise<void>

  /**
   * Post territory change announcement
   */
  async postTerritoryChange(
    territory: Territory,
    oldFaction: Faction,
    newFaction: Faction
  ): Promise<void>

  /**
   * Post new hall of fame record
   */
  async postNewRecord(recordType: string, userId: number, value: number): Promise<void>

  /**
   * Post heist winner
   */
  async postHeistWinner(
    heistType: string,
    winnerName: string,
    crateTier: string
  ): Promise<void>
}
```

### Discord Embed Format

```typescript
interface DiscordEmbed {
  title: string
  description: string
  color: number
  thumbnail?: { url: string }
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  footer?: { text: string }
  timestamp?: string
}

async function postToFeed(embed: DiscordEmbed): Promise<void> {
  const config = await prisma.discord_server_config.findFirst({
    where: { is_active: true },
  })

  if (!config?.feed_channel_id) return

  await fetch(`https://discord.com/api/webhooks/${config.webhook_id}/${config.webhook_token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  })
}
```

### Example Post Functions

```typescript
async function postTierPromotion(userId: number, newTier: string): Promise<void> {
  // Only post Captain+ promotions
  if (!['Captain', 'Underboss', 'Kingpin'].includes(newTier)) return

  const user = await UserService.findById(userId)

  await postToFeed({
    title: '🎖️ Tier Promotion!',
    description: `**${user.display_name}** has reached **${newTier}**!`,
    color: DISCORD_FEED_CONFIG.COLORS.GOLD,
    timestamp: new Date().toISOString(),
  })
}

async function postJuicernautCrown(userId: number, totalUsd: number): Promise<void> {
  const user = await UserService.findById(userId)

  await postToFeed({
    title: '👑 New Juicernaut!',
    description: `**${user.display_name}** has claimed the Juicernaut crown!`,
    color: DISCORD_FEED_CONFIG.COLORS.PURPLE,
    fields: [
      { name: 'Total Contributed', value: `$${totalUsd.toFixed(2)}`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  })
}
```

---

## Chat Message Tracking

### Message Recording

```typescript
async function recordMessage(
  userId: number,
  platform: Platform,
  content: string,
  channelId: string
): Promise<void> {
  const isCommand = content.startsWith('!')

  await prisma.chat_messages.create({
    data: {
      user_id: userId,
      platform,
      message_content: content,
      is_command: isCommand,
      channel_id: channelId,
    },
  })

  // Update leaderboard
  await LeaderboardService.updateSnapshot(userId, {
    messages_sent: 1,
  })

  // Update mission progress
  await MissionService.updateProgress(userId, 'messages_sent', 1)

  // Add territory score
  await FactionService.addTerritoryScore(userId, 'message')
}
```

---

## Notification System

**File:** `web/src/lib/services/notification.service.ts`

### Notification Types

```typescript
const NOTIFICATION_TYPES = {
  CHECKIN: 'checkin',
  CHECKIN_MILESTONE: 'checkin_milestone',
  LEVEL_UP: 'level_up',
  TIER_PROMOTION: 'tier_promotion',
  ROBBED: 'robbed',
  ROB_DEFENDED: 'rob_defended',
  ITEM_STOLEN: 'item_stolen',
  ITEM_BROKE: 'item_broke',
  CRATE_RECEIVED: 'crate_received',
  CRATE_ESCROW: 'crate_escrow',
  CRATE_EXPIRED: 'crate_expired',
  ACHIEVEMENT: 'achievement',
  TITLE_UNLOCKED: 'title_unlocked',
  MISSION_COMPLETE: 'mission_complete',
  MISSION_EXPIRED: 'mission_expired',
  FACTION_JOINED: 'faction_joined',
  TERRITORY_CAPTURED: 'territory_captured',
  TERRITORY_LOST: 'territory_lost',
  FACTION_REWARD: 'faction_reward',
  JUICERNAUT_CROWN: 'juicernaut_crown',
  JUICERNAUT_DETHRONED: 'juicernaut_dethroned',
  JUICERNAUT_REWARD: 'juicernaut_reward',
  MONETIZATION: 'monetization',
  HEIST_WON: 'heist_won',
  BLACK_MARKET_ROTATION: 'black_market_rotation',
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  checkin: '✅',
  checkin_milestone: '🔥',
  level_up: '🎉',
  tier_promotion: '🎖️',
  robbed: '💸',
  rob_defended: '🛡️',
  item_stolen: '🔥',
  item_broke: '💥',
  crate_received: '📦',
  // ... etc
}
```

### NotificationService Methods

```typescript
export const NotificationService = {
  /**
   * Create a notification
   */
  async create(
    userId: number,
    type: NotificationType,
    data: NotificationData
  ): Promise<Notification>

  /**
   * Get user's notifications
   */
  async getNotifications(
    userId: number,
    limit?: number,
    unreadOnly?: boolean
  ): Promise<Notification[]>

  /**
   * Mark notification as read
   */
  async markAsRead(userId: number, notificationId: number): Promise<void>

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: number): Promise<void>

  /**
   * Dismiss notification
   */
  async dismiss(userId: number, notificationId: number): Promise<void>

  /**
   * Clean old notifications
   */
  async cleanOldNotifications(): Promise<number>
}
```

### Notification Configuration

```typescript
const NOTIFICATION_CONFIG = {
  MAX_PER_USER: 25,           // Keep max 25 notifications
  RETENTION_DAYS: 30,         // Delete after 30 days
  BATCH_WINDOW_MS: 60000,     // 60 seconds for batching
  POLL_INTERVAL_MS: 30000,    // 30 seconds UI polling
}
```

---

## API Endpoints

### GET /api/notifications
Get user's notifications.

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "type": "robbed",
        "title": "You were robbed!",
        "message": "PlayerX robbed you for $5,000",
        "icon": "💸",
        "is_seen": false,
        "created_at": "2024-01-15T14:30:00Z"
      }
    ],
    "unreadCount": 3
  }
}
```

### POST /api/notifications/read
Mark notification(s) as read.

### POST /api/notifications/dismiss
Dismiss notification(s).

---

## Lumia Integration

**File:** `web/src/lib/services/lumia.service.ts`

```typescript
export const LumiaService = {
  /**
   * Trigger Juicernaut crown effect
   */
  async triggerJuicernautCrown(username: string): Promise<void>

  /**
   * Post leaderboard update to stream
   */
  async postLeaderboard(leaderboard: LeaderboardEntry[]): Promise<void>

  /**
   * Trigger heist alert effect
   */
  async triggerHeistAlert(heistType: string): Promise<void>
}

const LUMIA_CONFIG = {
  LEADERBOARD_INTERVAL_MINUTES: 30,  // Post every 30 min during stream
}
```

---

## System Interdependencies

### Depends On
- **User System:** User lookups for display names
- **Database Layer:** Message/notification storage

### Depended On By
- **All Systems:** Notifications created throughout
- **Leaderboard System:** Message counting
- **Mission System:** Message objectives
- **Faction System:** Message territory scoring

---

## Configuration & Constants

```typescript
const DISCORD_FEED_CONFIG = {
  TIER_PROMOTION_MIN_TIER: 'Captain',
  ACHIEVEMENT_MIN_TIER: 'platinum',
  CRATE_DROP_MIN_TIER: 'rare',
  COLORS: {
    PURPLE: 0x9146FF,
    GOLD: 0xFFD700,
    GREEN: 0x00FF00,
    RED: 0xFF0000,
    BLUE: 0x0099FF,
    ORANGE: 0xFF9900,
  },
}

const NOTIFICATION_CONFIG = {
  MAX_PER_USER: 25,
  RETENTION_DAYS: 30,
  BATCH_WINDOW_MS: 60000,
  POLL_INTERVAL_MS: 30000,
}
```

---

## Known Limitations & TODOs

### Completed Features
- Multi-platform chat tracking
- Discord webhook integration
- Filtered feed posts (major events only)
- Notification system with icons
- Message-based leaderboard/mission/faction tracking
- Lumia stream integration

### Technical Notes
- Discord posts filtered to reduce spam
- Notifications auto-clean after 30 days
- Max 25 notifications per user
- 30-second UI polling interval

---

**File Location:** `web/src/lib/services/discord.service.ts`, `web/src/lib/services/notification.service.ts`
**Related Files:**
- `web/src/lib/services/lumia.service.ts`
- `web/src/lib/game/constants.ts` (NOTIFICATION_TYPES)
- `web/src/app/api/notifications/route.ts`
