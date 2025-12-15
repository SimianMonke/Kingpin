# 10. MISSIONS SYSTEM

---

## OVERVIEW

Missions are solo objectives (daily/weekly) that encourage chat interaction and Kingpin engagement. Missions use an **all-or-nothing** reward structure - players must complete ALL assigned missions to receive ANY rewards.

---

## MISSION STRUCTURE

| Type | Count | Reset | Expiration |
|------|-------|-------|------------|
| Daily | 3 missions | Midnight UTC | Same day midnight |
| Weekly | 2 missions | Sunday Midnight UTC | Following Sunday midnight |

---

## ALL-OR-NOTHING MECHANICS

**Critical Rule:** Players receive $0 and 0 XP unless ALL missions of a type are complete.

| Completion | Reward |
|------------|--------|
| 0/3 Dailies | $0, 0 XP |
| 1/3 Dailies | $0, 0 XP |
| 2/3 Dailies | $0, 0 XP |
| **3/3 Dailies** | Sum of all 3 rewards + bonus |
| 0/2 Weeklies | $0, 0 XP |
| 1/2 Weeklies | $0, 0 XP |
| **2/2 Weeklies** | Sum of both rewards + bonus + crate |

---

## TIER SCALING

Missions scale based on player tier at time of assignment.

### Tier Multipliers

| Tier | Level | Multiplier |
|------|-------|------------|
| Rookie | 1-19 | 1.0x |
| Associate | 20-39 | 1.1x |
| Soldier | 40-59 | 1.2x |
| Captain | 60-79 | 1.3x |
| Underboss | 80-99 | 1.4x |
| Kingpin | 100+ | 1.5x |

