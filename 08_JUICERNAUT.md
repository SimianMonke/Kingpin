# 08. JUICERNAUT SYSTEM

---

## OVERVIEW

The Juicernaut system is a real-time donation competition during live streams. The top monetary contributor holds the "Juicernaut" crown and receives powerful temporary buffs. When someone contributes more, the crown changes hands with dramatic announcement.

---

## SESSION LIFECYCLE

### Session Start
- **Trigger:** Manual `!startSession` command or automatic on stream going live
- **Actions:**
  - Create new streaming_sessions record
  - Set is_active = TRUE
  - Announce session start to chat
  - Trigger Lumia webhook

### During Session
- Track all monetization events
- Convert to USD value
- Update session leaderboard
- Handle crown changes

### Session End
- **Trigger:** Manual `!endSession` command or automatic (see grace period)
- **Actions:**
  - Calculate winner
  - Distribute rewards
  - Remove all Juicernaut buffs
  - Record in juicernaut_winners
  - Mark session inactive
  - Announce results
  - Trigger Lumia webhook

---

## GRACE PERIOD

If stream goes offline unexpectedly:

| Phase | Duration | Behavior |
|-------|----------|----------|
| Initial | 0-2 hours | Session remains active, awaiting stream return |
| Warning | 2 hours | Admin webhook: "Session will auto-end in 4 hours" |
| Auto-End | 6 hours | Session automatically ends, winner calculated |

---

## CONTRIBUTION VALUES

### Kick

| Event | USD Value |
|-------|-----------|
| Tier 1 Sub | $5.00 |
| Tier 2 Sub | $10.00 |
| Tier 3 Sub | $25.00 |
| Gift Sub (per sub) | $5.00 |
| Kick (per kick) | $0.01 |

### Twitch

| Event | USD Value |
|-------|-----------|
| Tier 1 Sub | $5.00 |
| Tier 2 Sub | $10.00 |
| Tier 3 Sub | $25.00 |
| Gift Sub (per sub) | $5.00 |
| 100 Bits | $1.00 |
| Raid (per viewer) | $0.10 |

### Stripe

| Event | USD Value |
|-------|-----------|
| Donation | Face value |

---

## JUICERNAUT BUFFS

While holding the crown, the Juicernaut receives:

| Buff | Effect | Buff Key |
|------|--------|----------|
| ⚡ Double XP | 2.0x XP from all sources | juicernaut_xp |
| 🎁 Triple Loot | 3.0x crate drop rate (6% instead of 2%) | juicernaut_loot |
| 🛡️ Rob Immunity | Cannot be robbed | juicernaut_immunity |
| 💼 Business Boost | 1.5x business revenue | juicernaut_business |
| 💰 Wealth Bonus | 1.25x wealth from !play | juicernaut_wealth |

### Buff Application
```javascript
async function applyJuicernautBuffs(userId) {
    const buffs = [
        { type: 'juicernaut_xp', multiplier: 2.0 },
        { type: 'juicernaut_loot', multiplier: 3.0 },
        { type: 'juicernaut_immunity', multiplier: 1.0 },
        { type: 'juicernaut_business', multiplier: 1.5 },
        { type: 'juicernaut_wealth', multiplier: 1.25 }
    ];
    
    for (const buff of buffs) {
        await db.query(`
            INSERT INTO active_buffs (user_id, buff_type, multiplier, is_active)
            VALUES ($1, $2, $3, TRUE)
            ON CONFLICT (user_id, buff_type)
            DO UPDATE SET multiplier = $3, is_active = TRUE, activated_at = NOW()
        `, [userId, buff.type, buff.multiplier]);
    }
}
```

### Buff Removal
```javascript
async function removeJuicernautBuffs(userId) {
    await db.query(`
        UPDATE active_buffs
        SET is_active = FALSE
        WHERE user_id = $1 AND buff_type LIKE 'juicernaut_%'
    `, [userId]);
}
```

---

## CROWN CHANGE

### Trigger
When a contribution pushes a user's total above the current Juicernaut's total.

### Process
```javascript
async function checkCrownChange(sessionId, contributorId, contributorTotal) {
    const session = await getSession(sessionId);
    
    if (!session.current_juicernaut_user_id) {
        // First contribution - crown them
        await crownNewJuicernaut(sessionId, contributorId, contributorTotal, null);
        return;
    }
    
    const currentTotal = await getSessionTotal(sessionId, session.current_juicernaut_user_id);
    
    if (contributorTotal > currentTotal && contributorId !== session.current_juicernaut_user_id) {
        await crownNewJuicernaut(sessionId, contributorId, contributorTotal, session.current_juicernaut_user_id);
    }
}

async function crownNewJuicernaut(sessionId, newUserId, newTotal, oldUserId) {
    await db.query('BEGIN');
    
    // Remove buffs from old Juicernaut
    if (oldUserId) {
        await removeJuicernautBuffs(oldUserId);
    }
    
    // Apply buffs to new Juicernaut
    await applyJuicernautBuffs(newUserId);
    
    // Update session
    await db.query(`
        UPDATE streaming_sessions
        SET current_juicernaut_user_id = $2
        WHERE session_id = $1
    `, [sessionId, newUserId]);
    
    // Log crown change
    await db.query(`
        INSERT INTO juicernaut_crown_changes 
        (session_id, previous_juicernaut_user_id, new_juicernaut_user_id, new_total_usd)
        VALUES ($1, $2, $3, $4)
    `, [sessionId, oldUserId, newUserId, newTotal]);
    
    await db.query('COMMIT');
    
    // Announce and trigger alerts
    await announceCrownChange(newUserId, oldUserId, newTotal);
    await triggerLumiaWebhook('crown_change');
}
```

