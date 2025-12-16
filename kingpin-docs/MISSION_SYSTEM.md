# MISSION SYSTEM - Implementation Documentation

## Overview

The Mission System provides daily and weekly objectives for players to complete, offering wealth, XP, and crate rewards. Missions are tier-scaled and reset on a schedule.

**Current Implementation Status:** Complete

---

## Database Schema

### Mission Templates: `mission_templates`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Template ID |
| `template_key` | VARCHAR(100) | Unique identifier |
| `name` | VARCHAR(100) | Mission name |
| `description` | TEXT | Mission description |
| `mission_type` | VARCHAR(20) | daily or weekly |
| `difficulty` | VARCHAR(20) | easy, medium, hard |
| `category` | VARCHAR(50) | Mission category |
| `objective_type` | VARCHAR(50) | What to track |
| `base_objective_value` | INT | Base target value |
| `base_reward_wealth` | INT | Base wealth reward |
| `base_reward_xp` | INT | Base XP reward |
| `is_active` | BOOLEAN | Whether template is active |
| `created_at` | TIMESTAMP | Creation time |

### User Missions: `user_missions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Mission instance ID |
| `user_id` | INT (FK) | User ID |
| `template_id` | INT (FK) | Template ID |
| `mission_type` | VARCHAR(20) | daily or weekly |
| `objective_value` | INT | Tier-scaled target |
| `current_progress` | INT | Current progress |
| `reward_wealth` | INT | Tier-scaled wealth reward |
| `reward_xp` | INT | Tier-scaled XP reward |
| `is_completed` | BOOLEAN | Whether completed |
| `completed_at` | TIMESTAMP | Completion time |
| `expires_at` | TIMESTAMP | Mission expiration |
| `assigned_at` | TIMESTAMP | When assigned |

### Mission Completions: `mission_completions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Completion ID |
| `user_id` | INT (FK) | User ID |
| `completion_type` | VARCHAR(20) | daily or weekly |
| `missions_completed` | INT | Count completed |
| `bonus_claimed` | BOOLEAN | Whether bonus claimed |
| `completed_at` | DATE | Completion date |

---

## Mission Configuration

### Daily vs Weekly

```typescript
const MISSION_CONFIG = {
  DAILY_COUNT: 3,                   // 3 daily missions
  WEEKLY_COUNT: 2,                  // 2 weekly missions
  DAILY_BONUS_MULTIPLIER: 1.5,      // 50% bonus for completing all dailies
  WEEKLY_BONUS_MULTIPLIER: 2.0,     // 100% bonus for completing all weeklies
  DAILY_CRATE_REWARD: 'uncommon',   // Crate for completing all dailies
  WEEKLY_CRATE_REWARD: 'rare',      // Crate for completing all weeklies
}
```

### Difficulty Distribution

```typescript
const MISSION_DIFFICULTY_WEIGHTS = {
  daily: {
    easy: 0.50,    // 50% chance
    medium: 0.35,  // 35% chance
    hard: 0.15,    // 15% chance
  },
  weekly: {
    easy: 0.40,
    medium: 0.40,
    hard: 0.20,
  },
}
```

### Base Rewards by Difficulty

```typescript
const MISSION_REWARDS = {
  daily: {
    easy: { wealth: 500, xp: 50 },
    medium: { wealth: 1000, xp: 100 },
    hard: { wealth: 2000, xp: 200 },
  },
  weekly: {
    easy: { wealth: 3000, xp: 300 },
    medium: { wealth: 6000, xp: 600 },
    hard: { wealth: 12000, xp: 1200 },
  },
}
```

### Completion Bonuses

```typescript
const MISSION_COMPLETION_BONUS = {
  daily: { wealth: 500, xp: 50, crate: null },
  weekly: { wealth: 2000, xp: 200, crate: 'common' },
}
```

---

## Objective Types

```typescript
const MISSION_OBJECTIVE_TYPES = {
  PLAY_COUNT: 'play_count',              // Use !play X times
  ROB_ATTEMPTS: 'rob_attempts',          // Attempt X robberies
  ROB_SUCCESSES: 'rob_successes',        // Successfully rob X times
  ROB_DEFENSES: 'rob_defenses',          // Defend X robberies
  CHECKIN_TODAY: 'checkin_today',        // Check in today
  CHECKIN_STREAK: 'checkin_streak',      // Reach X day streak
  CHECKIN_WEEK: 'checkin_week',          // Check in X days this week
  PROFILE_VIEWED: 'profile_viewed',      // View your profile
  LEADERBOARD_VIEWED: 'leaderboard_viewed', // View leaderboards
  BLACK_MARKET_VIEWED: 'black_market_viewed', // Visit black market
  ITEM_PURCHASED: 'item_purchased',      // Purchase X items
  WEALTH_EARNED: 'wealth_earned',        // Earn $X
  MESSAGES_SENT: 'messages_sent',        // Send X chat messages
}
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/mission.service.ts`

