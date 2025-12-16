# 05. COOLDOWNS & JAIL SYSTEM

---

## OVERVIEW

The cooldown system prevents command spam and creates strategic timing. The jail system provides a risk/reward mechanic for !play, serving as a wealth sink through bail costs.

---

## COOLDOWN TYPES

| Cooldown | Duration | Scope | Trigger |
|----------|----------|-------|---------|
| Rob per target | 24 hours | Per attacker-target pair | After any !rob attempt |
| Business revenue | 2 hours | Per user | After collecting revenue |
| Jail | 1 hour | Per user | After getting busted |
| Crate open (chat) | 30 seconds | Per user | After opening crate via chat |

---

## JAIL SYSTEM

### Trigger
- 5% chance on every !play command
- Called "getting busted"

### Jail State
- Player cannot use !play while jailed
- Player CAN use other commands
- Player CAN be robbed while jailed
- Jail applies across all platforms (account-wide)

### Duration
- Default: 1 hour (60 minutes)
- Can be bypassed with !bail

### Jail Check
```javascript
async function isJailed(userId) {
    const result = await db.query(`
        SELECT expires_at FROM cooldowns
        WHERE user_id = $1
          AND command_type = 'jail'
          AND expires_at > NOW()
    `, [userId]);
    
    return result.rows.length > 0 ? result.rows[0].expires_at : null;
}
```

---

## BAIL SYSTEM

### Trigger

| Platform | Trigger | API Source |
|----------|---------|------------|
| Kick | Channel point redemption | Webhook: `channel.reward.redemption.updated` |
| Twitch | Channel point redemption | EventSub: `channel.channel_points_custom_reward_redemption.add` |
| Discord | NOT AVAILABLE | Channel points only |

**Important:** Bail is NOT a chat command (!bail). It is triggered by redeeming channel points on Kick or Twitch.

### Cost
- 10% of current wealth
- Minimum: $0 (if player has $0)

### Effect
- Immediately clears jail cooldown
- Player can use !play again

### Bail Flow
```
1. Player redeems channel points for !bail
2. Check if player is jailed
   - If not jailed: Reject with "You're not in jail!"
3. Calculate bail cost (10% of wealth)
4. Deduct wealth
5. Delete jail cooldown
6. Announce freedom
```

### Bail Calculation
```javascript
async function payBail(userId) {
    const user = await getUser(userId);
    const jailExpiry = await isJailed(userId);
    
    if (!jailExpiry) {
        throw new Error('Not in jail');
    }
    
    const bailCost = Math.floor(user.wealth * 0.10);
    
    await db.query('BEGIN');
    
    // Deduct bail
    await db.query(`
        UPDATE users SET wealth = wealth - $2 WHERE user_id = $1
    `, [userId, bailCost]);
    
    // Clear jail
    await db.query(`
        DELETE FROM cooldowns
        WHERE user_id = $1 AND command_type = 'jail'
    `, [userId]);
    
    await db.query('COMMIT');
    
    return bailCost;
}
```

---

## COOLDOWN STORAGE

### Database Table
```sql
CREATE TABLE cooldowns (
    cooldown_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    command_type VARCHAR(50) NOT NULL,
    target_identifier VARCHAR(255), -- For per-target cooldowns
    
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, command_type, target_identifier)
);

CREATE INDEX idx_cooldowns_user ON cooldowns(user_id);
CREATE INDEX idx_cooldowns_expires ON cooldowns(expires_at);
```

### Redis Alternative (Recommended for Production)
```javascript
// Set cooldown
await redis.set(
    `cooldown:${userId}:${commandType}:${targetId}`,
    '1',
    'EX',
    durationSeconds
);

// Check cooldown
const exists = await redis.exists(`cooldown:${userId}:${commandType}:${targetId}`);

// Get TTL
const ttl = await redis.ttl(`cooldown:${userId}:${commandType}:${targetId}`);
```

---

## COOLDOWN COMMANDS

### Check Cooldowns
```javascript
async function getCooldown(userId, commandType, targetId = null) {
    const key = targetId 
        ? `cooldown:${userId}:${commandType}:${targetId}`
        : `cooldown:${userId}:${commandType}`;
    
    const ttl = await redis.ttl(key);
    return ttl > 0 ? ttl : null;
}
```

### Set Cooldown
```javascript
async function setCooldown(userId, commandType, durationSeconds, targetId = null) {
    const key = targetId 
        ? `cooldown:${userId}:${commandType}:${targetId}`
        : `cooldown:${userId}:${commandType}`;
    
    await redis.set(key, '1', 'EX', durationSeconds);
}
```

### Clear Cooldown
```javascript
async function clearCooldown(userId, commandType, targetId = null) {
    const key = targetId 
        ? `cooldown:${userId}:${commandType}:${targetId}`
        : `cooldown:${userId}:${commandType}`;
    
    await redis.del(key);
}
```

---

## TIME FORMATTING

### Display Remaining Time
```javascript
function formatTimeRemaining(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}
```

---

## CHAT MESSAGES

### Jailed (Bust)
```
🚔 @PlayerName got busted! Jailed for 1 hour.
💸 Use !bail (costs 10% wealth) to walk free early.
```

### Bail Paid
```
💸 @PlayerName paid $12,345 bail and is back on the streets!
```

### Bail Attempt While Not Jailed
```
✅ @PlayerName: You're not in jail! Nothing to bail out of.
```

### Command On Cooldown
```
⏰ @PlayerName: That command is on cooldown. Try again in 1h 23m.
```

### Rob Cooldown (Per Target)
```
⏰ @PlayerName: You already robbed @Target today. Try again in 18h 45m.
```

---

## PLATFORM BEHAVIOR

### Cross-Platform Jail
- Jail applies to user account, not platform
- If jailed on Kick, also jailed on Twitch
- Bail can be paid from either platform

### Cooldown Visibility
- Website shows all active cooldowns with countdown timers
- Chat commands show cooldown when attempted

---

## SCHEDULED CLEANUP

### Expired Cooldown Cleanup
```sql
-- Run every hour
DELETE FROM cooldowns WHERE expires_at < NOW();
```

---

## EDGE CASES

| Scenario | Handling |
|----------|----------|
| Player has $0 and wants bail | Bail costs $0, freedom granted |
| Player's jail expires naturally | Cooldown auto-cleared, no announcement |
| Player tries !play while jailed | Reject with time remaining |
| Multiple cooldowns active | Each tracked independently |
| Cooldown expires mid-command | Command succeeds (checked at start) |
| Server restart | PostgreSQL cooldowns persist; Redis cooldowns may need rebuild |

---

## NOTIFICATION TRIGGERS

| Event | Notification |
|-------|--------------|
| Jailed | Website notification with expiry time |
| Jail expired | Website notification: "You're free!" |
| Bail paid | Announcement in chat only |

---

## CONFIGURATION

```javascript
const COOLDOWN_CONFIG = {
    jail: {
        durationMinutes: 60,
        bailCostPercent: 0.10
    },
    robTarget: {
        durationHours: 24
    },
    businessRevenue: {
        durationHours: 2
    },
    crateOpenChat: {
        durationSeconds: 30
    }
};
```

---

**END OF DOCUMENT**
