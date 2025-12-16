# 09. MONETIZATION INTEGRATION

---

## OVERVIEW

The monetization system tracks and rewards all monetary support across Kick, Twitch, and Stripe. Contributions are converted to in-game rewards (wealth + XP) and counted toward Juicernaut standings.

---

## SUPPORTED PLATFORMS

| Platform | Events Supported |
|----------|------------------|
| Kick | Subscriptions, Gift Subs, Kicks |
| Twitch | Subscriptions, Gift Subs, Bits, Raids |
| Stripe | One-time donations |

---

## REWARD CONFIGURATION

### Kick Rewards

| Event | Wealth | XP | Notes |
|-------|--------|-----|-------|
| Tier 1 Sub | $500 | 100 | |
| Tier 2 Sub | $750 | 150 | 1.5x multiplier |
| Tier 3 Sub | $1,000 | 200 | 2.0x multiplier |
| Gift Sub (per sub) | $500 | 100 | Per recipient |
| Kick (per kick) | $1 | 0 | |

### Twitch Rewards

| Event | Wealth | XP | Notes |
|-------|--------|-----|-------|
| Tier 1 Sub | $500 | 100 | |
| Tier 2 Sub | $750 | 150 | 1.5x multiplier |
| Tier 3 Sub | $1,000 | 200 | 2.0x multiplier |
| Gift Sub (per sub) | $500 | 100 | Per recipient |
| Bits (per 100) | $100 | 0 | $1 per bit |
| Raid (per viewer) | $10 | 2 | Per raiding viewer |

### Stripe Rewards

| Event | Wealth | XP | Notes |
|-------|--------|-----|-------|
| Donation (per $1) | $100 | 0 | 100x multiplier |

---

## EVENT PROCESSING FLOW

```
1. Webhook/Event received from platform
2. Verify signature/authenticity
3. Check for duplicate (external_event_id)
4. Identify user (platform_user_id → user_id)
5. Create user if first interaction
6. Calculate rewards based on event type
7. Begin transaction:
   a. Insert monetization_event record
   b. Update user wealth and XP
   c. Check for level up
   d. Update leaderboard snapshots (all periods)
   e. Add to Juicernaut session (if active)
   f. Check achievement progress
8. Commit transaction
9. Announce to chat
10. Send notifications
```

---

## KICK INTEGRATION

### Webhook Events

| Event Type | Webhook Header |
|------------|----------------|
| Subscription | `Kick-Event-Type: channel.subscription.new` |
| Gift Subs | `Kick-Event-Type: channel.subscription.gifts` |
| Kicks | `Kick-Event-Type: kicks.gifted` |

### Subscription Payload
```json
{
  "broadcaster": { "user_id": "123", "username": "streamer" },
  "subscriber": { "user_id": "456", "username": "supporter" },
  "duration": 1,
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Gift Sub Payload
```json
{
  "broadcaster": { "user_id": "123" },
  "gifter": { "user_id": "456", "username": "generous_user" },
  "giftees": [
    { "user_id": "789", "username": "recipient1" },
    { "user_id": "012", "username": "recipient2" }
  ]
}
```

---

## TWITCH INTEGRATION

### EventSub Subscriptions Needed

| Subscription Type | Description |
|-------------------|-------------|
| `channel.subscribe` | Personal subscription |
| `channel.subscription.gift` | Gifted subscriptions |
| `channel.cheer` | Bits cheered |
| `channel.raid` | Incoming raid |

### Webhook Endpoint
```
POST /webhooks/twitch
Headers:
  Twitch-Eventsub-Message-Signature: sha256=...
  Twitch-Eventsub-Message-Id: ...
  Twitch-Eventsub-Message-Type: notification
```

### Signature Verification
```javascript
const crypto = require('crypto');

function verifyTwitchSignature(req, secret) {
    const messageId = req.headers['twitch-eventsub-message-id'];
    const timestamp = req.headers['twitch-eventsub-message-timestamp'];
    const body = req.rawBody;
    
    const message = messageId + timestamp + body;
    const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');
    
    return signature === req.headers['twitch-eventsub-message-signature'];
}
```

---

## STRIPE INTEGRATION

### Webhook Endpoint
```
POST /webhooks/stripe
```

### Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Process donation |
| `payment_intent.succeeded` | Backup for direct payments |

### Required Metadata
Include in Stripe checkout:
```javascript
{
  kick_user_id: "12345",  // OR
  twitch_user_id: "67890",
  username: "donor_name"
}
```

### Signature Verification
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function verifyStripeWebhook(req) {
    const sig = req.headers['stripe-signature'];
    return stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}
```

