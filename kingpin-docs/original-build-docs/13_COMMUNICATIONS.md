# 13. COMMUNICATIONS SYSTEM

---

## OVERVIEW

The communications system manages all announcements, notifications, and alerts across multiple channels. It includes spam prevention through event batching and priority-based routing.

---

## COMMUNICATION CHANNELS

| Channel | Purpose | Audience |
|---------|---------|----------|
| Kick/Twitch Chat | In-stream announcements | All viewers |
| Discord Activity Channels | Community announcements | Discord members |
| Discord Feed (#kingpin-feed) | Major events only | Discord members |
| Website Notifications | Personal alerts | Individual user |
| Discord Admin Webhook | System alerts | Streamer only |
| Lumia Stream Webhooks | Overlay/audio triggers | Stream overlay |

---

## EVENT BATCHING

To prevent chat spam, similar events are batched within time windows.

### Batched Events

| Event Type | Batch Window | Format |
|------------|--------------|--------|
| Level ups | 60 seconds | "🎉 3 players leveled up: @P1 (25), @P2 (18), @P3 (42)" |
| Tier promotions | 60 seconds | Combined announcement |
| Common/Uncommon crate drops | 60 seconds | Batched list |
| Territory changes | At daily reset | Summary of all changes |
| Gold achievements | 60 seconds | Combined list |
| Daily mission completions | 60 seconds | Combined list |

### Never Batched (Always Immediate)

| Event | Reason |
|-------|--------|
| Juicernaut crown changes | High drama, real-time competition |
| Legendary crate/item drops | Rare, celebration worthy |
| Legendary achievements | Major accomplishment |
| Monetization events | Immediate gratitude |
| Rob with item theft | Dramatic moment |
| Contested territory captures | Faction competition highlight |
| Weekly faction winners | Major announcement |

### Batch Processing

```javascript
const batchQueue = new Map();

async function queueBatchEvent(eventType, payload) {
    const key = `${eventType}:${getCurrentMinute()}`;
    
    if (!batchQueue.has(key)) {
        batchQueue.set(key, []);
        // Schedule processing after batch window
        setTimeout(() => processBatch(key), 60000);
    }
    
    batchQueue.get(key).push(payload);
}

async function processBatch(key) {
    const events = batchQueue.get(key);
    batchQueue.delete(key);
    
    if (events.length === 1) {
        // Single event, announce normally
        await announceEvent(events[0]);
    } else {
        // Multiple events, batch format
        await announceBatchedEvents(events);
    }
}
```

---

## WEBSITE NOTIFICATIONS

### Notification Structure

| Field | Type | Description |
|-------|------|-------------|
| notification_id | INT | Unique ID |
| user_id | INT | Recipient |
| notification_type | VARCHAR | Event type |
| title | VARCHAR(200) | Short title |
| message | TEXT | Full message |
| icon | VARCHAR(50) | Emoji/icon |
| link_type | VARCHAR | 'profile', 'leaderboard', etc. |
| link_id | VARCHAR | Target ID |
| is_seen | BOOLEAN | Viewed status |
| is_dismissed | BOOLEAN | Manually dismissed |

### Notification Limits

| Limit | Value |
|-------|-------|
| Retention | 30 days |
| Max per user | 25 (oldest auto-deleted) |

### Notification States

1. **Unseen** - Badge count shown
2. **Seen** - Tab opened, badge clears
3. **Dismissed** - Manually removed

### Notification Types (25)

| Type | Title | Icon |
|------|-------|------|
| checkin | "Check-in recorded!" | ✅ |
| checkin_milestone | "Streak milestone!" | 🔥 |
| level_up | "Level up!" | 🎉 |
| tier_promotion | "Tier promotion!" | 🎖️ |
| robbed | "You were robbed!" | 💸 |
| rob_defended | "Robbery blocked!" | 🛡️ |
| item_stolen | "Item stolen!" | 🔥 |
| item_broke | "Item destroyed!" | 💥 |
| crate_received | "Crate received!" | 📦 |
| crate_escrow | "Crate in escrow!" | ⚠️ |
| crate_expired | "Crate expired!" | ❌ |
| achievement | "Achievement unlocked!" | 🏅 |
| title_unlocked | "Title unlocked!" | 🏷️ |
| mission_complete | "Missions complete!" | 🎯 |
| mission_expired | "Missions expired!" | ⏰ |
| faction_joined | "Faction joined!" | ⚔️ |
| territory_captured | "Territory captured!" | 🏴 |
| territory_lost | "Territory lost!" | 💔 |
| faction_reward | "Faction reward!" | 🎁 |
| juicernaut_crown | "You're the Juicernaut!" | 👑 |
| juicernaut_dethroned | "Crown lost!" | 😢 |
| juicernaut_reward | "Session reward!" | 🏆 |
| monetization | "Thank you!" | 💜 |
| heist_won | "Heist won!" | 🚨 |
| black_market_rotation | "Black Market updated!" | 🏪 |

---

## DISCORD INTEGRATION

### Channel Configuration

| Channel Type | Purpose |
|--------------|---------|
| Commands Channel | Bot commands only (messages don't count) |
| Activity Channels | Community chat (messages count toward metrics) |
| Feed Channel | Major event announcements |

### Admin Setup Commands

| Command | Description |
|---------|-------------|
| `!kp-admin setchannel commands` | Set commands channel |
| `!kp-admin addchannel activity` | Add activity channel |
| `!kp-admin removechannel activity` | Remove activity channel |
| `!kp-admin setchannel feed` | Set feed channel |
| `!kp-admin listchannels` | View configuration |

### Discord Feed Events

Only major events post to #kingpin-feed:

| Event | Criteria |
|-------|----------|
| Tier promotions | Captain+ (Level 60+) |
| Crate drops | Rare or Legendary |
| Achievements | Platinum or Legendary |
| Territory captures | Any |
| Weekly faction winners | Always |
| Item thefts | Always |
| Legendary drops | Always |
| Faction victories | Always |

### Feed Message Format

```javascript
const embed = {
    color: getEventColor(event),
    title: event.title,
    description: event.message,
    thumbnail: { url: event.icon_url },
    timestamp: new Date().toISOString(),
    footer: { text: "Kingpin RPG" }
};
```

---

## DISCORD ADMIN WEBHOOK

All significant events post to admin webhook for streamer visibility.

### Events Posted

| Category | Events |
|----------|--------|
| Monetization | All subs, donations, bits, gifts |
| Juicernaut | Crown changes, session end |
| Achievements | Platinum+ unlocks |
| System | Errors, warnings |
| Session | Start, end, summary |
| Territory | Captures, weekly results |
| Legendary | Item drops, crate opens |
| Refunds | Any processed refunds |

### Webhook Payload

```javascript
{
    content: null,
    embeds: [{
        title: "💜 New Subscription!",
        description: "@PlayerName subscribed (Tier 1)",
        color: 0x9146FF,
        fields: [
            { name: "Rewards", value: "$500 + 100 XP", inline: true },
            { name: "Juicernaut", value: "$5.00 added", inline: true }
        ],
        timestamp: new Date().toISOString()
    }]
}
```

---

## LUMIA STREAM WEBHOOKS

Trigger overlay animations and audio for stream production.

### Webhook Events

| Event | Environment Variable |
|-------|---------------------|
| Session Start | LUMIA_WEBHOOK_SESSION_START |
| Session End | LUMIA_WEBHOOK_SESSION_END |
| Crown Change | LUMIA_WEBHOOK_CROWN_CHANGE |
| Periodic Leaderboard | LUMIA_WEBHOOK_JUICE_LEADERBOARD |

### Payload Format

```javascript
{
    event: "crown_change",
    data: {
        new_juicernaut: "PlayerName",
        old_juicernaut: "OldPlayer",
        total_usd: 45.00,
        timestamp: "2025-01-01T12:00:00Z"
    }
}
```

### Periodic Leaderboard Schedule
- Every 30 minutes during active session
- Includes top 3 contributors

---

## CHAT ANNOUNCEMENT TEMPLATES

### Check-in
```
✅ @PlayerName checked in! Streak: 14 days (+$1,400, +280 XP)
```

### Level Up (Single)
```
🎉 @PlayerName leveled up to 65!
```

### Level Up (Batched)
```
🎉 3 players leveled up: @Player1 (25), @Player2 (18), @Player3 (42)
```

### Tier Promotion
```
🎖️ @PlayerName has reached Captain tier!
```

### Rob Success
```
💰 @Attacker robbed @Defender for $13,000! (🛡️ Insurance saved $7,000)
```

### Rob with Item Theft
```
💰 @Attacker robbed @Defender for $13,000!
🔥 @Attacker also stole @Defender's Plasma Cutter!
```

### Crate Drop
```
📦 @PlayerName found a Rare Crate!
```

### Crate Open
```
📦 @PlayerName opened a Rare Crate and found a Neural Hacker (Rare Armor)!
```

### Juicernaut Crown Change
```
👑 THE CROWN HAS CHANGED HANDS! 👑
@NewPlayer has overthrown @OldPlayer to become the new JUICERNAUT! ($45.00)
⚡ Active Buffs: 2x XP | 3x Loot | Rob Immunity | 50% Business | 25% Wealth
```

### Heist Alert
```
🚨 HEIST ALERT! 🚨
[Prompt text]
⏱️ 45 seconds...
```

---

## DATABASE SCHEMA

```sql
CREATE TABLE user_notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    icon VARCHAR(50),
    
    link_type VARCHAR(50),
    link_id VARCHAR(100),
    
    is_seen BOOLEAN DEFAULT FALSE,
    seen_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE event_batch_queue (
    queue_id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    batch_key VARCHAR(100) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    process_after TIMESTAMP NOT NULL
);

CREATE TABLE discord_server_config (
    config_id SERIAL PRIMARY KEY,
    discord_guild_id VARCHAR(50) NOT NULL UNIQUE,
    commands_channel_id VARCHAR(50),
    feed_channel_id VARCHAR(50),
    admin_webhook_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discord_activity_channels (
    channel_id SERIAL PRIMARY KEY,
    discord_guild_id VARCHAR(50) NOT NULL,
    discord_channel_id VARCHAR(50) NOT NULL,
    added_by_discord_user_id VARCHAR(50),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(discord_guild_id, discord_channel_id)
);

CREATE INDEX idx_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notifications_unseen ON user_notifications(user_id, is_seen);
CREATE INDEX idx_batch_queue_process ON event_batch_queue(process_after);
```

---

## SCHEDULED JOBS

| Job | Schedule | Action |
|-----|----------|--------|
| Process batch queue | Every 15 seconds | Send batched announcements |
| Expire notifications | Daily 2:00 UTC | Delete notifications > 30 days |
| Juicernaut periodic | Every 30 minutes | Post leaderboard during session |
| Enforce notification limit | On insert | Delete oldest if > 25 |

---

**END OF DOCUMENT**
