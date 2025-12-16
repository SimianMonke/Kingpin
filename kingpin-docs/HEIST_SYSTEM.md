# HEIST SYSTEM - Implementation Documentation

## Overview

The Heist System provides interactive chat events during live streams where players compete to win crates by solving challenges. Events trigger randomly during active Juicernaut sessions.

**Current Implementation Status:** Complete

---

## Database Schema

### Heist Events: `heist_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Event ID |
| `session_id` | INT (FK) | Streaming session |
| `event_type` | VARCHAR(50) | Type of heist |
| `difficulty` | VARCHAR(20) | easy, medium, hard |
| `prompt` | TEXT | Challenge prompt |
| `answer` | VARCHAR(255) | Correct answer |
| `time_limit_seconds` | INT | Time to answer |
| `started_at` | TIMESTAMP | Event start |
| `ended_at` | TIMESTAMP | Event end |
| `winner_id` | INT (FK) | Winner user ID |
| `winner_response_ms` | INT | Response time |
| `crate_tier` | VARCHAR(20) | Crate awarded |

### Heist Schedule: `heist_schedule`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Schedule ID |
| `session_id` | INT (FK) | Session ID |
| `next_heist_at` | TIMESTAMP | Scheduled time |
| `last_heist_at` | TIMESTAMP | Last heist time |

### Puzzle Pools

**heist_trivia_pool:**
| Column | Type |
|--------|------|
| `id` | INT (PK) |
| `question` | TEXT |
| `answer` | VARCHAR(100) |
| `category` | VARCHAR(50) |
| `difficulty` | VARCHAR(20) |

**heist_riddle_pool:**
| Column | Type |
|--------|------|
| `id` | INT (PK) |
| `riddle` | TEXT |
| `answer` | VARCHAR(100) |

**heist_word_scramble_pool:**
| Column | Type |
|--------|------|
| `id` | INT (PK) |
| `scrambled` | VARCHAR(100) |
| `answer` | VARCHAR(100) |

**heist_quick_grab_pool:**
| Column | Type |
|--------|------|
| `id` | INT (PK) |
| `phrase` | VARCHAR(50) |

---

## Event Types

```typescript
const HEIST_EVENT_TYPES = {
  QUICK_GRAB: 'quick_grab',       // Type the phrase first
  CODE_CRACK: 'code_crack',       // Decode the pattern
  TRIVIA: 'trivia',               // Answer trivia question
  WORD_SCRAMBLE: 'word_scramble', // Unscramble the word
  RIDDLE: 'riddle',               // Solve the riddle
  MATH_HACK: 'math_hack',         // Solve math problem
}
```

---

## Heist Configuration

### Event Type Settings

```typescript
const HEIST_CONFIG = {
  MIN_DELAY_MINUTES: 60,        // Min 60 min between heists
  MAX_DELAY_MINUTES: 120,       // Max 120 min between heists
  MIN_AFTER_SESSION_START: 15,  // Wait 15 min after stream starts
  RECENT_EVENTS_TRACK: 10,      // Track last 10 to prevent repeats

  EVENT_TYPES: {
    quick_grab: { difficulty: 'easy', time: 45, weight: 0.25 },
    code_crack: { difficulty: 'easy', time: 45, weight: 0.25 },
    trivia: { difficulty: 'medium', time: 90, weight: 0.175 },
    word_scramble: { difficulty: 'medium', time: 90, weight: 0.175 },
    riddle: { difficulty: 'hard', time: 120, weight: 0.075 },
    math_hack: { difficulty: 'hard', time: 120, weight: 0.075 },
  },
}
```

### Crate Chances by Difficulty

```typescript
const CRATE_CHANCES_BY_DIFFICULTY = {
  easy: { common: 0.70, uncommon: 0.25, rare: 0.05, legendary: 0 },
  medium: { common: 0.50, uncommon: 0.35, rare: 0.13, legendary: 0.02 },
  hard: { common: 0.30, uncommon: 0.40, rare: 0.25, legendary: 0.05 },
}
```

---

## Puzzle Content

### Quick Grab Phrases (30 total)

```typescript
const HEIST_QUICK_GRAB_PHRASES = [
  'NEON', 'CHROME', 'STATIC', 'GHOST', 'CIPHER', 'VOLTAGE',
  'SHADOW', 'BREACH', 'CIRCUIT', 'LAZARUS', 'SYNDICATE', 'PROTOCOL',
  'MATRIX', 'OVERRIDE', 'ACCESS', 'DECRYPT', 'EXECUTE', 'FIREWALL',
  'QUANTUM', 'NEURAL', 'CORTEX', 'DARKNET', 'CYPHER', 'GRIDLOCK',
  'TERMINUS', 'APEX', 'VECTOR', 'OMEGA', 'PRIME', 'ZENITH',
]
```

### Code Crack Patterns

