# REF: SCHEDULED JOBS

---

## OVERVIEW

All background jobs, cron schedules, and automated tasks for the Kingpin system.

---

## DAILY JOBS

| Job | Schedule (UTC) | Description | System |
|-----|----------------|-------------|--------|
| Daily Mission Reset | 00:00 | Expire old dailies, assign new to all active users | Missions |
| Daily Leaderboard Announce | 00:01 | Announce previous day's top 3 earners | Leaderboards |
| Territory Evaluation | 00:05 | Calculate scores, update territory control | Factions |
| Check-in Streak Reset Check | 00:10 | Mark missed check-ins (streak = 0 for inactive) | Users |
| Notification Cleanup | 02:00 | Delete notifications older than 30 days | Communications |
| Mission Record Cleanup | 02:15 | Delete mission records older than 30 days | Missions |
| Cooldown Cleanup | 02:30 | Delete expired cooldown records | Cooldowns |
| Leaderboard Snapshot Archive | 03:00 | Archive snapshots older than 1 year | Leaderboards |

---

## WEEKLY JOBS

| Job | Schedule (UTC) | Description | System |
|-----|----------------|-------------|--------|
| Weekly Mission Reset | Sunday 00:00 | Expire old weeklies, assign new | Missions |
| Weekly Faction Rewards | Sunday 00:15 | Distribute territory control rewards | Factions |
| Weekly Faction Announce | Sunday 00:20 | Announce winning faction | Factions |
| Weekly Leaderboard Announce | Sunday 00:30 | Announce weekly MVPs | Leaderboards |
| Weekly Chatter Rank Calc | Sunday 23:59 | Calculate final weekly chatter rankings | Leaderboards |
| Territory Score Reset | Monday 00:01 | Clear weekly territory contribution scores | Factions |

---

## PERIODIC JOBS

| Job | Frequency | Description | System |
|-----|-----------|-------------|--------|
| Black Market Rotation | Every 6 hours | Generate new market inventory | Items |
| Batch Queue Processor | Every 15 seconds | Process batched chat announcements | Communications |
| Escrow Cleanup | Every 15 minutes | Delete expired escrow items, notify users | Items/Crates |
| Expired Buff Cleanup | Every hour | Deactivate expired buffs | Buffs |
| Session Grace Period Check | Every hour | Check for orphaned sessions (6h auto-end) | Juicernaut |

---

## SESSION-BASED JOBS

These run only during active streaming sessions:

| Job | Frequency | Description | System |
|-----|-----------|-------------|--------|
| Juicernaut Leaderboard Post | Every 30 minutes | Post current standings to chat | Juicernaut |
| Heist Alert Trigger | Random 60-120 min | Trigger random heist event | Heist Alerts |
| Viewer Count Update | Every 5 minutes | Update peak viewer count | Sessions |

---

## MONTHLY JOBS

| Job | Schedule (UTC) | Description | System |
|-----|----------------|-------------|--------|
| Monthly Leaderboard Announce | 1st 00:00 | Announce monthly top performers | Leaderboards |
| Monthly Statistics Report | 1st 01:00 | Generate admin statistics report | Admin |

---

## ANNUAL JOBS

| Job | Schedule (UTC) | Description | System |
|-----|----------------|-------------|--------|
| Annual Leaderboard Announce | Jan 1 00:00 | Announce yearly champions | Leaderboards |
| Annual Data Archive | Jan 1 02:00 | Archive old data to cold storage | Database |

---

## JOB IMPLEMENTATIONS

### Daily Mission Reset
```javascript
async function dailyMissionReset() {
    // 1. Expire all active daily missions
    await db.query(`
        UPDATE user_missions
        SET status = 'expired'
        WHERE mission_type = 'daily'
          AND status = 'active'
          AND expires_at < NOW()
    `);
    
    // 2. Get all active users (seen in last 7 days)
    const activeUsers = await db.query(`
        SELECT user_id, status_tier FROM users
        WHERE last_seen > NOW() - INTERVAL '7 days'
    `);
    
    // 3. Assign new daily missions to each user
    for (const user of activeUsers.rows) {
        await assignDailyMissions(user.user_id, user.status_tier);
    }
    
    console.log(`Assigned daily missions to ${activeUsers.rows.length} users`);
}
```

### Territory Evaluation
```javascript
async function evaluateTerritories() {
    const territories = await db.query('SELECT * FROM territories');
    
    for (const territory of territories.rows) {
        // Get faction scores for this territory
        const scores = await db.query(`
            SELECT faction_id, SUM(total_score) as score
            FROM territory_scores
            WHERE territory_id = $1
              AND score_date = CURRENT_DATE - 1
            GROUP BY faction_id
            ORDER BY score DESC
        `, [territory.territory_id]);
        
        let newController = null;
        
        if (territory.is_contested) {
            // Contested: need 2x second place
            if (scores.rows.length >= 2 && 
                scores.rows[0].score >= scores.rows[1].score * 2) {
                newController = scores.rows[0].faction_id;
            }
        } else {
            // Standard: highest wins
            if (scores.rows.length > 0 && scores.rows[0].score > 0) {
                newController = scores.rows[0].faction_id;
            }
        }
        
        // Update if changed
        if (newController !== territory.controlling_faction_id) {
            await updateTerritoryControl(territory, newController);
        }
    }
}
```

