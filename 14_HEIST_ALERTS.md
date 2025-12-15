# 14. HEIST ALERTS SYSTEM

---

## OVERVIEW

Heist Alerts are random in-chat events during stream sessions where the first correct answer wins a crate. Events fire simultaneously on Kick and Twitch, creating cross-platform competition.

---

## EVENT TIMING

| Parameter | Value |
|-----------|-------|
| Frequency | Random 60-120 minutes |
| Minimum after session start | 15 minutes |
| Platform scope | Kick AND Twitch simultaneously |
| Discord included | NO (stream-only feature) |

### Timer Behavior
- Timer pauses if stream goes offline
- Resumes when stream returns
- Resets on session end

---

## EVENT TYPES

| Type | Difficulty | Time Limit | Distribution |
|------|------------|------------|--------------|
| Quick Grab | Easy | 45 seconds | 25% |
| Code Crack | Easy | 45 seconds | 25% |
| Trivia | Medium | 90 seconds | 17.5% |
| Word Scramble | Medium | 90 seconds | 17.5% |
| Riddle | Hard | 120 seconds | 7.5% |
| Math Hack | Hard | 120 seconds | 7.5% |

---

## EVENT DESCRIPTIONS

### Quick Grab (Easy)
First to type a specific phrase wins.

**Prompt:** `Type "!grab NEON" to claim the prize!`
**Answer:** `!grab NEON` (exact, case-insensitive)

### Code Crack (Easy)
First to type an exact code wins.

**Prompt:** `Crack the code: X7K-92M`
**Answer:** `X7K-92M` (exact, case-sensitive for letters)

### Trivia (Medium)
First to answer a game/lore question wins.

**Prompt:** `What tier do you need to be to join a faction?`
**Answer:** `Associate` (fuzzy match, case-insensitive)

### Word Scramble (Medium)
First to unscramble a word/phrase wins.

**Prompt:** `Unscramble: OVKOVL RAVTAB`
**Answer:** `VOLKOV BRATVA` (fuzzy match)

### Riddle (Hard)
First to solve a riddle wins.

**Prompt:** `I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?`
**Answer:** `A map` (fuzzy match)

### Math Hack (Hard)
First to solve arithmetic wins.

**Prompt:** `Decrypt: (144 ÷ 12) × 7 + 15 = ?`
**Answer:** `99` (exact numeric)

---

## CRATE REWARDS BY DIFFICULTY

| Difficulty | Common | Uncommon | Rare | Legendary |
|------------|--------|----------|------|-----------|
| Easy | 70% | 25% | 5% | 0% |
| Medium | 50% | 35% | 13% | 2% |
| Hard | 30% | 40% | 25% | 5% |

---

## ANSWER MATCHING

| Event Type | Matching |
|------------|----------|
| Quick Grab | Exact (case-insensitive) |
| Code Crack | Exact (case-sensitive letters) |
| Trivia | Fuzzy (case-insensitive, flexible spacing) |
| Word Scramble | Fuzzy (case-insensitive, flexible spacing) |
| Riddle | Fuzzy (case-insensitive, common typos) |
| Math Hack | Exact numeric |

### Fuzzy Match Logic
```javascript
function fuzzyMatch(input, answer) {
    // Normalize both strings
    const normalize = (s) => s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    
    const normalInput = normalize(input);
    const normalAnswer = normalize(answer);
    
    // Direct match
    if (normalInput === normalAnswer) return true;
    
    // Check if answer is contained in input
    if (normalInput.includes(normalAnswer)) return true;
    
    // Accept common variations
    // "a map" matches "map"
    // "the map" matches "map"
    const stripped = normalInput.replace(/^(a|an|the)\s+/, '');
    if (stripped === normalAnswer) return true;
    
    return false;
}
```

---

## ELIGIBILITY

| Requirement | Value |
|-------------|-------|
| Account needed | Linked Kick or Twitch |
| Minimum tier | None |
| Cooldown after winning | None |

Players can win back-to-back Heist Alerts.

---

## EVENT POOLS

### Quick Grab Phrases (30)

| Phrase | | |
|--------|---|---|
| NEON | CHROME | STATIC |
| GHOST | CIPHER | VOLTAGE |
| SHADOW | BREACH | CIRCUIT |
| LAZARUS | SYNDICATE | PROTOCOL |
| MATRIX | OVERRIDE | ACCESS |
| DECRYPT | EXECUTE | FIREWALL |
| QUANTUM | NEURAL | CORTEX |
| DARKNET | CYPHER | GRIDLOCK |
| TERMINUS | APEX | VECTOR |
| OMEGA | PRIME | ZENITH |

### Code Crack Patterns (Generated)

| Pattern | Example |
|---------|---------|
| XXX-000 | NKY-847 |
| 00-XXX-00 | 42-BRZ-91 |
| X0X0X | K7L3M |
| 000-XX | 159-QW |
| XX-0000 | ZY-2847 |

### Trivia Questions (50 Sample)

| Question | Answer |
|----------|--------|
| What tier do you need to reach to join a faction? | Associate |
| How many territories are in Lazarus City? | 12 |
| What is the name of the Russian faction? | Volkov Bratva |
| How long is the jail sentence when you get busted? | 1 hour |
| What percentage of wealth does bail cost? | 10% |
| What buff does the Juicernaut get for crate drops? | 3x / Triple |
| Which territory is Dead Circuit's home base? | The Hollows |
| What is the maximum check-in streak bonus crate tier? | Legendary |
| How many daily missions do you get? | 3 |
| What is the rob cooldown per target? | 24 hours |

