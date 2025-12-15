# 06. LEADERBOARDS SYSTEM

---

## OVERVIEW

Multi-period leaderboards track player performance across daily, weekly, monthly, annual, and lifetime intervals. Leaderboards create competitive engagement and recognize top performers.

---

## LEADERBOARD PERIODS

| Period | Reset Schedule | Tracking Duration |
|--------|----------------|-------------------|
| Daily | Midnight UTC | 24 hours |
| Weekly | Sunday Midnight UTC | 7 days |
| Monthly | 1st of Month Midnight UTC | Calendar month |
| Annual | January 1st Midnight UTC | Calendar year |
| Lifetime | Never | Forever |

---

## TRACKED METRICS

### Game Metrics

| Metric | Description |
|--------|-------------|
| wealth_earned | Total wealth gained (not current balance) |
| xp_earned | Total XP gained |
| play_count | Number of !play commands |
| rob_count | Number of !rob attempts |
| rob_success_count | Number of successful robs |
| business_collections | Number of business revenue collections |
| crates_opened | Number of crates opened |
| checkins | Number of check-ins |

### Chat Metrics

| Metric | Description |
|--------|-------------|
| messages_sent | Total chat messages |
| watch_time_minutes | Time spent in stream (Kick/Twitch) |

### Monetization Metrics

| Metric | Description |
|--------|-------------|
| subs_count | Number of subscriptions |
| gift_subs_given | Number of gift subs sent |
| bits_donated | Total bits (Twitch) |
| kicks_sent | Total kicks (Kick) |
| donations_usd | Total Stripe donations |
| total_contributed_usd | Combined USD value of all contributions |

---

## LEADERBOARD TYPES

### 1. Wealth Earned
- Tracks total wealth gained during period
- Does NOT decrease when spending
- Primary competitive metric

### 2. XP Earned
- Tracks total XP gained during period
- Measures overall activity

### 3. Top Chatters
- Tracks message count
- Measures community engagement

### 4. Top Contributors
- Tracks total_contributed_usd
- Monetary support leaderboard

### 5. Rob Masters
- Tracks successful rob count
- PvP achievement

### 6. Grinders
- Tracks play_count
- Pure activity metric

---

## SNAPSHOT SYSTEM

### How Snapshots Work
1. Every tracked action updates the current period's snapshot
2. Snapshots are cumulative within their period
3. At period end, snapshot is finalized
4. New snapshot begins for next period

### Snapshot Update Logic
```javascript
async function updateLeaderboardSnapshot(userId, metrics) {
    const periods = ['daily', 'weekly', 'monthly', 'annual', 'lifetime'];
    
    for (const period of periods) {
        const { start, end } = getPeriodBounds(period);
        
        await db.query(`
            INSERT INTO leaderboard_snapshots (
                user_id, period_type, period_start, period_end,
                wealth_earned, xp_earned, messages_sent, play_count, rob_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, period_type, period_start)
            DO UPDATE SET
                wealth_earned = leaderboard_snapshots.wealth_earned + $5,
                xp_earned = leaderboard_snapshots.xp_earned + $6,
                messages_sent = leaderboard_snapshots.messages_sent + $7,
                play_count = leaderboard_snapshots.play_count + $8,
                rob_count = leaderboard_snapshots.rob_count + $9
        `, [userId, period, start, end, 
            metrics.wealth || 0,
            metrics.xp || 0,
            metrics.messages || 0,
            metrics.plays || 0,
            metrics.robs || 0
        ]);
    }
}
```

---

## LEADERBOARD QUERIES

### Top 10 by Wealth (Daily)
```sql
SELECT u.username, u.kingpin_name, ls.wealth_earned
FROM leaderboard_snapshots ls
JOIN users u ON u.user_id = ls.user_id
WHERE ls.period_type = 'daily'
  AND ls.period_start = CURRENT_DATE
ORDER BY ls.wealth_earned DESC
LIMIT 10;
```

### Top 10 by Contributions (Weekly)
```sql
SELECT u.username, ls.total_contributed_usd
FROM leaderboard_snapshots ls
JOIN users u ON u.user_id = ls.user_id
WHERE ls.period_type = 'weekly'
  AND ls.period_start = DATE_TRUNC('week', CURRENT_DATE)
ORDER BY ls.total_contributed_usd DESC
LIMIT 10;
```

### User's Rank (Any Period)
```sql
WITH ranked AS (
    SELECT user_id, 
           RANK() OVER (ORDER BY wealth_earned DESC) as rank
    FROM leaderboard_snapshots
    WHERE period_type = $1
      AND period_start = $2
)
SELECT rank FROM ranked WHERE user_id = $3;
```

---

## HALL OF FAME

### Lifetime Records
- Highest single-period wealth earned
- Highest level achieved
- Longest check-in streak
- Most Juicernaut session wins
- Highest single donation

### Record Tracking
```sql
CREATE TABLE hall_of_fame_records (
    record_id SERIAL PRIMARY KEY,
    record_type VARCHAR(50) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(user_id),
    record_value BIGINT NOT NULL,
    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    previous_holder_id INTEGER,
    previous_value BIGINT
);
```