### Black Market Rotation
```javascript
async function rotateBlackMarket() {
    const rotationId = Date.now();
    const availableUntil = new Date(Date.now() + 6 * 60 * 60 * 1000);
    
    // Mark current items as unavailable
    await db.query(`
        UPDATE black_market_inventory
        SET available_until = NOW()
        WHERE available_until > NOW()
    `);
    
    // 30% chance for legendary item
    if (Math.random() < 0.3) {
        const legendary = await getRandomItem('legendary');
        await addToMarket(legendary, rotationId, 1 + Math.floor(Math.random() * 3));
    }
    
    // 2-3 rare items
    const rareCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < rareCount; i++) {
        const rare = await getRandomItem('rare');
        await addToMarket(rare, rotationId, 3 + Math.floor(Math.random() * 6));
    }
    
    // 3-5 uncommon items
    const uncommonCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < uncommonCount; i++) {
        const uncommon = await getRandomItem('uncommon');
        await addToMarket(uncommon, rotationId, 5 + Math.floor(Math.random() * 6));
    }
    
    // 3-5 common items
    const commonCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < commonCount; i++) {
        const common = await getRandomItem('common');
        await addToMarket(common, rotationId, 10 + Math.floor(Math.random() * 11));
    }
    
    // Select one random item for 25% discount
    await db.query(`
        UPDATE black_market_inventory
        SET is_featured = TRUE, discount_percent = 25
        WHERE rotation_id = $1
        ORDER BY RANDOM()
        LIMIT 1
    `, [rotationId]);
    
    // Announce
    await announceToChat('🏪 Black Market has been restocked! Use !market to see new items!');
}
```

### Escrow Cleanup
```javascript
async function cleanupEscrow() {
    // Get expired escrow items
    const expiredItems = await db.query(`
        SELECT ui.*, u.user_id, i.item_name
        FROM user_inventory ui
        JOIN users u ON u.user_id = ui.user_id
        JOIN items i ON i.item_id = ui.item_id
        WHERE ui.is_escrowed = TRUE
          AND ui.escrow_expires_at < NOW()
    `);
    
    // Delete and notify
    for (const item of expiredItems.rows) {
        await db.query('DELETE FROM user_inventory WHERE inventory_id = $1', [item.inventory_id]);
        await sendNotification(item.user_id, 'crate_expired', {
            title: 'Item expired!',
            message: `Your escrowed ${item.item_name} has expired and been lost.`,
            icon: '❌'
        });
    }
    
    // Same for crates
    const expiredCrates = await db.query(`
        SELECT * FROM user_crates
        WHERE is_escrowed = TRUE
          AND escrow_expires_at < NOW()
    `);
    
    for (const crate of expiredCrates.rows) {
        await db.query('DELETE FROM user_crates WHERE crate_id = $1', [crate.crate_id]);
        await sendNotification(crate.user_id, 'crate_expired', {
            title: 'Crate expired!',
            message: `Your escrowed ${crate.crate_tier} crate has expired and been lost.`,
            icon: '❌'
        });
    }
    
    console.log(`Cleaned up ${expiredItems.rows.length} items and ${expiredCrates.rows.length} crates`);
}
```

### Session Grace Period Check
```javascript
async function checkSessionGracePeriod() {
    const orphanedSessions = await db.query(`
        SELECT * FROM streaming_sessions
        WHERE is_active = TRUE
          AND started_at < NOW() - INTERVAL '6 hours'
          AND ended_at IS NULL
    `);
    
    for (const session of orphanedSessions.rows) {
        // Check if stream is actually offline
        const isLive = await checkStreamStatus(session.platform);
        
        if (!isLive) {
            // Auto-end the session
            await endSession(session.session_id);
            await sendAdminWebhook({
                title: '⚠️ Session Auto-Ended',
                description: `Session ${session.session_id} was automatically ended after 6 hour grace period.`
            });
        }
    }
}
```

---

## CRON EXPRESSIONS

| Job | Cron Expression |
|-----|-----------------|
| Midnight UTC | `0 0 * * *` |
| Every 6 hours | `0 */6 * * *` |
| Every hour | `0 * * * *` |
| Every 15 minutes | `*/15 * * * *` |
| Every 15 seconds | Use setInterval |
| Sunday midnight | `0 0 * * 0` |
| First of month | `0 0 1 * *` |
| January 1st | `0 0 1 1 *` |

---

## ERROR HANDLING

All scheduled jobs should:

1. Log start time
2. Wrap in try/catch
3. Log errors to admin webhook
4. Log completion time and stats
5. Not throw errors that crash the process

```javascript
async function runScheduledJob(jobName, jobFn) {
    const startTime = Date.now();
    console.log(`[${jobName}] Starting...`);
    
    try {
        await jobFn();
        const duration = Date.now() - startTime;
        console.log(`[${jobName}] Completed in ${duration}ms`);
    } catch (error) {
        console.error(`[${jobName}] Error:`, error);
        await sendAdminWebhook({
            title: `❌ Job Failed: ${jobName}`,
            description: error.message,
            color: 0xFF0000
        });
    }
}
```

---

## MONITORING

Track these metrics for each job:

| Metric | Description |
|--------|-------------|
| Last run time | When job last executed |
| Duration | How long job took |
| Success/Failure | Did job complete successfully |
| Records processed | Number of items handled |
| Errors | Any errors encountered |

---

**END OF DOCUMENT**