### Public Methods

```typescript
export const MissionService = {
  /**
   * Get user's active missions
   */
  async getMissions(userId: number): Promise<Mission[]>

  /**
   * Assign daily missions to user
   */
  async assignDailyMissions(userId: number): Promise<Mission[]>

  /**
   * Assign weekly missions to user
   */
  async assignWeeklyMissions(userId: number): Promise<Mission[]>

  /**
   * Update mission progress
   */
  async updateProgress(
    userId: number,
    objectiveType: string,
    amount: number
  ): Promise<MissionCompletion[]>

  /**
   * Set progress to specific value
   */
  async setProgress(
    userId: number,
    objectiveType: string,
    value: number
  ): Promise<MissionCompletion[]>

  /**
   * Claim mission rewards
   */
  async claimRewards(userId: number, missionId: number): Promise<ClaimResult>

  /**
   * Claim completion bonus
   */
  async claimCompletionBonus(
    userId: number,
    missionType: 'daily' | 'weekly'
  ): Promise<BonusResult>

  /**
   * Check and expire old missions
   */
  async expireMissions(): Promise<number>
}
```

### Mission Assignment

```typescript
async function assignDailyMissions(userId: number): Promise<Mission[]> {
  const user = await UserService.findById(userId)
  const tier = user.status_tier as Tier
  const tierMultiplier = TIER_MULTIPLIERS[tier]

  // Get available templates
  const templates = await prisma.mission_templates.findMany({
    where: {
      mission_type: 'daily',
      is_active: true,
    },
  })

  // Select 3 missions with weighted difficulty
  const selectedTemplates = selectMissionsWithDifficulty(templates, 3, 'daily')

  const missions: Mission[] = []
  for (const template of selectedTemplates) {
    // Scale objective and rewards by tier
    const scaledObjective = Math.ceil(template.base_objective_value * tierMultiplier)
    const scaledWealth = Math.floor(template.base_reward_wealth * tierMultiplier)
    const scaledXp = Math.floor(template.base_reward_xp * tierMultiplier)

    const mission = await prisma.user_missions.create({
      data: {
        user_id: userId,
        template_id: template.id,
        mission_type: 'daily',
        objective_value: scaledObjective,
        reward_wealth: scaledWealth,
        reward_xp: scaledXp,
        current_progress: 0,
        is_completed: false,
        expires_at: getDailyExpiry(),  // Midnight UTC
        assigned_at: new Date(),
      },
    })

    missions.push(mission)
  }

  return missions
}
```

### Progress Update

```typescript
async function updateProgress(
  userId: number,
  objectiveType: string,
  amount: number
): Promise<MissionCompletion[]> {
  // Get active missions with matching objective type
  const missions = await prisma.user_missions.findMany({
    where: {
      user_id: userId,
      is_completed: false,
      expires_at: { gt: new Date() },
    },
    include: {
      mission_templates: true,
    },
  })

  const completions: MissionCompletion[] = []

  for (const mission of missions) {
    if (mission.mission_templates.objective_type !== objectiveType) {
      continue
    }

    // Update progress
    const newProgress = mission.current_progress + amount
    const isCompleted = newProgress >= mission.objective_value

    await prisma.user_missions.update({
      where: { id: mission.id },
      data: {
        current_progress: newProgress,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date() : null,
      },
    })

    if (isCompleted) {
      // Award rewards
      await UserService.addWealth(userId, mission.reward_wealth)
      await UserService.addXp(userId, mission.reward_xp)

      completions.push({
        mission_id: mission.id,
        wealth: mission.reward_wealth,
        xp: mission.reward_xp,
      })

      // Check for completion bonus
      await checkCompletionBonus(userId, mission.mission_type)
    }
  }

  return completions
}
```

### Completion Bonus Check