### Scaling Application
- Objectives scale by multiplier (rounded up)
- Rewards scale by multiplier (rounded down)
- Tier is locked at assignment (level up doesn't change active missions)

---

## DIFFICULTY DISTRIBUTION

### Daily Missions
| Difficulty | Chance | Example Objectives |
|------------|--------|-------------------|
| Easy | 50% | 15 messages, 5 !plays |
| Medium | 35% | 30 messages, rob attempt |
| Hard | 15% | 50 messages, 3 rob successes |

### Weekly Missions
| Difficulty | Chance | Example Objectives |
|------------|--------|-------------------|
| Easy | 40% | 100 messages, 25 !plays |
| Medium | 40% | 200 messages, 5 robs |
| Hard | 20% | Check-in every day, top 50 chatter |

---

## REWARD STRUCTURE

### Daily Rewards (by Difficulty, Rookie baseline)

| Difficulty | Wealth | XP |
|------------|--------|-----|
| Easy | $500 | 50 |
| Medium | $1,000 | 100 |
| Hard | $2,000 | 200 |

### Weekly Rewards (by Difficulty, Rookie baseline)

| Difficulty | Wealth | XP | Bonus |
|------------|--------|-----|-------|
| Easy | $3,000 | 300 | - |
| Medium | $6,000 | 600 | - |
| Hard | $12,000 | 1,200 | 10% Common Crate |

### Completion Bonuses (Flat)

| Type | Wealth | XP | Bonus |
|------|--------|-----|-------|
| All 3 Dailies | +$500 | +50 | - |
| All 2 Weeklies | +$2,000 | +200 | Common Crate |

### Example: Rookie Completes All Dailies

| Mission | Wealth | XP |
|---------|--------|-----|
| Daily Easy | $500 | 50 |
| Daily Medium | $1,000 | 100 |
| Daily Hard | $2,000 | 200 |
| Completion Bonus | $500 | 50 |
| **TOTAL** | **$4,000** | **400** |

### Example: Kingpin Completes All Dailies (1.5x)

| Mission | Wealth | XP |
|---------|--------|-----|
| Daily Easy | $750 | 75 |
| Daily Medium | $1,500 | 150 |
| Daily Hard | $3,000 | 300 |
| Completion Bonus | $500 | 50 |
| **TOTAL** | **$5,750** | **575** |

---

## MISSION CATEGORIES

### Chat (Messages)
- Send X messages
- Send message with emote
- Chat in X unique hours

### Economy
- Use !play X times
- Earn $X total wealth
- Collect business revenue

### Combat
- Attempt X robs
- Win X robs
- Successfully defend X robs

### Loyalty
- Check in today
- Maintain X-day streak
- Check in every day this week

### Exploration
- View your profile
- View the leaderboard
- View the Black Market

### Social
- Finish in top X weekly chatters
- View another player's profile

---

## MISSION POOL (Sample)

### Daily Missions

| ID | Category | Difficulty | Name | Objective | Base Value |
|----|----------|------------|------|-----------|------------|
| D-CHAT-01 | Chat | Easy | Word on the Street | Send X messages | 15 |
| D-CHAT-02 | Chat | Medium | Chatty | Send X messages | 30 |
| D-CHAT-03 | Chat | Hard | Motormouth | Send X messages | 50 |
| D-ECON-01 | Economy | Easy | Hustle | Use !play X times | 5 |
| D-ECON-02 | Economy | Medium | Grinder | Use !play X times | 15 |
| D-ECON-03 | Economy | Hard | No Rest | Use !play X times | 25 |
| D-COMB-01 | Combat | Easy | Opportunist | Attempt X robs | 1 |
| D-COMB-02 | Combat | Medium | Aggressive | Attempt X robs | 3 |
| D-COMB-03 | Combat | Hard | Relentless | Win X robs | 3 |
| D-LOYA-01 | Loyalty | Easy | Present | Check in today | 1 |
| D-EXPL-01 | Exploration | Easy | Self-Reflection | View your profile | 1 |
| D-EXPL-02 | Exploration | Easy | Scout | View the leaderboard | 1 |

### Weekly Missions

| ID | Category | Difficulty | Name | Objective | Base Value |
|----|----------|------------|------|-----------|------------|
| W-CHAT-01 | Chat | Easy | Regular | Send X messages | 100 |
| W-CHAT-02 | Chat | Medium | Active | Send X messages | 200 |
| W-CHAT-03 | Chat | Hard | Voice of Lazarus | Send X messages | 400 |
| W-ECON-01 | Economy | Easy | Worker | Use !play X times | 25 |
| W-ECON-02 | Economy | Medium | Dedicated | Use !play X times | 50 |
| W-COMB-01 | Combat | Easy | Hunter | Attempt X robs | 5 |
| W-COMB-02 | Combat | Medium | Predator | Win X robs | 5 |
| W-LOYA-01 | Loyalty | Hard | Devoted | Check in every day (7) | 7 |
| W-SOCI-01 | Social | Hard | Top 50 | Finish in top 50 chatters | 50 |

---

## ASSIGNMENT RULES

### Variety Guarantee
- Maximum 1 mission per category per period
- No duplicate mission templates in same period
- Luck-based missions capped at 1 per day

### Assignment Timing
- Daily: Midnight UTC
- Weekly: Sunday Midnight UTC
- New players: Assigned immediately upon profile creation

### Tier Lock
- Tier determined at assignment time
- Level up during period does NOT change assigned missions

---

## OBJECTIVE TYPES

| Type | Tracking Method |
|------|-----------------|
| messages_sent | Chat handler increment |
| play_count | !play handler increment |
| rob_attempts | !rob handler increment |
| rob_successes | !rob success increment |
| rob_defenses | !rob defense increment |
| checkin_today | Check-in handler (boolean) |
| checkin_streak | Current streak value |
| profile_viewed | !profile handler (boolean) |
| leaderboard_viewed | !lb handler (boolean) |
| item_purchased | Purchase handler increment |
| black_market_viewed | !market handler (boolean) |
| crate_opened | Crate open increment |
| weekly_chatter_rank | Calculated at week end |

---

## DATABASE SCHEMA

```sql
CREATE TABLE mission_templates (
    template_id VARCHAR(20) PRIMARY KEY,
    mission_type VARCHAR(10) NOT NULL,
    category VARCHAR(20) NOT NULL,
    difficulty VARCHAR(10) NOT NULL,
    
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    
    objective_type VARCHAR(50) NOT NULL,
    objective_base_value INTEGER NOT NULL,
    
    is_luck_based BOOLEAN DEFAULT FALSE,
    requires_item VARCHAR(50),
    
    reward_wealth INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_missions (
    user_mission_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    template_id VARCHAR(20) REFERENCES mission_templates(template_id),
    
    mission_type VARCHAR(10) NOT NULL,
    assigned_tier VARCHAR(20) NOT NULL,
    tier_multiplier DECIMAL(3,2) NOT NULL,
    
    objective_value INTEGER NOT NULL,
    reward_wealth INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE mission_completions (
    completion_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    
    completion_type VARCHAR(10) NOT NULL,
    completed_date DATE NOT NULL,
    
    mission_ids INTEGER[] NOT NULL,
    
    total_wealth INTEGER NOT NULL,
    total_xp INTEGER NOT NULL,
    bonus_wealth INTEGER NOT NULL,
    bonus_xp INTEGER NOT NULL,
    crate_awarded VARCHAR(20),
    
    player_tier VARCHAR(20) NOT NULL,
    
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_missions_user ON user_missions(user_id);
CREATE INDEX idx_user_missions_status ON user_missions(status, expires_at);
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!missions` | All | View all active missions |
| `!missions daily` | All | View daily missions only |
| `!missions weekly` | All | View weekly missions only |

### Missions Output
```
📋 @PlayerName's Missions

📅 DAILY (expires in 6h 23m):
  ✓ Word on the Street - 15/15 messages ✅
  ○ Hustle - 3/5 !plays
  ○ Self-Reflection - 0/1 profile views

📆 WEEKLY (expires in 4d 6h):
  ○ Regular - 67/100 messages
  ○ Worker - 12/25 !plays
```

---

## ANNOUNCEMENTS

### Daily Complete
```
🎯 @PlayerName completed all daily missions! +$4,000 💰 +400 XP
```

### Weekly Complete
```
🎯 @PlayerName completed all weekly missions! +$18,500 💰 +1,850 XP + 📦 Common Crate
```

---

## SCHEDULED JOBS

| Job | Schedule | Action |
|-----|----------|--------|
| Daily Reset | Midnight UTC | Expire old dailies, assign new |
| Weekly Reset | Sunday Midnight UTC | Expire old weeklies, assign new |
| Mission Cleanup | Daily 1:00 UTC | Delete records > 30 days |

---

**END OF DOCUMENT**
