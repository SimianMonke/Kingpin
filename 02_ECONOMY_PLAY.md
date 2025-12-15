# 02. ECONOMY CORE (!play) SYSTEM

---

## OVERVIEW

The !play command is the primary wealth and XP generation mechanic. Players trigger random events based on their status tier, earning rewards scaled to their progression while risking jail time (getting "busted").

---

## COMMAND TRIGGER

| Platform | Trigger | API Source |
|----------|---------|------------|
| Kick | Channel point redemption | Webhook: `channel.reward.redemption.updated` |
| Twitch | Channel point redemption | EventSub: `channel.channel_points_custom_reward_redemption.add` |
| Discord | NOT AVAILABLE | Channel points only |

**Important:** This is NOT a chat command (!play). It is triggered by redeeming channel points on Kick or Twitch. The bot listens for redemption events via webhooks/EventSub, not chat messages.

### Kick Webhook Payload
```json
{
  "broadcaster": { "user_id": "123", "username": "streamer" },
  "user": { "user_id": "456", "username": "player" },
  "reward": { "id": "reward_id", "title": "Play Kingpin" },
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Twitch EventSub Payload
```json
{
  "user_id": "456",
  "user_login": "player",
  "reward": { "id": "reward_id", "title": "Play Kingpin" },
  "redeemed_at": "2025-01-01T00:00:00Z"
}
```

---

## BASIC MECHANICS

| Attribute | Value |
|-----------|-------|
| Cooldown | None (can spam, but jail risk) |
| Bust chance | 5% per play |
| Base crate drop chance | 2% |
| Buffed crate drop chance | 6% (with Juicernaut buff) |

---

## EVENT TIERS

Events are determined by the player's status tier. Higher tiers unlock more lucrative (and thematic) events.

### Rookie Events (Level 1-19)

| Event | Wealth Range | XP Range | Description |
|-------|--------------|----------|-------------|
| Petty Theft | $50 - $150 | 10 - 20 | Grabbed a tourist's wallet in the crowd. |
| Street Hustle | $100 - $250 | 15 - 25 | Sold knockoff stims to desperate workers. |
| Alley Mugging | $150 - $350 | 20 - 35 | Cornered a corp drone in the back alleys. |
| Scrap Run | $200 - $400 | 25 - 40 | Stripped a crashed vehicle for parts. |
| Info Peddling | $250 - $500 | 30 - 50 | Sold rumors to interested parties. |

### Associate Events (Level 20-39)

| Event | Wealth Range | XP Range | Description |
|-------|--------------|----------|-------------|
| Protection Shakedown | $500 - $1,000 | 50 - 80 | Convinced a shop owner they need "insurance." |
| Drug Courier | $750 - $1,250 | 60 - 90 | Moved product across district lines. |
| Chop Shop Delivery | $1,000 - $1,500 | 70 - 100 | Dropped off a hot vehicle at the right people. |
| Gambling Den Take | $1,250 - $1,750 | 80 - 120 | Skimmed profits from an underground game. |
| Blackmail Collection | $1,500 - $2,000 | 100 - 150 | Collected payment for keeping secrets. |

### Soldier Events (Level 40-59)

| Event | Wealth Range | XP Range | Description |
|-------|--------------|----------|-------------|
| Warehouse Heist | $2,000 - $3,500 | 150 - 200 | Hit a poorly guarded supply depot. |
| Convoy Interception | $2,500 - $4,000 | 175 - 225 | Ambushed a transport carrying valuables. |
| Enforcer Contract | $3,000 - $5,000 | 200 - 275 | Got paid to send a message. |
| Data Extraction | $3,500 - $5,500 | 225 - 300 | Downloaded corporate secrets for a buyer. |
| Smuggling Run | $4,000 - $6,000 | 250 - 350 | Moved contraband through checkpoints. |

### Captain Events (Level 60-79)

| Event | Wealth Range | XP Range | Description |
|-------|--------------|----------|-------------|
| Bank Vault Access | $6,000 - $9,000 | 350 - 450 | Inside job at a financial institution. |
| Executive Kidnapping | $7,000 - $10,000 | 400 - 500 | High-value target, quick ransom. |
| Arms Deal | $8,000 - $12,000 | 450 - 550 | Brokered military-grade hardware. |
| Territory Takeover | $9,000 - $14,000 | 500 - 600 | Seized control of a profitable block. |
| Cyber Heist | $10,000 - $15,000 | 550 - 700 | Drained accounts through the net. |

### Underboss Events (Level 80-99)

| Event | Wealth Range | XP Range | Description |
|-------|--------------|----------|-------------|
| Corporate Sabotage | $15,000 - $22,000 | 700 - 900 | Crippled a rival corp's operations. |
| Political Leverage | $18,000 - $25,000 | 800 - 1,000 | Acquired influence over officials. |
| Syndicate War Profit | $20,000 - $30,000 | 900 - 1,100 | Played both sides in a faction conflict. |
| Black Market Monopoly | $22,000 - $35,000 | 1,000 - 1,200 | Cornered the market on rare goods. |
| Intelligence Auction | $25,000 - $40,000 | 1,100 - 1,400 | Sold secrets to the highest bidder. |

### Kingpin Events (Level 100+)

| Event | Wealth Range | XP Range | Description |
|-------|--------------|----------|-------------|
| Hostile Acquisition | $40,000 - $60,000 | 1,400 - 1,800 | Absorbed a competitor's entire operation. |
| Government Contract | $45,000 - $70,000 | 1,600 - 2,000 | Even the state needs your services. |
| Market Manipulation | $50,000 - $80,000 | 1,800 - 2,200 | Moved prices, made fortunes. |
| Shadow Council Seat | $55,000 - $90,000 | 2,000 - 2,500 | Your vote shapes the city's future. |
| Lazarus Ascension | $60,000 - $100,000 | 2,200 - 3,000 | You ARE the power in this city. |

---

## BUST MECHANIC

### Trigger
- 5% chance on every !play command
- Random roll independent of event selection

### Consequences
- No wealth awarded
- No XP awarded
- Player is "jailed" (cooldown applied)
- Jail duration: 1 hour

### Jail Escape
- Command: `!bail`
- Cost: 10% of current wealth
- Effect: Immediately clears jail cooldown
- Trigger: Channel point redemption (same as !play)

### Bust Message Examples
```
🚔 @PlayerName got busted! The heat came down hard. Jailed for 1 hour.
Use !bail to pay 10% of your wealth and walk free.
```

---

## CRATE DROPS

### Base Mechanics
- 2% chance per !play (6% with Juicernaut loot buff)
- Crate tier weighted by player tier

### Crate Drop Weights by Player Tier

| Player Tier | Common | Uncommon | Rare | Legendary |
|-------------|--------|----------|------|-----------|
| Rookie | 80% | 18% | 2% | 0% |
| Associate | 70% | 25% | 5% | 0% |
| Soldier | 55% | 35% | 9% | 1% |
| Captain | 40% | 40% | 17% | 3% |
| Underboss | 25% | 40% | 28% | 7% |
| Kingpin | 15% | 35% | 35% | 15% |

### Crate Drop Logic
```javascript
function rollCrateDrop(playerTier, hasJuicernautBuff) {
    const baseChance = 0.02;
    const chance = hasJuicernautBuff ? 0.06 : baseChance;
    
    if (Math.random() > chance) return null;
    
    const weights = CRATE_WEIGHTS[playerTier];
    const roll = Math.random();
    let cumulative = 0;
    
    for (const [tier, weight] of Object.entries(weights)) {
        cumulative += weight;
        if (roll <= cumulative) return tier;
    }
    
    return 'common';
}
```

---

## BUFF INTERACTIONS

### Juicernaut Buffs Applied to !play

| Buff | Effect |
|------|--------|
| juicernaut_wealth | +25% wealth from events |
| juicernaut_xp | +100% XP from events (2x) |
| juicernaut_loot | +200% crate drop rate (6% instead of 2%) |

### Territory Buffs (if applicable)

| Buff | Effect |
|------|--------|
| territory_xp | +5% or +10% XP (based on faction control) |

### Buff Application Order
1. Roll base event rewards (wealth, XP)
2. Apply Juicernaut buffs (multipliers)
3. Apply territory buffs (additive after Juicernaut)
4. Round to nearest integer

---

## ITEM DURABILITY

- Each !play decreases equipped weapon/armor durability by 1-2 points
- Random degradation within range
- If durability reaches 0, item is destroyed
- Business items are NOT affected by !play

---

## EVENT FLOW

```
1. Player redeems channel points for !play
2. Check if player is jailed
   - If jailed: Reject, show time remaining