---

## END-OF-SESSION REWARDS

| Contribution Total | Wealth | XP | Crate |
|-------------------|--------|-----|-------|
| $500+ | $50,000 | 10,000 | Legendary |
| $250-499 | $25,000 | 5,000 | Legendary |
| $100-249 | $10,000 | 2,500 | Rare |
| $50-99 | $5,000 | 1,000 | Rare |
| $25-49 | $2,500 | 500 | Uncommon |
| $0-24 | $1,000 | 250 | Common |

### Reward Calculation
```javascript
function calculateSessionRewards(totalContributedUSD) {
    if (totalContributedUSD >= 500) {
        return { wealth: 50000, xp: 10000, crateTier: 'legendary' };
    } else if (totalContributedUSD >= 250) {
        return { wealth: 25000, xp: 5000, crateTier: 'legendary' };
    } else if (totalContributedUSD >= 100) {
        return { wealth: 10000, xp: 2500, crateTier: 'rare' };
    } else if (totalContributedUSD >= 50) {
        return { wealth: 5000, xp: 1000, crateTier: 'rare' };
    } else if (totalContributedUSD >= 25) {
        return { wealth: 2500, xp: 500, crateTier: 'uncommon' };
    } else {
        return { wealth: 1000, xp: 250, crateTier: 'common' };
    }
}
```

---

## PERIODIC LEADERBOARD

During active sessions, post leaderboard every 30 minutes:

```javascript
async function postPeriodicLeaderboard(sessionId) {
    const top3 = await db.query(`
        SELECT u.username, SUM(sc.usd_value) as total
        FROM session_contributions sc
        JOIN users u ON u.user_id = sc.user_id
        WHERE sc.session_id = $1
        GROUP BY u.user_id, u.username
        ORDER BY total DESC
        LIMIT 3
    `, [sessionId]);
    
    // Format and post to chat
    // Trigger Lumia webhook
}
```

### Leaderboard Output
```
👑 JUICERNAUT STANDINGS:
🥇 SimianMonke - $45.00 (CURRENT JUICERNAUT)
🥈 CyberPunk - $32.00
🥉 NeonRaider - $18.50
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!juice` | All | Current session leaderboard |
| `!juicernaut` | All | Current session leaderboard |
| `!juicehall` | All | All-time Juicernaut hall of fame |

### Admin Commands
| Command | Platform | Description |
|---------|----------|-------------|
| `!startSession` | Kick/Twitch | Start new session (admin only) |
| `!endSession` | Kick/Twitch | End current session (admin only) |

---

## DATABASE SCHEMA

```sql
CREATE TABLE streaming_sessions (
    session_id SERIAL PRIMARY KEY,
    session_title VARCHAR(255),
    platform VARCHAR(20) NOT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    current_juicernaut_user_id INTEGER REFERENCES users(user_id),
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    
    total_contributions_usd DECIMAL(10,2) DEFAULT 0,
    total_viewers_peak INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0
);

CREATE TABLE session_contributions (
    contribution_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    user_id INTEGER REFERENCES users(user_id),
    
    platform VARCHAR(20) NOT NULL,
    contribution_type VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 1,
    usd_value DECIMAL(10,2) NOT NULL,
    
    monetization_event_id INTEGER REFERENCES monetization_events(event_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE juicernaut_winners (
    winner_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    user_id INTEGER REFERENCES users(user_id),
    
    total_contributed_usd DECIMAL(10,2) NOT NULL,
    contributions_count INTEGER NOT NULL,
    time_held_minutes INTEGER,
    
    reward_wealth BIGINT,
    reward_xp INTEGER,
    bonus_crate_tier VARCHAR(50),
    
    won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE juicernaut_crown_changes (
    change_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    
    previous_juicernaut_user_id INTEGER REFERENCES users(user_id),
    new_juicernaut_user_id INTEGER REFERENCES users(user_id),
    
    new_total_usd DECIMAL(10,2),
    
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_active ON streaming_sessions(is_active);
CREATE INDEX idx_contributions_session ON session_contributions(session_id);
CREATE INDEX idx_contributions_user ON session_contributions(session_id, user_id);
```

---

## ANNOUNCEMENTS

### Session Start
```
🎬 Stream started! Juicernaut competition is LIVE!
👑 Top contributor earns powerful buffs + bonus rewards!
```

### Crown Change
```
👑 THE CROWN HAS CHANGED HANDS! 👑
@NewPlayer has overthrown @OldPlayer to become the new JUICERNAUT! ($45.00)
⚡ Active Buffs: 2x XP | 3x Loot | Rob Immunity | 50% Business Boost | 25% Wealth Bonus
```

### Periodic Update (30 min)
```
👑 JUICERNAUT UPDATE:
🥇 @SimianMonke - $45.00 👑
🥈 @CyberPunk - $32.00
🥉 @NeonRaider - $18.50
Total session contributions: $127.50
```

### Session End
```
🏆 STREAM ENDED - JUICERNAUT RESULTS 🏆
👑 Winner: @SimianMonke
💵 Total Contributed: $45.00
🎁 Rewards: $10,000 + 2,500 XP + Rare Crate

Thanks to all contributors this session!
```

---

## LUMIA STREAM WEBHOOKS

| Event | Webhook |
|-------|---------|
| Session Start | LUMIA_WEBHOOK_SESSION_START |
| Crown Change | LUMIA_WEBHOOK_CROWN_CHANGE |
| Periodic Leaderboard | LUMIA_WEBHOOK_JUICE_LEADERBOARD |
| Session End | LUMIA_WEBHOOK_SESSION_END |

---

**END OF DOCUMENT**