```typescript
async function checkCompletionBonus(
  userId: number,
  missionType: 'daily' | 'weekly'
): Promise<BonusResult | null> {
  const missions = await prisma.user_missions.findMany({
    where: {
      user_id: userId,
      mission_type: missionType,
      expires_at: { gt: new Date() },
    },
  })

  const allCompleted = missions.every(m => m.is_completed)
  const count = missionType === 'daily' ? MISSION_CONFIG.DAILY_COUNT : MISSION_CONFIG.WEEKLY_COUNT

  if (!allCompleted || missions.length < count) {
    return null
  }

  // Check if bonus already claimed today/this week
  const existingCompletion = await prisma.mission_completions.findFirst({
    where: {
      user_id: userId,
      completion_type: missionType,
      completed_at: getPeriodStart(missionType),
    },
  })

  if (existingCompletion?.bonus_claimed) {
    return null
  }

  // Award bonus
  const bonus = MISSION_COMPLETION_BONUS[missionType]
  await UserService.addWealth(userId, bonus.wealth)
  await UserService.addXp(userId, bonus.xp)

  if (bonus.crate) {
    await CrateService.awardCrate(userId, bonus.crate, 'mission')
  }

  // Record completion
  await prisma.mission_completions.upsert({
    where: { ... },
    update: { bonus_claimed: true },
    create: { ... },
  })

  // Notify user
  await NotificationService.create(userId, 'mission_complete', {
    message: `All ${missionType} missions complete! Bonus: $${bonus.wealth}, ${bonus.xp} XP${bonus.crate ? `, ${bonus.crate} crate` : ''}`,
  })

  return {
    wealth: bonus.wealth,
    xp: bonus.xp,
    crate: bonus.crate,
  }
}
```

---

## API Endpoints

### GET /api/missions
Get user's active missions.

**Response:**
```json
{
  "success": true,
  "data": {
    "daily": [
      {
        "id": 1,
        "name": "Street Hustler",
        "description": "Use !play 5 times",
        "objective_type": "play_count",
        "objective_value": 5,
        "current_progress": 3,
        "reward_wealth": 650,
        "reward_xp": 65,
        "is_completed": false,
        "expires_at": "2024-01-16T00:00:00Z"
      }
    ],
    "weekly": [ ... ],
    "dailyBonus": { "available": false, "completedCount": 1 },
    "weeklyBonus": { "available": false, "completedCount": 0 }
  }
}
```

### POST /api/missions/claim
Claim mission or bonus rewards.

---

## Scheduled Jobs

### Daily Reset (Cron: 00:00 UTC)

```typescript
async function resetDailyMissions() {
  // Expire old daily missions
  await prisma.user_missions.updateMany({
    where: {
      mission_type: 'daily',
      expires_at: { lt: new Date() },
    },
    data: { expired: true },
  })

  // Assign new missions to active users
  // (Missions are assigned on-demand when user checks)
}
```

### Weekly Reset (Cron: Monday 00:00 UTC)

```typescript
async function resetWeeklyMissions() {
  await prisma.user_missions.updateMany({
    where: {
      mission_type: 'weekly',
      expires_at: { lt: new Date() },
    },
    data: { expired: true },
  })
}
```

---

## System Interdependencies

### Depends On
- **User System:** Wealth/XP rewards, tier lookup
- **Crate System:** Bonus crate rewards
- **Notification System:** Completion notifications

### Depended On By (Progress Updates From)
- **Play System:** play_count, wealth_earned
- **Rob System:** rob_attempts, rob_successes
- **Check-in System:** checkin_today, checkin_streak
- **Chat System:** messages_sent

---

## Configuration & Constants

```typescript
const MISSION_CONFIG = {
  DAILY_COUNT: 3,
  WEEKLY_COUNT: 2,
  DAILY_BONUS_MULTIPLIER: 1.5,
  WEEKLY_BONUS_MULTIPLIER: 2.0,
  DAILY_CRATE_REWARD: 'uncommon',
  WEEKLY_CRATE_REWARD: 'rare',
}

const MISSION_REWARDS = {
  daily: {
    easy: { wealth: 500, xp: 50 },
    medium: { wealth: 1000, xp: 100 },
    hard: { wealth: 2000, xp: 200 },
  },
  weekly: {
    easy: { wealth: 3000, xp: 300 },
    medium: { wealth: 6000, xp: 600 },
    hard: { wealth: 12000, xp: 1200 },
  },
}

const MISSION_COMPLETION_BONUS = {
  daily: { wealth: 500, xp: 50, crate: null },
  weekly: { wealth: 2000, xp: 200, crate: 'common' },
}
```

---

## Known Limitations & TODOs

### Completed Features
- Daily/weekly mission types
- Tier-scaled objectives and rewards
- Difficulty-based weighting
- Completion bonuses with crates
- Auto-expiration on schedule
- Progress tracking for all objective types

### Technical Notes
- Missions assigned on-demand (first request of the day)
- Tier multiplier scales both objective and reward
- Multiple missions can progress from same action
- Expired missions are soft-deleted (kept for history)

---

**File Location:** `web/src/lib/services/mission.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (MISSION_CONFIG)
- `web/src/app/api/missions/route.ts`
- `web/src/app/api/missions/claim/route.ts`
- `web/src/app/api/cron/daily/route.ts`