3. Check cooldowns (if any configured)
4. Roll bust check (5%)
   - If busted: Jail player, announce, exit
5. Select random event from player's tier
6. Roll wealth within event range
7. Roll XP within event range
8. Apply buffs (Juicernaut, territory)
9. Roll crate drop (2% or 6%)
10. Decrease item durability
11. Update player stats in transaction
12. Check for level up
13. Check achievements
14. Announce results
```

---

## DATABASE INTERACTIONS

### Event Log
```sql
INSERT INTO game_events (
    user_id, event_type, wealth_change, xp_change,
    tier, event_description, success, was_busted
) VALUES (
    $1, 'play', $2, $3, $4, $5, TRUE, FALSE
);
```

### Player Update
```sql
UPDATE users SET
    wealth = wealth + $2,
    xp = xp + $3,
    total_play_count = total_play_count + 1,
    level = $4,
    status_tier = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = $1;
```

---

## CHAT ANNOUNCEMENTS

### Standard Event
```
💰 @PlayerName pulled off a Warehouse Heist! +$3,247 | +187 XP
```

### Event with Level Up
```
💰 @PlayerName pulled off a Warehouse Heist! +$3,247 | +187 XP
🎉 @PlayerName leveled up to 45!
```

### Event with Crate Drop
```
💰 @PlayerName pulled off a Warehouse Heist! +$3,247 | +187 XP
📦 @PlayerName found a Rare Crate!
```

### Busted
```
🚔 @PlayerName got busted during a Warehouse Heist! Jailed for 1 hour.
💸 Use !bail (costs 10% wealth) to walk free early.
```

### With Juicernaut Buffs (show multiplier)
```
💰 @PlayerName pulled off a Warehouse Heist! +$4,059 (👑 +25%) | +374 XP (👑 2x)
```

---

## EDGE CASES

| Scenario | Handling |
|----------|----------|
| Player has $0 and gets busted | Bail cost is $0, but jail still applies |
| Player levels up during bust | No level up (no XP awarded) |
| Item breaks during !play | Announce after event: "💥 Your Plasma Rifle broke!" |
| Crate drops but inventory full | Crate goes to escrow (1 hour to claim) |
| Juicernaut buff expires mid-event | Buff checked at event start, applies for full event |
| Multiple buffs active | All applicable buffs stack |

---

## CONFIGURATION

```javascript
const PLAY_CONFIG = {
    bustChance: 0.05,
    jailDurationMinutes: 60,
    bailCostPercent: 0.10,
    baseCrateDropChance: 0.02,
    buffedCrateDropChance: 0.06,
    durabilityLossMin: 1,
    durabilityLossMax: 2
};
```

---

**END OF DOCUMENT**
