# 11. CRATES & LOOT SYSTEM

---

## OVERVIEW

Crates contain randomized rewards including weapons, armor, wealth, and exclusive titles. Players can hold up to 10 crates and open them via chat command or website.

---

## CRATE TIERS

| Tier | Rarity | Sources |
|------|--------|---------|
| Common | Most common | !play drops, missions, low-tier Juicernaut |
| Uncommon | Common | !play drops (higher tiers), faction rewards, **check-in streak (every 7 days)** |
| Rare | Uncommon | Higher tier !play, achievements |
| Legendary | Very rare | **Check-in streak (every 28 days)**, high-tier Juicernaut, achievements |

---

## CRATE SOURCES

| Source | Crate Tier |
|--------|------------|
| !play drop (2-6% chance) | Weighted by player tier |
| Check-in streak (every 7 days) | Uncommon |
| Check-in streak (every 28 days) | Legendary (overrides weekly) |
| Weekly mission completion | Common |
| Weekly Hard mission (10% chance) | Common |
| Juicernaut end-of-session | Based on contribution |
| Achievement rewards | Various |
| Faction weekly crate awards | Various |

### Check-in Milestone Crate Cycle

Players receive milestone crates for maintaining consecutive daily check-in streaks. This is a **perpetual repeating cycle** that continues as long as the streak is maintained:

| Streak Day | Crate Tier | Notes |
|------------|------------|-------|
| Day 7 | Uncommon | Weekly milestone |
| Day 14 | Uncommon | Weekly milestone |
| Day 21 | Uncommon | Weekly milestone |
| **Day 28** | **Legendary** | Monthly milestone (overrides weekly) |
| Day 35 | Uncommon | Weekly milestone |
| Day 42 | Uncommon | Weekly milestone |
| Day 49 | Uncommon | Weekly milestone |
| **Day 56** | **Legendary** | Monthly milestone (overrides weekly) |
| ... | ... | Pattern continues indefinitely |

**Rules:**
- Every 7 days: Uncommon crate
- Every 28 days: Legendary crate (takes priority over weekly reward)
- If streak breaks, cycle resets to Day 1
- No cap on streak length - rewards continue forever

---

## INVENTORY LIMITS

| Limit | Value |
|-------|-------|
| Max crates held | 10 |
| Escrow slots | 3 |
| Escrow duration | 1 hour |

### Overflow Handling
1. Crate awarded when inventory full → goes to escrow
2. Escrow has 3 slots
3. If escrow full → crate is LOST
4. Player notified of escrow/loss

---

## DROP TYPE DISTRIBUTION

What type of loot drops from a crate:

| Crate Tier | Weapon | Armor | Wealth | Title |
|------------|--------|-------|--------|-------|
| Common | 40% | 40% | 20% | 0% |
| Uncommon | 38% | 38% | 22% | 2% |
| Rare | 35% | 35% | 25% | 5% |
| Legendary | 30% | 30% | 30% | 10% |

---

## ITEM TIER FROM CRATE

When an item drops, what tier is the item:

| Crate Tier | Common Item | Uncommon Item | Rare Item | Legendary Item |
|------------|-------------|---------------|-----------|----------------|
| Common | 85% | 15% | 0% | 0% |
| Uncommon | 40% | 50% | 10% | 0% |
| Rare | 10% | 40% | 45% | 5% |
| Legendary | 0% | 15% | 50% | 35% |

---

## WEALTH DROPS

| Crate Tier | Wealth Range |
|------------|--------------|
| Common | $500 - $1,500 |
| Uncommon | $1,500 - $4,000 |
| Rare | $4,000 - $10,000 |
| Legendary | $10,000 - $30,000 |

---

## CRATE-EXCLUSIVE TITLES

40 total titles (10 per crate tier), only obtainable from crates.

### Common Titles (10)
| Title | Drop Chance |
|-------|-------------|
| Street Rat | Equal (10%) |
| Neon Drifter | Equal |
| Chrome Junkie | Equal |
| Data Ghost | Equal |
| Wire Runner | Equal |
| Gutter King | Equal |
| Static | Equal |
| Lowlife | Equal |
| Scrapheap | Equal |
| Nobody | Equal |

### Uncommon Titles (10)
| Title | Drop Chance |
|-------|-------------|
| Ghost Protocol | Equal (10%) |
| Shadow Broker | Equal |
| Circuit Breaker | Equal |
| Neon Phantom | Equal |
| Code Runner | Equal |
| Black Ice | Equal |
| Void Walker | Equal |
| Signal Lost | Equal |
| Dead Frequency | Equal |
| Night Market | Equal |

### Rare Titles (10)
| Title | Drop Chance |
|-------|-------------|
| Chrome Reaper | Equal (10%) |
| Cyber Ronin | Equal |
| Data Lord | Equal |
| Neural Hacker | Equal |
| Syndicate Ghost | Equal |
| Blackout | Equal |
| Protocol Zero | Equal |
| Edge Runner | Equal |
| Neon Samurai | Equal |
| Digital Demon | Equal |

### Legendary Titles (10)
| Title | Drop Chance |
|-------|-------------|
| Architect of Ruin | Equal (10%) |
| Apex Predator | Equal |
| Omega Protocol | Equal |
| The Singularity | Equal |
| Ghost in the Machine | Equal |
| Zero Day | Equal |
| Event Horizon | Equal |
| Quantum Ghost | Equal |
| The Algorithm | Equal |
| Lazarus Prime | Equal |