---

## DEDUPLICATION

Every event has a unique external identifier to prevent double rewards:

```sql
-- Constraint prevents duplicate processing
external_event_id VARCHAR(255) UNIQUE
```

### Deduplication Check
```javascript
async function isEventProcessed(externalEventId) {
    const result = await db.query(`
        SELECT 1 FROM monetization_events
        WHERE external_event_id = $1
    `, [externalEventId]);
    return result.rows.length > 0;
}
```

---

## USER IDENTIFICATION

### Kick → User Mapping
```sql
SELECT user_id FROM users WHERE kick_user_id = $1
```

### Twitch → User Mapping
```sql
SELECT user_id FROM users WHERE twitch_user_id = $1
```

### Auto-Create on First Monetization
If user doesn't exist, create profile before processing rewards.

---

## DATABASE SCHEMA

```sql
CREATE TABLE monetization_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    
    platform VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    
    quantity INTEGER DEFAULT 1,
    amount_usd DECIMAL(10,2),
    tier VARCHAR(20),
    
    recipient_user_id INTEGER REFERENCES users(user_id),
    recipient_username VARCHAR(100),
    
    wealth_rewarded BIGINT NOT NULL DEFAULT 0,
    xp_rewarded INTEGER NOT NULL DEFAULT 0,
    
    raw_event_data JSONB,
    external_event_id VARCHAR(255) UNIQUE,
    
    processed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reward_config (
    config_id SERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    
    wealth_per_unit INTEGER NOT NULL,
    xp_per_unit INTEGER NOT NULL,
    tier_multiplier JSONB,
    
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(platform, event_type)
);

CREATE INDEX idx_monetization_user ON monetization_events(user_id);
CREATE INDEX idx_monetization_platform ON monetization_events(platform);
CREATE INDEX idx_monetization_external ON monetization_events(external_event_id);
```

---

## REWARD CONFIG DATA

```sql
INSERT INTO reward_config (platform, event_type, wealth_per_unit, xp_per_unit, tier_multiplier) VALUES
('kick', 'subscription', 500, 100, '{"1": 1.0, "2": 1.5, "3": 2.0}'),
('kick', 'gift_sub', 500, 100, NULL),
('kick', 'kick', 1, 0, NULL),
('twitch', 'subscription', 500, 100, '{"1": 1.0, "2": 1.5, "3": 2.0}'),
('twitch', 'gift_sub', 500, 100, NULL),
('twitch', 'bits', 1, 0, NULL),
('twitch', 'raid', 10, 2, NULL),
('stripe', 'donation', 100, 0, NULL);
```

---

## ANNOUNCEMENTS

### Subscription
```
💜 @PlayerName just subscribed! Welcome to the crew! (+$500, +100 XP)
```

### Gift Subs
```
🎁 @Gifter just gifted 5 subs! (+$2,500, +500 XP)
Recipients: @User1, @User2, @User3, @User4, @User5
```

### Bits/Kicks
```
💎 @PlayerName cheered 500 bits! (+$500)
```

### Raid
```
🚀 @Raider just raided with 150 viewers! (+$1,500, +300 XP)
Welcome raiders!
```

### Stripe Donation
```
💖 @PlayerName donated $25! (+$2,500)
```

### Resub Milestone
```
🎉 @PlayerName resubscribed for 12 months! (+$500, +100 XP)
Thank you for your continued support!
```

---

## EDGE CASES

| Scenario | Handling |
|----------|----------|
| Anonymous gift sub | Create rewards but don't credit to specific user |
| Unknown user donates | Create profile, then process reward |
| Duplicate webhook | Reject (external_event_id unique) |
| Invalid signature | Reject webhook, log error |
| Stripe without metadata | Log warning, skip if can't identify user |
| Raid with 0 viewers | Minimum 1 viewer for reward |

---

## NOTIFICATIONS

### Website Notification (to recipient)
```
Title: "Thank you!"
Message: "You subscribed! +$500 wealth, +100 XP"
Icon: 💜
```

### Admin Webhook
All monetization events post to admin Discord channel with details.

---

**END OF DOCUMENT**
