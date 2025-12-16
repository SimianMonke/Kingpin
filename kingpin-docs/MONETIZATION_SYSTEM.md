# MONETIZATION SYSTEM - Implementation Documentation

## Overview

The Monetization System processes supporter transactions (subscriptions, bits, donations, kicks) from multiple platforms and converts them into game rewards (wealth, XP) while tracking for Juicernaut contributions.

**Current Implementation Status:** Complete

---

## Database Schema

### Monetization Events: `monetization_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Event ID |
| `user_id` | INT (FK) | User who contributed |
| `platform` | VARCHAR(20) | kick, twitch, stripe |
| `event_type` | VARCHAR(50) | subscription, gift_sub, bits, donation, kick |
| `sub_tier` | INT | Subscription tier (1, 2, 3) |
| `quantity` | INT | Quantity (bits, gift subs, kicks) |
| `amount_usd` | DECIMAL(10,2) | USD value |
| `wealth_rewarded` | INT | Wealth given |
| `xp_rewarded` | INT | XP given |
| `raw_data` | JSONB | Original webhook payload |
| `processed_at` | TIMESTAMP | When processed |
| `created_at` | TIMESTAMP | Event creation time |

### Reward Config: `reward_config`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Config ID |
| `platform` | VARCHAR(20) | Platform |
| `event_type` | VARCHAR(50) | Event type |
| `tier` | INT | Tier (for subs) |
| `wealth_per_unit` | INT | Wealth per unit |
| `xp_per_unit` | INT | XP per unit |
| `is_active` | BOOLEAN | Whether enabled |

---

## Reward Configuration

### Default Rewards (Constants)

```typescript
const MONETIZATION_REWARDS = {
  // Kick
  KICK_SUB_T1: { wealth: 500, xp: 100, usd: 4.99 },
  KICK_SUB_T2: { wealth: 750, xp: 150, usd: 9.99 },
  KICK_SUB_T3: { wealth: 1000, xp: 200, usd: 24.99 },
  KICK_GIFT_SUB: { wealth: 500, xp: 100, usd: 5.00 },  // Per sub gifted
  KICK_KICK: { wealth: 1, xp: 0, usd: 0.01 },          // Per kick

  // Twitch
  TWITCH_SUB_T1: { wealth: 500, xp: 100, usd: 4.99 },
  TWITCH_SUB_T2: { wealth: 750, xp: 150, usd: 9.99 },
  TWITCH_SUB_T3: { wealth: 1000, xp: 200, usd: 24.99 },
  TWITCH_GIFT_SUB: { wealth: 500, xp: 100, usd: 5.00 },
  TWITCH_BITS_PER_100: { wealth: 100, xp: 0, usd: 1.00 },
  TWITCH_RAID_PER_VIEWER: { wealth: 10, xp: 2, usd: 0.10 },

  // Stripe/Direct donations
  DONATION_PER_DOLLAR: { wealth: 100, xp: 0, usd: 1.00 },
}
```

### Event Types

```typescript
const MONETIZATION_EVENT_TYPES = {
  SUBSCRIPTION: 'subscription',
  GIFT_SUB: 'gift_sub',
  BITS: 'bits',
  KICK: 'kick',
  RAID: 'raid',
  DONATION: 'donation',
}

const MONETIZATION_PLATFORMS = {
  KICK: 'kick',
  TWITCH: 'twitch',
  STRIPE: 'stripe',
}
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/monetization.service.ts`

### Public Methods