---

## DUPLICATE TITLES

When a player receives a title they already own:

| Title Tier | Wealth Conversion |
|------------|-------------------|
| Common | $500 |
| Uncommon | $1,500 |
| Rare | $5,000 |
| Legendary | $15,000 |

---

## OPENING MECHANICS

### Chat Command
- Command: `!open crate`
- Opens oldest crate (FIFO)
- 30 second cooldown
- Cannot specify tier (always oldest)

### Website
- Individual crate selection
- Batch open available
- No cooldown
- Stops batch if item would overflow inventory

### Open Logic
```javascript
async function openCrate(userId, crateId = null) {
    // Get crate (oldest if not specified)
    const crate = crateId 
        ? await getCrateById(userId, crateId)
        : await getOldestCrate(userId);
    
    if (!crate) throw new Error('No crates to open');
    
    // Roll drop type
    const dropType = rollDropType(crate.tier);
    
    let reward;
    switch (dropType) {
        case 'weapon':
        case 'armor':
            const itemTier = rollItemTier(crate.tier);
            reward = await getRandomItem(dropType, itemTier);
            await addItemToInventory(userId, reward);
            break;
            
        case 'wealth':
            reward = rollWealthAmount(crate.tier);
            await addWealth(userId, reward);
            break;
            
        case 'title':
            reward = await rollTitle(crate.tier, userId);
            if (reward.isDuplicate) {
                await addWealth(userId, reward.conversionValue);
            } else {
                await unlockTitle(userId, reward.title);
            }
            break;
    }
    
    // Remove crate
    await deleteCrate(crate.crate_id);
    
    return { dropType, reward, crateTier: crate.tier };
}
```

---

## INVENTORY FULL HANDLING

When opening a crate and inventory is full:

| Drop Type | Behavior |
|-----------|----------|
| Weapon/Armor | BLOCKED - cannot open |
| Wealth | Allowed - wealth added |
| Title | Allowed - title unlocked or converted |

### Pre-Open Check
```javascript
function canOpenCrate(inventory, crateCount) {
    // If inventory has room, always allow
    if (inventory.items.length < 10) return true;
    
    // If full, only blocked if item might drop
    // Allow opening if willing to risk item going to escrow
    return false; // Conservative: block all opens when full
}
```

---

## DATABASE SCHEMA

```sql
CREATE TABLE user_crates (
    crate_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    crate_tier VARCHAR(20) NOT NULL,
    
    is_escrowed BOOLEAN DEFAULT FALSE,
    escrow_expires_at TIMESTAMP,
    
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) -- 'play', 'checkin', 'mission', 'juicernaut', 'achievement', 'faction'
);

CREATE TABLE crate_opens (
    open_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    crate_tier VARCHAR(20) NOT NULL,
    
    drop_type VARCHAR(20) NOT NULL,
    
    -- Item drop
    item_id INTEGER REFERENCES items(item_id),
    item_tier VARCHAR(20),
    
    -- Wealth drop
    wealth_amount INTEGER,
    
    -- Title drop
    title_name VARCHAR(100),
    title_was_duplicate BOOLEAN,
    duplicate_conversion INTEGER,
    
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crate_titles (
    title_id SERIAL PRIMARY KEY,
    title_name VARCHAR(100) NOT NULL UNIQUE,
    crate_tier VARCHAR(20) NOT NULL,
    duplicate_value INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crates_user ON user_crates(user_id);
CREATE INDEX idx_crates_escrow ON user_crates(is_escrowed, escrow_expires_at);
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!crates` | All | View your crate inventory |
| `!open crate` | All | Open oldest crate (30s cooldown) |

### Crates Output
```
📦 @PlayerName's Crates (7/10):
  Common: 3
  Uncommon: 2
  Rare: 1
  Legendary: 1

⚠️ Escrow (2/3, expires in 45m):
  Uncommon: 1
  Common: 1
```

---

## ANNOUNCEMENTS

### Standard Open
```
📦 @PlayerName opened a Rare Crate and found a Neural Hacker (Rare Armor)!
```

### Wealth Drop
```
📦 @PlayerName opened a Legendary Crate and found $18,500!
```

### Title Drop
```
📦 @PlayerName opened a Legendary Crate and unlocked the title: [Apex Predator]!
```

### Duplicate Title
```
📦 @PlayerName opened a Rare Crate and found duplicate title [Chrome Reaper] → $5,000!
```

### Legendary Item (Special)
```
🌟 @PlayerName opened a Legendary Crate and found a LEGENDARY Quantum Blade!
```

---

## NOTIFICATIONS

### Escrow Warning
```
Title: "Crate in escrow!"
Message: "You have a crate in escrow! Claim within 1 hour or it's lost."
Icon: ⚠️
```

### Escrow Expired
```
Title: "Crate expired!"
Message: "Your escrowed crate has expired and been lost."
Icon: ❌
```

---

## SCHEDULED JOBS

| Job | Schedule | Action |
|-----|----------|--------|
| Escrow Cleanup | Every 15 minutes | Delete expired escrow crates, notify users |

---

**END OF DOCUMENT**
