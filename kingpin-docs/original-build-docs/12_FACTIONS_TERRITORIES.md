# 12. FACTIONS & TERRITORIES SYSTEM

---

## OVERVIEW

Three factions compete for control of 12 territories across Lazarus City. Players join factions, contribute to territory scores through gameplay, and earn rewards when their faction controls territories.

---

## THE THREE FACTIONS

### 1. THE VOLKOV BRATVA

| Attribute | Value |
|-----------|-------|
| Type | Eastern European crime syndicate |
| Philosophy | "In chaos, the strong eat the weak. We are not weak." |
| Color | Red (#DC143C) |
| Starting Territory | The Ports |
| Motto | "Кровь за кровь" (Blood for blood) |

**Background:** Russian organized crime that expanded aggressively when western corps pulled out of Lazarus. Ruthless, hierarchical, and utterly pragmatic.

**Operations:** Protection rackets, weapons trafficking, underground fighting rings, loan sharking.

---

### 2. DEAD CIRCUIT

| Attribute | Value |
|-----------|-------|
| Type | Techno-anarchist collective |
| Philosophy | "The system killed us. Now we're the virus in its corpse." |
| Color | Cyan (#00FFFF) |
| Starting Territory | The Hollows |
| Motto | "We are the signal in the static." |

**Background:** Started as hackers, smugglers, and outcasts who built their own infrastructure beneath the city. Part resistance, part criminal enterprise.

**Operations:** Data theft, identity trading, smuggling, underground transit networks, black market tech.

---

### 3. KESSLER GROUP

| Attribute | Value |
|-----------|-------|
| Type | Private military contractors |
| Philosophy | "Professionals. No politics. Results guaranteed." |
| Color | Olive (#808000) |
| Starting Territory | Midtown |
| Motto | "Payment on delivery." |

**Background:** Founded by a decorated special forces commander. Recruited the best operators from collapsing militaries worldwide. They don't care who's right—they care who's paying.

**Operations:** Security contracts, assassination, extraction, asset protection, military training.

---

## TERRITORIES (12 Total)

### Standard Territories (9)

| # | Territory | Description | Buff |
|---|-----------|-------------|------|
| 1 | Chrome Heights | Elite towers. The wealthy hiding above the rot. | +5% XP |
| 2 | Neon Mile | Entertainment district. Clubs, casinos, braindance dens. | +10% Business Revenue |
| 3 | The Ports | Shipping and smuggling. Bodies disappear here. | +5% Rob Success |
| 4 | Silicon Sprawl | Tech hub. Data centers, hacker dens, research labs. | +10% Crate Drop |
| 5 | Black Bazaar | Largest open market. Everything for sale. | +5% Shop Discount |
| 6 | The Hollows | Underground slums. Those who fell through the cracks. | +5% Defense |
| 7 | Midtown | Buffer zone. Office drones by day, predators by night. | +5% XP |
| 8 | Rustlands | Industrial wastes. Toxic air, desperate workers. | +10% Business Revenue |
| 9 | Memorial District | Old city ruins. Crumbling monuments, ghosts of before. | +5% Wealth |

### Contested Territories (3)

Require 2x the score to capture. Worth 1.5x for weekly rewards.

| # | Territory | Description | Buff |
|---|-----------|-------------|------|
| 10 | Ashfall | Bombed-out sector. Scavengers and worse. | +10% XP |
| 11 | Deadzone | Lawless. No rules. Survival only. | +10% Rob Success |
| 12 | Freeport | Neutral ground. Betrayal here marks you for death. | +15% All Rewards |

---

## TERRITORY CONTROL

### Score Calculation

Territory score is calculated daily from member activity:

| Activity | Points |
|----------|--------|
| Chat message | 1 point |
| !play command | 10 points |
| Rob attempt | 20 points |
| Mission completed | 25 points |
| Check-in | 15 points |

### Daily Evaluation (Midnight UTC)

```javascript
async function evaluateTerritoryControl() {
    for (const territory of territories) {
        const scores = await calculateFactionScores(territory.territory_id);
        
        if (territory.is_contested) {
            // Contested: Need 2x second place to control
            const sorted = scores.sort((a, b) => b.score - a.score);
            if (sorted[0].score >= sorted[1].score * 2) {
                await setController(territory, sorted[0].faction_id);
            } else {
                await setController(territory, null); // Neutral
            }
        } else {
            // Standard: Highest score wins
            const winner = scores.reduce((a, b) => a.score > b.score ? a : b);
            if (winner.score > 0) {
                await setController(territory, winner.faction_id);
            }
        }
    }
}
```

### Control Requirements

| Territory Type | Requirement |
|----------------|-------------|
| Standard | Highest faction score |
| Contested | 2x the second-place faction's score |

---

## JOINING FACTIONS

### Requirements
- Must be Associate tier (Level 20+)
- Cannot be in another faction

### Joining
```
!faction join <faction_name>
```

### Leaving
- 7-day cooldown before joining another faction
- Lose all territory buff benefits immediately

### Switching Penalty
- Cannot earn faction rewards for 7 days after switching

---

## TERRITORY ASSIGNMENT

Players are assigned to territories by their faction leadership or automatically.

### Auto-Assignment
- New faction members assigned to territory with fewest members
- Can request reassignment via website

### Manual Assignment
- Faction officers can assign members
- Balanced distribution encouraged

---

## FACTION BUFFS

When your faction controls a territory, ALL faction members receive that territory's buff.

### Buff Stacking
- Multiple territory buffs stack additively
- Example: Control Chrome Heights (+5% XP) AND Midtown (+5% XP) = +10% XP

### Buff Application
```javascript
async function getFactionBuffs(userId) {
    const user = await getUser(userId);
    if (!user.faction_id) return [];
    
    const controlledTerritories = await db.query(`
        SELECT * FROM territories
        WHERE controlling_faction_id = $1
    `, [user.faction_id]);
    
    return controlledTerritories.rows.map(t => ({
        type: t.buff_type,
        value: t.buff_value
    }));
}
```

---

## WEEKLY REWARDS

Every Sunday at midnight UTC, factions receive rewards based on territories controlled.

### Reward Calculation

| Metric | Value |
|--------|-------|
| Base per territory | $2,000 + 200 XP |
| Contested territory bonus | 1.5x value |
| Distribution | Split among active members |

### "Active" Definition
Member must have contributed at least 100 points during the week.

### Winner Bonus
Faction with most territories receives:
- 25% bonus to all member rewards
- Faction-wide announcement
- Crate to top 3 contributors

---

## DATABASE SCHEMA

```sql
CREATE TABLE factions (
    faction_id SERIAL PRIMARY KEY,
    faction_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color_hex VARCHAR(7),
    motto VARCHAR(200),
    
    total_members INTEGER DEFAULT 0,
    territories_controlled INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE territories (
    territory_id SERIAL PRIMARY KEY,
    territory_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    controlling_faction_id INTEGER REFERENCES factions(faction_id),
    is_contested BOOLEAN DEFAULT FALSE,
    
    buff_type VARCHAR(50),
    buff_value INTEGER,
    
    last_evaluated_at TIMESTAMP,
    control_changed_at TIMESTAMP
);

CREATE TABLE territory_scores (
    score_id SERIAL PRIMARY KEY,
    territory_id INTEGER REFERENCES territories(territory_id),
    faction_id INTEGER REFERENCES factions(faction_id),
    
    score_date DATE NOT NULL,
    total_score BIGINT DEFAULT 0,
    
    messages INTEGER DEFAULT 0,
    plays INTEGER DEFAULT 0,
    robs INTEGER DEFAULT 0,
    missions INTEGER DEFAULT 0,
    checkins INTEGER DEFAULT 0,
    
    UNIQUE(territory_id, faction_id, score_date)
);

CREATE TABLE user_territory_assignments (
    assignment_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    territory_id INTEGER REFERENCES territories(territory_id),
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(user_id)
);

CREATE TABLE faction_membership_history (
    history_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    faction_id INTEGER REFERENCES factions(faction_id),
    
    joined_at TIMESTAMP,
    left_at TIMESTAMP,
    reason VARCHAR(50) -- 'joined', 'left', 'switched'
);

CREATE INDEX idx_territories_faction ON territories(controlling_faction_id);
CREATE INDEX idx_scores_date ON territory_scores(score_date);
CREATE INDEX idx_assignments_user ON user_territory_assignments(user_id);
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!factions` | All | List all factions |
| `!faction` | All | View your faction |
| `!faction join <name>` | All | Join a faction |
| `!faction leave` | All | Leave your faction |
| `!territories` | All | View territory control map |
| `!territory` | All | View your assigned territory |

### Faction Output
```
⚔️ THE VOLKOV BRATVA
"Кровь за кровь" (Blood for blood)

👥 Members: 127
🏴 Territories: 4/12
  • The Ports (Home)
  • Chrome Heights
  • Neon Mile
  • Rustlands

🎁 Active Buffs:
  +5% XP (Chrome Heights)
  +10% Business Revenue (Neon Mile)
  +10% Business Revenue (Rustlands)
  +5% Rob Success (The Ports)
```

---

## ANNOUNCEMENTS

### Territory Capture
```
⚔️ THE VOLKOV BRATVA has captured Chrome Heights!
All Bratva members now receive +5% XP!
```

### Territory Lost
```
💔 DEAD CIRCUIT lost control of Silicon Sprawl to KESSLER GROUP!
```

### Weekly Winner
```
🏆 WEEKLY FACTION VICTORY 🏆
THE VOLKOV BRATVA controlled the most territories this week!
All Bratva members receive 25% bonus rewards!

🥇 Volkov Bratva: 5 territories
🥈 Kessler Group: 4 territories
🥉 Dead Circuit: 3 territories
```

---

## STARTING STATE

At launch:

| Faction | Starting Territory |
|---------|-------------------|
| Volkov Bratva | The Ports |
| Dead Circuit | The Hollows |
| Kessler Group | Midtown |

Remaining 9 territories start **neutral** (no faction control).

---

## SCHEDULED JOBS

| Job | Schedule | Action |
|-----|----------|--------|
| Territory Evaluation | Midnight UTC daily | Calculate scores, update control |
| Weekly Rewards | Sunday Midnight UTC | Distribute faction rewards |
| Score Reset | Monday 00:01 UTC | Clear weekly contribution scores |

---

**END OF DOCUMENT**