```typescript
export const MonetizationService = {
  /**
   * Process a subscription event
   */
  async processSubscription(
    userId: number,
    platform: Platform,
    tier: number,
    isGift: boolean,
    giftQuantity?: number
  ): Promise<MonetizationResult>

  /**
   * Process bits/kicks donation
   */
  async processBits(
    userId: number,
    platform: Platform,
    amount: number
  ): Promise<MonetizationResult>

  /**
   * Process direct donation
   */
  async processDonation(
    userId: number,
    amountUsd: number
  ): Promise<MonetizationResult>

  /**
   * Process raid
   */
  async processRaid(
    userId: number,
    viewerCount: number
  ): Promise<MonetizationResult>

  /**
   * Get reward config for event type
   */
  async getRewardConfig(
    platform: Platform,
    eventType: string,
    tier?: number
  ): Promise<RewardConfig>

  /**
   * Get user's monetization history
   */
  async getHistory(
    userId: number,
    limit?: number
  ): Promise<MonetizationEvent[]>
}
```

### Process Subscription

```typescript
async function processSubscription(
  userId: number,
  platform: Platform,
  tier: number,
  isGift: boolean,
  giftQuantity: number = 1
): Promise<MonetizationResult> {
  // Get reward config
  const rewardKey = isGift
    ? `${platform.toUpperCase()}_GIFT_SUB`
    : `${platform.toUpperCase()}_SUB_T${tier}`

  const rewards = MONETIZATION_REWARDS[rewardKey]
  const quantity = isGift ? giftQuantity : 1

  const totalWealth = rewards.wealth * quantity
  const totalXp = rewards.xp * quantity
  const totalUsd = rewards.usd * quantity

  // Award rewards
  await UserService.addWealth(userId, totalWealth)
  if (totalXp > 0) {
    await UserService.addXp(userId, totalXp)
  }

  // Record event
  await prisma.monetization_events.create({
    data: {
      user_id: userId,
      platform,
      event_type: isGift ? 'gift_sub' : 'subscription',
      sub_tier: tier,
      quantity,
      amount_usd: totalUsd,
      wealth_rewarded: totalWealth,
      xp_rewarded: totalXp,
      processed_at: new Date(),
    },
  })

  // Update Juicernaut contributions if session active
  const session = await JuicernautService.getActiveSession()
  if (session) {
    await JuicernautService.recordContribution(
      userId,
      isGift ? 'gift_sub' : 'subscription',
      totalUsd,
      platform
    )
  }

  // Update leaderboard
  await LeaderboardService.updateSnapshot(userId, {
    total_contributed_usd: totalUsd,
    subs_count: isGift ? 0 : 1,
    gift_subs_given: isGift ? quantity : 0,
  })

  // Send notification
  await NotificationService.create(userId, 'monetization', {
    message: `Thank you! You earned $${totalWealth.toLocaleString()}${totalXp > 0 ? ` and ${totalXp} XP` : ''}!`,
  })

  return {
    wealth: totalWealth,
    xp: totalXp,
    usdValue: totalUsd,
  }
}
```

### Process Bits/Kicks

```typescript
async function processBits(
  userId: number,
  platform: Platform,
  amount: number
): Promise<MonetizationResult> {
  const rewardKey = platform === 'kick' ? 'KICK_KICK' : 'TWITCH_BITS_PER_100'
  const rewards = MONETIZATION_REWARDS[rewardKey]

  // Calculate rewards
  let totalWealth: number
  let totalUsd: number

  if (platform === 'twitch') {
    // Bits: rewards per 100 bits
    totalWealth = Math.floor((amount / 100) * rewards.wealth)
    totalUsd = amount * 0.01  // 1 bit = $0.01
  } else {
    // Kicks: rewards per kick
    totalWealth = amount * rewards.wealth
    totalUsd = amount * rewards.usd
  }

  await UserService.addWealth(userId, totalWealth)

  await prisma.monetization_events.create({
    data: {
      user_id: userId,
      platform,
      event_type: platform === 'kick' ? 'kick' : 'bits',
      quantity: amount,
      amount_usd: totalUsd,
      wealth_rewarded: totalWealth,
      xp_rewarded: 0,
      processed_at: new Date(),
    },
  })

  // Update Juicernaut contributions
  const session = await JuicernautService.getActiveSession()
  if (session) {
    await JuicernautService.recordContribution(
      userId,
      platform === 'kick' ? 'kick' : 'bits',
      totalUsd,
      platform
    )
  }

  await LeaderboardService.updateSnapshot(userId, {
    total_contributed_usd: totalUsd,
    bits_donated: platform === 'twitch' ? amount : 0,
    kicks_sent: platform === 'kick' ? amount : 0,
  })

  return { wealth: totalWealth, xp: 0, usdValue: totalUsd }
}
```

