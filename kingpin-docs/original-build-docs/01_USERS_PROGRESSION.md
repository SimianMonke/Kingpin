# 01. USERS & PROGRESSION SYSTEM

---

## OVERVIEW

The Users & Progression system manages player identity, experience tracking, leveling, status tiers, and daily engagement via check-ins. It serves as the foundation for all other game systems.

---

## PROFILE AUTO-CREATION

| Rule | Value |
|------|-------|
| Trigger | First chat message on Kick OR Twitch |
| Initial wealth | $0 |
| Initial XP | 0 |
| Initial level | 1 |
| Initial tier | Rookie |
| Check-in | Triggers on first message of the day (same message that creates profile) |
| Missions | Assigned immediately upon profile creation |

**Discord Note:** Discord messages do NOT create profiles. Users must link Kick or Twitch first.

---

## PLATFORM IDENTITY

### Default Behavior
- Kick and Twitch accounts are **separate entities** by default
- Each platform creates its own profile with platform-specific user ID
- Users can optionally link accounts via the website

### Account Linking
- Available via website OAuth flow
- Must link Kick OR Twitch before Discord can be linked
- Discord-only participation is NOT allowed

### Linking Flow
1. User authenticates with Kick on website
2. User authenticates with Twitch on website
3. System detects same user, prompts to merge
4. User confirms merge
5. Profiles are combined per merge rules

### Merge Rules

| Attribute | Merge Behavior |
|-----------|----------------|
| Wealth | Add together |
| XP | Keep higher value |
| Level | Recalculated from merged XP |
| Items | Merge inventories |
| Check-in streak | Keep higher streak |
| Achievements | Union of both (no duplicates) |
| Titles | Union of both |
| Faction membership | Keep most recent (if different) |

---

## USER ATTRIBUTES

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| user_id | SERIAL | Auto | Primary key |
| kick_user_id | VARCHAR(255) | NULL | Kick platform user ID |
| twitch_user_id | VARCHAR(255) | NULL | Twitch platform user ID |
| discord_user_id | VARCHAR(50) | NULL | Discord user ID (linked after streaming platform) |
| username | VARCHAR(100) | Required | Current display username |
| display_name | VARCHAR(100) | NULL | Platform display name |
| kingpin_name | VARCHAR(100) | NULL | Custom in-game name (optional) |
| wealth | BIGINT | 0 | In-game currency |
| xp | BIGINT | 0 | Experience points |
| level | INTEGER | 1 | Current level |
| status_tier | VARCHAR(50) | 'Rookie' | Current tier |
| hp | INTEGER | 100 | Health points (reserved for future) |
| checkin_streak | INTEGER | 0 | Consecutive check-in days |
| last_checkin_date | DATE | NULL | Last check-in date (UTC) |
| total_play_count | INTEGER | 0 | Lifetime !play commands |
| wins | INTEGER | 0 | Successful robs |
| losses | INTEGER | 0 | Failed robs |
| faction_id | INTEGER | NULL | Current faction (if joined) |
| joined_faction_at | TIMESTAMP | NULL | When joined current faction |
| created_at | TIMESTAMP | NOW() | Profile creation time |
| updated_at | TIMESTAMP | NOW() | Last update time |
| last_seen | TIMESTAMP | NOW() | Last activity time |

---

## EXPERIENCE & LEVELING

### XP Formula
```
XP required for Level N = 100 × 1.25^(N-1)
```

### XP Table (First 20 Levels)

| Level | XP Required | Cumulative XP |
|-------|-------------|---------------|
| 1→2 | 100 | 100 |
| 2→3 | 125 | 225 |
| 3→4 | 156 | 381 |
| 4→5 | 195 | 576 |
| 5→6 | 244 | 820 |
| 6→7 | 305 | 1,125 |
| 7→8 | 381 | 1,506 |
| 8→9 | 477 | 1,983 |
| 9→10 | 596 | 2,579 |
| 10→11 | 745 | 3,324 |
| 11→12 | 931 | 4,255 |
| 12→13 | 1,164 | 5,419 |
| 13→14 | 1,455 | 6,874 |
| 14→15 | 1,819 | 8,693 |
| 15→16 | 2,274 | 10,967 |
| 16→17 | 2,842 | 13,809 |
| 17→18 | 3,553 | 17,362 |
| 18→19 | 4,441 | 21,803 |
| 19→20 | 5,551 | 27,354 |
| 20→21 | 6,939 | 34,293 |

### Level Calculation
```javascript
function calculateLevel(totalXP) {
    let level = 1;
    let xpRequired = 100;
    let xpAccumulated = 0;
    
    while (xpAccumulated + xpRequired <= totalXP) {
        xpAccumulated += xpRequired;
        level++;
        xpRequired = Math.floor(100 * Math.pow(1.25, level - 1));
    }
    
    return level;
}
```

---

## STATUS TIERS

| Tier | Level Range | Benefits |
|------|-------------|----------|
| Rookie | 1-19 | Base shop, base !play rewards, base crate drop rates |
| Associate | 20-39 | Expanded shop, improved !play rewards, better crate odds, can join factions |
| Soldier | 40-59 | Further expanded shop, higher !play rewards, higher crate odds |
| Captain | 60-79 | Premium shop access, strong !play rewards, rare crates more common |
| Underboss | 80-99 | Elite shop, high !play rewards, legendary crates possible |
| Kingpin | 100+ | Full shop access, maximum !play rewards, best crate odds |

### Tier Determination
```javascript
function getTier(level) {
    if (level >= 100) return 'Kingpin';
    if (level >= 80) return 'Underboss';
    if (level >= 60) return 'Captain';
    if (level >= 40) return 'Soldier';
    if (level >= 20) return 'Associate';
    return 'Rookie';
}
```

