# FACTION SYSTEM - Implementation Documentation

## Overview

The Faction System allows players to join crime syndicates that compete for territory control. Territories provide buffs to faction members, and control is determined weekly based on member activity.

**Current Implementation Status:** Complete

---

## Database Schema

### Factions: `factions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Faction ID |
| `name` | VARCHAR(100) | Faction name |
| `description` | TEXT | Faction description |
| `color_hex` | VARCHAR(7) | Brand color |
| `motto` | VARCHAR(255) | Faction motto |
| `icon_url` | VARCHAR(255) | Faction icon |
| `created_at` | TIMESTAMP | Creation time |
| `is_active` | BOOLEAN | Whether active |

### Territories: `territories`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Territory ID |
| `name` | VARCHAR(100) | Territory name |
| `description` | TEXT | Territory description |
| `controlling_faction_id` | INT (FK) | Current controller |
| `is_contested` | BOOLEAN | Whether being contested |
| `buff_type` | VARCHAR(50) | Buff provided |
| `buff_value` | DECIMAL(5,2) | Buff multiplier |
| `last_evaluation` | TIMESTAMP | Last weekly evaluation |

### User Faction Data (in users table)

| Column | Type | Description |
|--------|------|-------------|
| `faction_id` | INT (FK) | Current faction |
| `joined_faction_at` | TIMESTAMP | Join date |
| `faction_cooldown_until` | TIMESTAMP | Switch cooldown |
| `faction_reward_cooldown_until` | TIMESTAMP | Reward eligibility |
| `assigned_territory_id` | INT | Territory for scoring |

---

## Faction Configuration

### Join Requirements

```typescript
const FACTION_CONFIG = {
  MIN_LEVEL_TO_JOIN: 20,        // Associate tier minimum
  SWITCH_COOLDOWN_DAYS: 7,      // 7 days between switches
  REWARD_COOLDOWN_DAYS: 7,      // Can't earn rewards for 7 days after joining
}
```

### Territory Score Points

```typescript
const TERRITORY_SCORE_POINTS = {
  MESSAGE: 1,        // Per chat message
  PLAY: 10,          // Per !play
  ROB: 20,           // Per robbery attempt
  MISSION: 25,       // Per mission completed
  CHECKIN: 15,       // Per check-in
}
```

### Territory Rewards

```typescript
const TERRITORY_REWARDS = {
  BASE_WEALTH_PER_TERRITORY: 2000,
  BASE_XP_PER_TERRITORY: 200,
  CONTESTED_MULTIPLIER: 1.5,    // 50% bonus for contested territories
  WINNER_BONUS: 0.25,           // 25% bonus to winning faction
  MIN_CONTRIBUTION_FOR_REWARD: 100,  // Minimum score to earn rewards
}
```

---

## Territory Buffs

| Territory | Buff Type | Buff Value | Description |
|-----------|-----------|------------|-------------|
| Neon District | xp_bonus | +10% | Bonus XP from all sources |
| Industrial Zone | business_revenue | +15% | Bonus business revenue |
| The Ports | rob_success | +5% | Better robbery success rate |
| Downtown | crate_chance | +50% | Better crate drop chance |
| The Hollows | defense | +8% | Better robbery defense |

---

## Service Layer Implementation

**File:** `web/src/lib/services/faction.service.ts`

### Public Methods

```typescript
export const FactionService = {
  /**
   * Get all factions
   */
  async getFactions(): Promise<Faction[]>

  /**
   * Get faction details
   */
  async getFaction(factionId: number): Promise<Faction | null>

  /**
   * Get user's faction
   */
  async getUserFaction(userId: number): Promise<Faction | null>

  /**
   * Join a faction
   */
  async joinFaction(userId: number, factionId: number): Promise<void>

  /**
   * Leave current faction
   */
  async leaveFaction(userId: number): Promise<void>

  /**
   * Get all territories
   */
  async getTerritories(): Promise<Territory[]>

  /**
   * Add territory score for user's faction
   */
  async addTerritoryScore(userId: number, action: ScoreAction): Promise<void>

  /**
   * Evaluate territory control (weekly job)
   */
  async evaluateTerritories(): Promise<EvaluationResult>

  /**
   * Get faction buffs for user
   */
  async getFactionBuffs(userId: number): Promise<FactionBuff[]>

  /**
   * Distribute territory rewards
   */
  async distributeRewards(): Promise<void>
}
```