### Record Check on Update
```javascript
async function checkHallOfFameRecord(recordType, userId, value) {
    const current = await db.query(`
        SELECT * FROM hall_of_fame_records WHERE record_type = $1
    `, [recordType]);
    
    if (!current.rows[0] || value > current.rows[0].record_value) {
        await db.query(`
            INSERT INTO hall_of_fame_records (record_type, user_id, record_value, previous_holder_id, previous_value)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (record_type) DO UPDATE SET
                previous_holder_id = hall_of_fame_records.user_id,
                previous_value = hall_of_fame_records.record_value,
                user_id = $2,
                record_value = $3,
                achieved_at = NOW()
        `, [recordType, userId, value, 
            current.rows[0]?.user_id, 
            current.rows[0]?.record_value]);
        
        return true; // New record!
    }
    return false;
}
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!lb` | All | Default leaderboard (daily wealth) |
| `!lb daily` | All | Daily wealth top 10 |
| `!lb weekly` | All | Weekly wealth top 10 |
| `!lb monthly` | All | Monthly wealth top 10 |
| `!lb lifetime` | All | Lifetime wealth top 10 |
| `!lb donations` | All | Top contributors (weekly) |
| `!lb chatters` | All | Top chatters (weekly) |
| `!rank` | All | Your current rank across periods |

### Leaderboard Output
```
🏆 Daily Wealth Leaderboard:
1. 👑 SimianMonke - $145,230
2. CyberPunk2098 - $98,500
3. NeonRaider - $87,320
4. GhostProtocol - $76,100
5. DataThief99 - $65,800
6. ChromeHeart - $54,200
7. VoidWalker - $43,100
8. SteelNerve - $32,500
9. NightShade - $21,800
10. PixelDust - $15,200
```

### Rank Output
```
📊 @PlayerName Rankings:
Daily: #15 ($8,500 earned)
Weekly: #7 ($45,200 earned)
Monthly: #12 ($180,500 earned)
Lifetime: #42 ($1.2M earned)
```

---

## PERIOD BOUNDARIES

### Calculation Functions
```javascript
function getPeriodBounds(periodType) {
    const now = new Date();
    
    switch (periodType) {
        case 'daily':
            const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            return {
                start: dayStart,
                end: new Date(dayStart.getTime() + 86400000 - 1)
            };
            
        case 'weekly':
            const weekStart = new Date(now);
            weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
            weekStart.setUTCHours(0, 0, 0, 0);
            return {
                start: weekStart,
                end: new Date(weekStart.getTime() + 604800000 - 1)
            };
            
        case 'monthly':
            const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
            return { start: monthStart, end: monthEnd };
            
        case 'annual':
            const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
            const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
            return { start: yearStart, end: yearEnd };
            
        case 'lifetime':
            return {
                start: new Date('2025-01-01'),
                end: new Date('2099-12-31')
            };
    }
}
```

---

## DATABASE SCHEMA

```sql
CREATE TABLE leaderboard_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Game Metrics
    wealth_earned BIGINT DEFAULT 0,
    xp_earned BIGINT DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    watch_time_minutes INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    rob_count INTEGER DEFAULT 0,
    rob_success_count INTEGER DEFAULT 0,
    checkins INTEGER DEFAULT 0,
    crates_opened INTEGER DEFAULT 0,
    
    -- Monetization Metrics
    subs_count INTEGER DEFAULT 0,
    gift_subs_given INTEGER DEFAULT 0,
    bits_donated INTEGER DEFAULT 0,
    kicks_sent INTEGER DEFAULT 0,
    donations_usd DECIMAL(10,2) DEFAULT 0,
    total_contributed_usd DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX idx_snapshots_period ON leaderboard_snapshots(period_type, period_start);
CREATE INDEX idx_snapshots_wealth ON leaderboard_snapshots(period_type, period_start, wealth_earned DESC);
CREATE INDEX idx_snapshots_contributions ON leaderboard_snapshots(period_type, period_start, total_contributed_usd DESC);
```

---

## ANNOUNCEMENTS

### Daily Reset (Top 3 Shoutout)
```
🏆 Yesterday's Top Earners:
🥇 @SimianMonke - $145,230
🥈 @CyberPunk2098 - $98,500
🥉 @NeonRaider - $87,320
```

### Weekly MVP
```
👑 This Week's MVP: @SimianMonke
💰 $523,000 earned | ⭐ 12,500 XP | 📊 Rank #1
```

### New Hall of Fame Record
```
🏆 NEW RECORD! @PlayerName broke the record for highest daily earnings!
Previous: $200,000 by @OldChamp
New Record: $245,000!
```

---

## SCHEDULED JOBS

| Job | Schedule | Action |
|-----|----------|--------|
| Daily Reset Announcement | Midnight UTC | Announce top 3, reset daily |
| Weekly MVP Announcement | Sunday Midnight UTC | Announce weekly winners |
| Monthly Summary | 1st of Month | Generate monthly report |
| Snapshot Cleanup | Daily 2:00 UTC | Archive old snapshots (>1 year) |

---

**END OF DOCUMENT**