```typescript
const HEIST_CODE_PATTERNS = [
  { pattern: 'XXX-000', description: '3 letters, dash, 3 numbers' },
  { pattern: '00-XXX-00', description: '2 numbers, 3 letters, 2 numbers' },
  { pattern: 'X0X0X', description: 'Alternating letter-number' },
  { pattern: '000-XX', description: '3 numbers, dash, 2 letters' },
  { pattern: 'XX-0000', description: '2 letters, dash, 4 numbers' },
]
```

### Word Scrambles (25 total)

```typescript
const HEIST_WORD_SCRAMBLES = [
  { scrambled: 'OVKOVL RAVTAB', answer: 'VOLKOV BRATVA' },
  { scrambled: 'DAED TIRICUC', answer: 'DEAD CIRCUIT' },
  { scrambled: 'SLSEKRE PUROG', answer: 'KESSLER GROUP' },
  { scrambled: 'AZSALRU TYIC', answer: 'LAZARUS CITY' },
  { scrambled: 'NEOIGJUKRA', answer: 'JUICERNAUT' },
  // ... 20 more
]
```

### Riddles (25 total)

```typescript
const HEIST_RIDDLES = [
  { riddle: 'I have cities, but no houses...', answer: 'map' },
  { riddle: 'The more you take, the more you leave behind.', answer: 'footsteps' },
  { riddle: 'What has keys but no locks?', answer: 'keyboard' },
  // ... 22 more
]
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/heist.service.ts`

### Public Methods

```typescript
export const HeistService = {
  /**
   * Check if heist should trigger
   */
  async checkAndTriggerHeist(sessionId: number): Promise<HeistEvent | null>

  /**
   * Start a specific heist event
   */
  async startHeist(sessionId: number, eventType: HeistEventType): Promise<HeistEvent>

  /**
   * Process an answer attempt
   */
  async processAnswer(
    heistId: number,
    userId: number,
    answer: string,
    platform: Platform
  ): Promise<AnswerResult>

  /**
   * End heist (timeout or winner)
   */
  async endHeist(heistId: number): Promise<void>

  /**
   * Get active heist for session
   */
  async getActiveHeist(sessionId: number): Promise<HeistEvent | null>

  /**
   * Get heist history
   */
  async getHistory(sessionId: number, limit?: number): Promise<HeistEvent[]>

  /**
   * Schedule next heist
   */
  async scheduleNextHeist(sessionId: number): Promise<Date>

  /**
   * Generate puzzle for event type
   */
  async generatePuzzle(eventType: HeistEventType): Promise<Puzzle>
}
```

### Check and Trigger Heist

```typescript
async function checkAndTriggerHeist(sessionId: number): Promise<HeistEvent | null> {
  const schedule = await prisma.heist_schedule.findFirst({
    where: { session_id: sessionId },
  })

  if (!schedule || new Date() < schedule.next_heist_at) {
    return null  // Not time yet
  }

  // Select random event type (weighted)
  const eventType = selectWeightedEventType()

  // Generate puzzle
  const puzzle = await generatePuzzle(eventType)

  // Create heist event
  const heist = await prisma.heist_events.create({
    data: {
      session_id: sessionId,
      event_type: eventType,
      difficulty: HEIST_CONFIG.EVENT_TYPES[eventType].difficulty,
      prompt: puzzle.prompt,
      answer: puzzle.answer.toUpperCase(),
      time_limit_seconds: HEIST_CONFIG.EVENT_TYPES[eventType].time,
      started_at: new Date(),
    },
  })

  // Schedule next heist
  await scheduleNextHeist(sessionId)

  // Post to chat/Discord
  await announceHeist(heist)

  // Trigger Lumia effect
  await LumiaService.triggerHeistAlert(eventType)

  // Set timeout to end heist
  setTimeout(async () => {
    await endHeist(heist.id)
  }, heist.time_limit_seconds * 1000)

  return heist
}
```

### Process Answer

```typescript
async function processAnswer(
  heistId: number,
  userId: number,
  answer: string,
  platform: Platform
): Promise<AnswerResult> {
  const heist = await prisma.heist_events.findUnique({
    where: { id: heistId },
  })

  if (!heist || heist.ended_at || heist.winner_id) {
    return { correct: false, reason: 'Heist already ended' }
  }

  // Check answer
  const isCorrect = answer.toUpperCase().trim() === heist.answer

  if (!isCorrect) {
    return { correct: false, reason: 'Wrong answer' }
  }

  // Calculate response time
  const responseMs = Date.now() - heist.started_at.getTime()

  // Roll crate tier based on difficulty
  const crateTier = rollCrateTier(heist.difficulty)

  // Update heist with winner
  await prisma.heist_events.update({
    where: { id: heistId },
    data: {
      winner_id: userId,
      winner_response_ms: responseMs,
      crate_tier: crateTier,
      ended_at: new Date(),
    },
  })

  // Award crate
  await CrateService.awardCrate(userId, crateTier, 'heist')

  // Send notification
  await NotificationService.create(userId, 'heist_won', {
    message: `You won the heist! Received a ${crateTier} crate!`,
  })

  // Announce winner
  await announceWinner(heist, userId, responseMs, crateTier)

  return {
    correct: true,
    crateTier,
    responseMs,
  }
}
```