### Join Faction

```typescript
async function joinFaction(userId: number, factionId: number): Promise<void> {
  const user = await UserService.findById(userId)

  // Check level requirement
  if (user.level < FACTION_CONFIG.MIN_LEVEL_TO_JOIN) {
    throw new Error(`Must be level ${FACTION_CONFIG.MIN_LEVEL_TO_JOIN}+ to join a faction`)
  }

  // Check cooldown
  if (user.faction_cooldown_until && user.faction_cooldown_until > new Date()) {
    const remaining = Math.ceil((user.faction_cooldown_until.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    throw new Error(`Faction switch on cooldown. ${remaining} days remaining.`)
  }

  // Check faction exists
  const faction = await getFaction(factionId)
  if (!faction || !faction.is_active) {
    throw new Error('Faction not found')
  }

  // Set cooldowns
  const switchCooldown = new Date()
  switchCooldown.setDate(switchCooldown.getDate() + FACTION_CONFIG.SWITCH_COOLDOWN_DAYS)

  const rewardCooldown = new Date()
  rewardCooldown.setDate(rewardCooldown.getDate() + FACTION_CONFIG.REWARD_COOLDOWN_DAYS)

  // Assign to random territory
  const territories = await prisma.territories.findMany({
    where: { controlling_faction_id: factionId },
  })
  const assignedTerritory = territories[Math.floor(Math.random() * territories.length)]

  await prisma.users.update({
    where: { id: userId },
    data: {
      faction_id: factionId,
      joined_faction_at: new Date(),
      faction_cooldown_until: switchCooldown,
      faction_reward_cooldown_until: rewardCooldown,
      assigned_territory_id: assignedTerritory?.id,
    },
  })

  // Send notification
  await NotificationService.create(userId, 'faction_joined', {
    message: `Welcome to ${faction.name}!`,
  })
}
```

### Add Territory Score

```typescript
async function addTerritoryScore(userId: number, action: ScoreAction): Promise<void> {
  const user = await UserService.findById(userId)

  if (!user.faction_id || !user.assigned_territory_id) {
    return  // User not in faction or not assigned
  }

  const points = TERRITORY_SCORE_POINTS[action.toUpperCase()]
  if (!points) return

  // Update territory score in leaderboard snapshot
  await LeaderboardService.updateTerritoryScore(
    user.faction_id,
    user.assigned_territory_id,
    points
  )
}
```

### Weekly Territory Evaluation

```typescript
async function evaluateTerritories(): Promise<EvaluationResult> {
  const territories = await prisma.territories.findMany()
  const results: TerritoryResult[] = []

  for (const territory of territories) {
    // Get scores per faction for this territory
    const factionScores = await prisma.$queryRaw`
      SELECT
        u.faction_id,
        SUM(ls.territory_score) as total_score
      FROM leaderboard_snapshots ls
      JOIN users u ON u.id = ls.user_id
      WHERE u.assigned_territory_id = ${territory.id}
        AND ls.period_type = 'weekly'
        AND ls.period_start >= ${getWeekStart()}
      GROUP BY u.faction_id
      ORDER BY total_score DESC
    `

    if (factionScores.length === 0) continue

    const topScore = factionScores[0]
    const secondScore = factionScores[1]

    // Check for contested status
    const isContested = secondScore &&
      secondScore.total_score >= topScore.total_score * 0.8

    // Update territory control
    const previousController = territory.controlling_faction_id

    await prisma.territories.update({
      where: { id: territory.id },
      data: {
        controlling_faction_id: topScore.faction_id,
        is_contested: isContested,
        last_evaluation: new Date(),
      },
    })

    // Notify if control changed
    if (previousController !== topScore.faction_id) {
      await notifyTerritoryChange(territory, previousController, topScore.faction_id)
    }

    results.push({
      territory_id: territory.id,
      new_controller: topScore.faction_id,
      is_contested: isContested,
    })
  }

  // Distribute rewards
  await distributeRewards()

  return { territories: results }
}
```