### Word Scrambles (25)

| Scrambled | Answer |
|-----------|--------|
| OVKOVL RAVTAB | VOLKOV BRATVA |
| DAED TIRICUC | DEAD CIRCUIT |
| SLSEKRE PUROG | KESSLER GROUP |
| AZSALRU TYIC | LAZARUS CITY |
| NEOIGJUKRA | JUICERNAUT |
| TERIRTOYR | TERRITORY |
| VEECHITNEAM | ACHIEVEMENT |
| CALDKB TKEAMR | BLACK MARKET |
| GIKNPNI | KINGPIN |
| DEURBONSS | UNDERBOSS |

### Riddles (25)

| Riddle | Answer |
|--------|--------|
| I have cities, but no houses. Mountains, but no trees. Water, but no fish. What am I? | A map |
| The more you take, the more you leave behind. What am I? | Footsteps |
| I speak without a mouth and hear without ears. I have no body, but come alive with the wind. What am I? | An echo |
| What can travel around the world while staying in a corner? | A stamp |
| I have keys but no locks. Space but no room. You can enter but can't go inside. What am I? | A keyboard |

### Math Hack Patterns (Generated)

```javascript
function generateMathProblem() {
    const operations = [
        () => {
            const a = randInt(10, 50);
            const b = randInt(2, 12);
            return { expr: `${a} × ${b}`, answer: a * b };
        },
        () => {
            const a = randInt(50, 200);
            const b = randInt(10, 50);
            return { expr: `${a} + ${b}`, answer: a + b };
        },
        () => {
            const answer = randInt(5, 20);
            const b = randInt(2, 12);
            const a = answer * b;
            return { expr: `${a} ÷ ${b}`, answer };
        },
        () => {
            const a = randInt(10, 20);
            const b = randInt(2, 5);
            const c = randInt(10, 30);
            return { expr: `(${a} × ${b}) + ${c}`, answer: (a * b) + c };
        }
    ];
    
    return operations[randInt(0, operations.length - 1)]();
}
```

---

## NO-REPEAT LOGIC

Track last 10 events to prevent repetition:

```javascript
async function selectEvent() {
    const recentEvents = await getRecentEvents(10);
    
    // Select event type
    const eventType = weightedRandom(EVENT_DISTRIBUTION);
    
    // Get pool for this type
    const pool = EVENT_POOLS[eventType];
    
    // Filter out recently used
    const available = pool.filter(e => 
        !recentEvents.some(r => 
            r.event_type === eventType && r.content_id === e.id
        )
    );
    
    // Select random from available
    const selected = available[randInt(0, available.length - 1)];
    
    // Record usage
    await recordEventUsage(eventType, selected.id);
    
    return { type: eventType, event: selected };
}
```

---

## EVENT FLOW

```
1. Random timer triggers (60-120 min after last)
2. Check session is active
3. Select event type by distribution
4. Select specific event (no repeat of last 10)
5. Post announcement to Kick AND Twitch simultaneously
6. Start timer (45/90/120 seconds)
7. Monitor ALL messages on BOTH platforms
8. First correct answer:
   a. Stop monitoring
   b. Roll crate tier by difficulty
   c. Award crate to winner
   d. Announce winner
9. OR timer expires:
   a. Announce "Time's up!"
   b. Reveal answer
10. Record event in database
11. Reset random timer for next event
```

---

## CHAT ANNOUNCEMENTS

### Event Start
```
🚨 HEIST ALERT! 🚨
Type "!grab NEON" to claim the prize!
⏱️ 45 seconds...
```

### Winner
```
💰 HEIST COMPLETE! @Winner cracked it first and claims a Rare Crate!
Answer: !grab NEON
```

### No Winner
```
⏱️ TIME'S UP! No one cracked it this time.
Answer: !grab NEON
```

---

## DATABASE SCHEMA

```sql
CREATE TABLE heist_events (
    heist_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    
    event_type VARCHAR(20) NOT NULL,
    difficulty VARCHAR(10) NOT NULL,
    prompt TEXT NOT NULL,
    correct_answer VARCHAR(200) NOT NULL,
    
    started_at TIMESTAMP NOT NULL,
    time_limit_seconds INTEGER NOT NULL,
    ended_at TIMESTAMP,
    
    winner_user_id INTEGER REFERENCES users(user_id),
    winner_platform VARCHAR(20),
    winning_answer VARCHAR(200),
    response_time_ms INTEGER,
    
    crate_tier VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE heist_schedule (
    schedule_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    next_heist_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE heist_recent_events (
    recent_id SERIAL PRIMARY KEY,
    event_type VARCHAR(20) NOT NULL,
    content_id INTEGER NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE heist_trivia_pool (
    trivia_id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    answer VARCHAR(200) NOT NULL,
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMP
);

CREATE INDEX idx_heist_session ON heist_events(session_id);
CREATE INDEX idx_heist_schedule ON heist_schedule(session_id, next_heist_at);
CREATE INDEX idx_heist_recent ON heist_recent_events(used_at);
```

---

## COMMUNICATIONS INTEGRATION

| Channel | Events |
|---------|--------|
| Kick/Twitch Chat | All (start, winner, expired) |
| Discord Feed | Rare+ crate wins only |
| Website Notification | Winner only |
| Discord Admin Webhook | None |
| Lumia Stream | None |

---

**END OF DOCUMENT**