### Generate Puzzle

```typescript
async function generatePuzzle(eventType: HeistEventType): Promise<Puzzle> {
  switch (eventType) {
    case 'quick_grab':
      const phrase = HEIST_QUICK_GRAB_PHRASES[
        Math.floor(Math.random() * HEIST_QUICK_GRAB_PHRASES.length)
      ]
      return {
        prompt: `🚨 QUICK GRAB! First to type: ${phrase}`,
        answer: phrase,
      }

    case 'code_crack':
      const code = generateRandomCode()
      return {
        prompt: `🔐 CRACK THE CODE: ${obfuscateCode(code)}`,
        answer: code,
      }

    case 'trivia':
      const trivia = await getRandomTrivia()
      return {
        prompt: `📚 TRIVIA: ${trivia.question}`,
        answer: trivia.answer,
      }

    case 'word_scramble':
      const scramble = HEIST_WORD_SCRAMBLES[
        Math.floor(Math.random() * HEIST_WORD_SCRAMBLES.length)
      ]
      return {
        prompt: `🔀 UNSCRAMBLE: ${scramble.scrambled}`,
        answer: scramble.answer,
      }

    case 'riddle':
      const riddle = HEIST_RIDDLES[
        Math.floor(Math.random() * HEIST_RIDDLES.length)
      ]
      return {
        prompt: `🧩 RIDDLE: ${riddle.riddle}`,
        answer: riddle.answer,
      }

    case 'math_hack':
      const math = generateMathProblem()
      return {
        prompt: `🔢 MATH HACK: ${math.question}`,
        answer: math.answer.toString(),
      }
  }
}
```

---

## API Endpoints

### GET /api/heist
Get current active heist.

**Response:**
```json
{
  "success": true,
  "data": {
    "active": true,
    "heist": {
      "id": 42,
      "event_type": "trivia",
      "difficulty": "medium",
      "prompt": "What is the capital of France?",
      "time_limit": 90,
      "time_remaining": 45,
      "started_at": "2024-01-15T20:30:00Z"
    }
  }
}
```

### POST /api/heist
Submit answer to active heist.

**Request:**
```json
{
  "answer": "PARIS"
}
```

### GET /api/heist/history
Get heist history.

### POST /api/heist/admin
Admin controls (start heist manually).

---

## Cron Job

**File:** `web/src/app/api/cron/heist-check/route.ts`

```typescript
// Runs every minute during active session
async function checkHeists() {
  const session = await JuicernautService.getActiveSession()
  if (!session) return

  // Check if enough time has passed since session start
  const sessionAge = Date.now() - session.started_at.getTime()
  if (sessionAge < HEIST_CONFIG.MIN_AFTER_SESSION_START * 60 * 1000) {
    return
  }

  await HeistService.checkAndTriggerHeist(session.id)
}
```

---

## System Interdependencies

### Depends On
- **Juicernaut System:** Active session check
- **Crate System:** Crate rewards
- **User System:** Winner lookup
- **Notification System:** Win notifications
- **Discord System:** Announcements
- **Lumia System:** Alert effects

### Depended On By
- None (terminal system)

---

## Configuration & Constants

```typescript
const HEIST_CONFIG = {
  MIN_DELAY_MINUTES: 60,
  MAX_DELAY_MINUTES: 120,
  MIN_AFTER_SESSION_START: 15,
  RECENT_EVENTS_TRACK: 10,
  EVENT_TYPES: {
    quick_grab: { difficulty: 'easy', time: 45, weight: 0.25 },
    code_crack: { difficulty: 'easy', time: 45, weight: 0.25 },
    trivia: { difficulty: 'medium', time: 90, weight: 0.175 },
    word_scramble: { difficulty: 'medium', time: 90, weight: 0.175 },
    riddle: { difficulty: 'hard', time: 120, weight: 0.075 },
    math_hack: { difficulty: 'hard', time: 120, weight: 0.075 },
  },
}

const CRATE_CHANCES_BY_DIFFICULTY = {
  easy: { common: 0.70, uncommon: 0.25, rare: 0.05, legendary: 0 },
  medium: { common: 0.50, uncommon: 0.35, rare: 0.13, legendary: 0.02 },
  hard: { common: 0.30, uncommon: 0.40, rare: 0.25, legendary: 0.05 },
}
```

---

## Known Limitations & TODOs

### Completed Features
- 6 event types with varying difficulty
- Session-based triggering
- Random scheduling (60-120 min)
- Response time tracking
- Difficulty-based crate rewards
- Duplicate prevention
- Discord/Lumia integration

### Technical Notes
- Heists only trigger during active Juicernaut sessions
- 15-minute delay after stream starts
- Answers case-insensitive
- Tracks last 10 events to prevent repeats
- Auto-ends on timeout if no winner

---

**File Location:** `web/src/lib/services/heist.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (HEIST_CONFIG, puzzles)
- `web/src/app/api/heist/route.ts`
- `web/src/app/api/cron/heist-check/route.ts`