### Get Faction Buffs

```typescript
async function getFactionBuffs(userId: number): Promise<FactionBuff[]> {
  const user = await UserService.findById(userId)

  if (!user.faction_id) {
    return []
  }

  // Get territories controlled by user's faction
  const territories = await prisma.territories.findMany({
    where: { controlling_faction_id: user.faction_id },
  })

  return territories.map(t => ({
    type: t.buff_type,
    value: Number(t.buff_value),
    territoryName: t.name,
  }))
}
```

---

## Buff Application

### In Play Service

```typescript
async function executePlay(userId: number) {
  // ... base calculation

  // Apply faction buffs
  const buffs = await FactionService.getFactionBuffs(userId)

  for (const buff of buffs) {
    switch (buff.type) {
      case 'xp_bonus':
        xp = Math.floor(xp * (1 + buff.value))
        break
      case 'crate_chance':
        crateDropChance = crateDropChance * (1 + buff.value)
        break
    }
  }
}
```

### In Rob Service

```typescript
async function calculateRobSuccessRate(attackerId, defenderId) {
  // ... base calculation

  const attackerBuffs = await FactionService.getFactionBuffs(attackerId)
  const defenderBuffs = await FactionService.getFactionBuffs(defenderId)

  // Apply rob_success buff
  const robBuff = attackerBuffs.find(b => b.type === 'rob_success')
  if (robBuff) {
    rate += robBuff.value
  }

  // Apply defense buff
  const defenseBuff = defenderBuffs.find(b => b.type === 'defense')
  if (defenseBuff) {
    rate -= defenseBuff.value
  }
}
```

---

## API Endpoints

### GET /api/factions
Get all factions.

### GET /api/factions/my-faction
Get user's current faction.

### POST /api/factions
Join a faction.

### DELETE /api/factions/leave
Leave current faction.

### GET /api/factions/territories
Get all territories.

---

## Scheduled Jobs

### Weekly Evaluation (Cron: Sunday 23:59 UTC)

```typescript
async function weeklyFactionEvaluation() {
  await FactionService.evaluateTerritories()
  await FactionService.distributeRewards()
}
```

---

## System Interdependencies

### Depends On
- **User System:** Level check, faction assignment
- **Leaderboard System:** Territory score tracking
- **Notification System:** Join/leave/change notifications
- **Discord System:** Territory change announcements

### Depended On By
- **Play System:** XP/crate buffs, territory scoring
- **Rob System:** Success/defense buffs, territory scoring
- **Check-in System:** Territory scoring
- **Chat System:** Territory scoring
- **Mission System:** Territory scoring

---

## Configuration & Constants

```typescript
const FACTION_CONFIG = {
  MIN_LEVEL_TO_JOIN: 20,
  SWITCH_COOLDOWN_DAYS: 7,
  REWARD_COOLDOWN_DAYS: 7,
}

const TERRITORY_SCORE_POINTS = {
  MESSAGE: 1,
  PLAY: 10,
  ROB: 20,
  MISSION: 25,
  CHECKIN: 15,
}

const TERRITORY_REWARDS = {
  BASE_WEALTH_PER_TERRITORY: 2000,
  BASE_XP_PER_TERRITORY: 200,
  CONTESTED_MULTIPLIER: 1.5,
  WINNER_BONUS: 0.25,
  MIN_CONTRIBUTION_FOR_REWARD: 100,
}
```

---

## Known Limitations & TODOs

### Completed Features
- 5 factions (Volkov Bratva, Dead Circuit, Kessler Group, Las Serpientes, Iron Consortium)
- 5 territories with unique buffs
- Weekly territory evaluation
- Contest mechanics (80% threshold)
- Faction cooldowns
- Reward distribution

### Technical Notes
- Level 20 (Associate) required to join
- 7-day cooldown between faction switches
- 7-day wait before earning rewards after joining
- Players assigned to random territory on join
- Scores tracked in leaderboard_snapshots

---

**File Location:** `web/src/lib/services/faction.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (FACTION_CONFIG)
- `web/src/app/api/factions/route.ts`
- `web/src/app/api/cron/weekly/route.ts`