### Tier Multipliers

| Tier | Multiplier | Used For |
|------|------------|----------|
| Rookie | 1.0x | Mission scaling, rewards |
| Associate | 1.1x | Mission scaling, rewards |
| Soldier | 1.2x | Mission scaling, rewards |
| Captain | 1.3x | Mission scaling, rewards |
| Underboss | 1.4x | Mission scaling, rewards |
| Kingpin | 1.5x | Mission scaling, rewards |

---

## CHECK-IN SYSTEM

### Trigger
First chat message of the day on any platform (Kick, Twitch, or Discord if linked)

### Timing
- Resets at **midnight UTC**
- Display next reset in user's local timezone on website

### Streak Rules

| Rule | Behavior |
|------|----------|
| Increment | First message each calendar day (UTC) |
| Reset | Missing a calendar day resets streak to 0 |
| Stream requirement | None - streaks count every day regardless of streaming |

### Rewards

| Component | Formula |
|-----------|---------|
| Wealth | 100 × streak |
| XP | 20 × streak |

### Milestone Bonuses

| Milestone | Bonus |
|-----------|-------|
| Day 7 | Rare Crate (in addition to wealth/XP) |
| Day 28 | Legendary Crate (in addition to wealth/XP) |

**Note:** Day 7 and Day 28 bonuses repeat every cycle (Day 7, 14, 21, 28, 35, etc.)

### Examples

| Day | Wealth | XP | Bonus |
|-----|--------|-----|-------|
| 1 | $100 | 20 | - |
| 2 | $200 | 40 | - |
| 7 | $700 | 140 | Rare Crate |
| 14 | $1,400 | 280 | Rare Crate |
| 21 | $2,100 | 420 | Rare Crate |
| 28 | $2,800 | 560 | Legendary Crate |
| 56 | $5,600 | 1,120 | Legendary Crate |
| 100 | $10,000 | 2,000 | - |

---

## DISPLAY NAME

### Priority Order
1. Custom Kingpin name (if set)
2. Latest platform username

### Setting Custom Name
- Via website profile page
- Max 100 characters
- Profanity filter applied
- Must be unique (optional - configurable)

---

## DATABASE SCHEMA

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    
    -- Platform Identities
    kick_user_id VARCHAR(255) UNIQUE,
    twitch_user_id VARCHAR(255) UNIQUE,
    discord_user_id VARCHAR(50) UNIQUE,
    
    -- Display
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    kingpin_name VARCHAR(100),
    
    -- Core Stats
    wealth BIGINT DEFAULT 0,
    xp BIGINT DEFAULT 0,
    level INTEGER DEFAULT 1,
    status_tier VARCHAR(50) DEFAULT 'Rookie',
    hp INTEGER DEFAULT 100,
    
    -- Check-in
    checkin_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,
    
    -- Tracking
    total_play_count INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    
    -- Faction
    faction_id INTEGER REFERENCES factions(faction_id),
    joined_faction_at TIMESTAMP,
    
    -- Discord Linking
    discord_username VARCHAR(100),
    discord_linked_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_positive_wealth CHECK (wealth >= 0),
    CONSTRAINT check_positive_xp CHECK (xp >= 0),
    CONSTRAINT check_positive_level CHECK (level >= 1)
);

-- Indexes
CREATE INDEX idx_users_kick ON users(kick_user_id);
CREATE INDEX idx_users_twitch ON users(twitch_user_id);
CREATE INDEX idx_users_discord ON users(discord_user_id);
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_users_wealth ON users(wealth DESC);
CREATE INDEX idx_users_faction ON users(faction_id);
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!profile` | All | View your profile |
| `!profile @user` | All | View another player's profile |
| `!balance` | All | View your current wealth |
| `!level` | All | View your current level and XP progress |

### Profile Output Example
```
👤 SimianMonke [🎖️ Captain]
💰 Wealth: $1,234,567
⭐ Level 65 (45,230 / 52,000 XP)
🔥 Check-in Streak: 14 days
⚔️ Faction: The Volkov Bratva
🏆 Title: [Master Thief]
```

---

## EDGE CASES

| Scenario | Handling |
|----------|----------|
| First message creates profile | Profile created, check-in triggered, missions assigned - all in one transaction |
| User messages on Kick then Twitch (unlinked) | Two separate profiles created |
| User links accounts mid-game | Merge per rules above |
| User levels up from check-in | Announce level up after check-in announcement |
| User reaches milestone streak (Day 7) | Award crate in same transaction as check-in |
| User misses a day | Streak resets to 0 on next check-in |
| User's Kingpin name conflicts | Reject or append numbers (configurable) |
| Discord message before Kick/Twitch linked | Message ignored, no profile created |

---

## ANNOUNCEMENTS

### Check-in
```
✅ @PlayerName checked in! Streak: 14 days (+$1,400, +280 XP)
```

### Check-in with Milestone
```
✅ @PlayerName checked in! Streak: 7 days (+$700, +140 XP) 📦 BONUS: Rare Crate!
```

### Level Up
```
🎉 @PlayerName leveled up to 65!
```

### Tier Promotion
```
🎖️ @PlayerName has reached Captain tier!
```

---

## INTEGRATION POINTS

- **Economy (!play)** - Awards XP, triggers level checks
- **Rob System** - Awards XP, updates win/loss counts
- **Missions** - Requires user profile, tier affects rewards
- **Achievements** - Triggered by level milestones, streak milestones
- **Leaderboards** - Queries user stats
- **Factions** - Requires Associate tier (Level 20+) to join

---

**END OF DOCUMENT**