---

## Webhook Handlers

### Kick Webhook

**File:** `web/src/app/api/webhooks/kick/route.ts`

Handles:
- Subscriptions (tier 1, 2, 3)
- Gift subs
- Kicks

### Twitch Webhook

**File:** `web/src/app/api/webhooks/twitch/route.ts`

Handles:
- Subscriptions (tier 1, 2, 3)
- Gift subs
- Bits
- Raids

### Stripe Webhook

**File:** `web/src/app/api/webhooks/stripe/route.ts`

Handles:
- One-time donations
- Recurring donations

---

## Reward Calculation Examples

### Subscription (Tier 3)
- Platform: Twitch
- USD Value: $24.99
- Wealth: 1,000
- XP: 200

### Gift Subs (x5)
- Platform: Kick
- USD Value: $25.00 (5 × $5.00)
- Wealth: 2,500 (5 × 500)
- XP: 500 (5 × 100)

### Bits (500)
- Platform: Twitch
- USD Value: $5.00
- Wealth: 500 (5 × 100)
- XP: 0

### Donation ($10)
- Platform: Stripe
- USD Value: $10.00
- Wealth: 1,000 (10 × 100)
- XP: 0

---

## System Interdependencies

### Depends On
- **User System:** Wealth/XP rewards
- **Juicernaut System:** Contribution tracking
- **Leaderboard System:** Donation tracking
- **Notification System:** Thank you messages

### Depended On By
- **Juicernaut System:** Crown determination
- **Leaderboard System:** Donation rankings
- **Achievement System:** Contribution achievements

---

## Configuration & Constants

```typescript
const MONETIZATION_REWARDS = {
  KICK_SUB_T1: { wealth: 500, xp: 100, usd: 4.99 },
  KICK_SUB_T2: { wealth: 750, xp: 150, usd: 9.99 },
  KICK_SUB_T3: { wealth: 1000, xp: 200, usd: 24.99 },
  KICK_GIFT_SUB: { wealth: 500, xp: 100, usd: 5.00 },
  KICK_KICK: { wealth: 1, xp: 0, usd: 0.01 },
  TWITCH_SUB_T1: { wealth: 500, xp: 100, usd: 4.99 },
  TWITCH_SUB_T2: { wealth: 750, xp: 150, usd: 9.99 },
  TWITCH_SUB_T3: { wealth: 1000, xp: 200, usd: 24.99 },
  TWITCH_GIFT_SUB: { wealth: 500, xp: 100, usd: 5.00 },
  TWITCH_BITS_PER_100: { wealth: 100, xp: 0, usd: 1.00 },
  TWITCH_RAID_PER_VIEWER: { wealth: 10, xp: 2, usd: 0.10 },
  DONATION_PER_DOLLAR: { wealth: 100, xp: 0, usd: 1.00 },
}
```

---

## Known Limitations & TODOs

### Completed Features
- Multi-platform support (Kick, Twitch, Stripe)
- All event types (subs, gift subs, bits, kicks, raids, donations)
- Configurable reward rates
- Juicernaut integration
- Leaderboard tracking
- Notification system

### Technical Notes
- Webhook signature verification for security
- Idempotency via raw_data tracking
- USD value standardization across platforms
- XP rewards only for subscriptions

---

**File Location:** `web/src/lib/services/monetization.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (MONETIZATION_REWARDS)
- `web/src/app/api/webhooks/kick/route.ts`
- `web/src/app/api/webhooks/twitch/route.ts`
- `web/src/app/api/webhooks/stripe/route.ts`
