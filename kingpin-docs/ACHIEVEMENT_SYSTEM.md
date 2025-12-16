# ACHIEVEMENT SYSTEM - Implementation Documentation

## Overview

The Achievement System tracks player milestones and rewards completion with wealth, XP, and exclusive titles. Achievements are categorized by type (wealth, crime, social, etc.) and tiered by difficulty (bronze to legendary).

**Current Implementation Status:** Complete

---

## Database Schema

### Achievement Definitions: `achievements`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Achievement ID |
| `key` | VARCHAR(100) | Unique identifier |
| `name` | VARCHAR(100) | Display name |
| `description` | TEXT | Achievement description |
| `category` | VARCHAR(50) | Category (wealth, crime, etc.) |
| `tier` | VARCHAR(20) | Difficulty tier |
| `requirement_type` | VARCHAR(50) | Type of progress tracked |
| `requirement_value` | INT | Target value to complete |
| `reward_wealth` | INT | Wealth reward |
| `reward_xp` | INT | XP reward |
| `reward_title` | VARCHAR(100) | Title reward (if any) |
| `icon_url` | VARCHAR(255) | Achievement icon |
| `is_hidden` | BOOLEAN | Hidden until unlocked |
| `is_active` | BOOLEAN | Whether achievement is active |
| `created_at` | TIMESTAMP | Creation time |

### User Progress: `user_achievements`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Entry ID |
| `user_id` | INT (FK) | User ID |
| `achievement_id` | INT (FK) | Achievement ID |
| `current_progress` | INT | Current progress value |
| `is_completed` | BOOLEAN | Whether completed |
| `completed_at` | TIMESTAMP | Completion time |
| `created_at` | TIMESTAMP | When tracking started |

**Unique Constraint:** `(user_id, achievement_id)`

### User Titles: `user_titles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Entry ID |
| `user_id` | INT (FK) | User ID |
| `title` | VARCHAR(100) | Title text |
| `is_equipped` | BOOLEAN | Whether title is displayed |
| `unlocked_at` | TIMESTAMP | When unlocked |
| `source` | VARCHAR(50) | Source (achievement, crate, etc.) |

---

## Achievement Categories

```typescript
const ACHIEVEMENT_CATEGORIES = {
  WEALTH: 'wealth',       // Earning money
  EXPERIENCE: 'experience', // Leveling/XP
  CRIME: 'crime',         // Robbery, illegal activities
  SOCIAL: 'social',       // Community engagement
  COLLECTION: 'collection', // Items, titles
  DEDICATION: 'dedication', // Streaks, loyalty
  SPECIAL: 'special',     // One-time events
  SEASONAL: 'seasonal',   // Time-limited
  SECRET: 'secret',       // Hidden achievements
}
```

## Achievement Tiers

```typescript
const ACHIEVEMENT_TIERS = {
  BRONZE: 'bronze',       // Easy
  SILVER: 'silver',       // Medium
  GOLD: 'gold',           // Hard
  PLATINUM: 'platinum',   // Very hard
  LEGENDARY: 'legendary', // Extremely difficult
}
```

## Requirement Types

```typescript
const ACHIEVEMENT_REQUIREMENT_TYPES = {
  TOTAL_WEALTH_EARNED: 'total_wealth_earned',
  ROB_WINS: 'rob_wins',
  ROB_DEFENSES: 'rob_defenses',
  ROB_WIN_STREAK: 'rob_win_streak',
  CHECKIN_STREAK: 'checkin_streak',
  LEVEL: 'level',
  PLAY_COUNT: 'play_count',
  BUSINESS_COLLECTIONS: 'business_collections',
  MESSAGES_SENT: 'messages_sent',
  FACTION_JOINED: 'faction_joined',
  FACTION_DAYS: 'faction_days',
  TERRITORY_CAPTURES: 'territory_captures',
  JUICERNAUT_WINS: 'juicernaut_wins',
  JUICERNAUT_CONTRIBUTION: 'juicernaut_contribution',
  BUST_COUNT: 'bust_count',
  BAIL_COUNT: 'bail_count',
  LEGENDARY_CRATE_ITEM: 'legendary_crate_item',
  UNIQUE_ITEMS_OWNED: 'unique_items_owned',
  EARLY_ADOPTER: 'early_adopter',
  // Gambling
  GAMBLING_WINS: 'gambling_wins',
  GAMBLING_TOTAL_WON: 'gambling_total_won',
  SLOTS_JACKPOT: 'slots_jackpot',
  BLACKJACK_WINS: 'blackjack_wins',
  COINFLIP_WINS: 'coinflip_wins',
  LOTTERY_WINS: 'lottery_wins',
  GAMBLING_WIN_STREAK: 'gambling_win_streak',
  HIGH_ROLLER_WAGER: 'high_roller_wager',
}
```

---

## Example Achievements

### Wealth Category
| Name | Tier | Requirement | Reward |
|------|------|-------------|--------|
| First Paycheck | Bronze | Earn $1,000 total | $100, 50 XP |
| Street Hustler | Silver | Earn $10,000 total | $500, 200 XP |
| Made Man | Gold | Earn $100,000 total | $2,000, 500 XP, "Made Man" title |
| Kingpin's Fortune | Platinum | Earn $1,000,000 total | $10,000, 2000 XP, "Tycoon" title |
| Billionaire's Club | Legendary | Earn $10,000,000 total | $50,000, 10000 XP, "Mogul" title |

### Crime Category
| Name | Tier | Requirement | Reward |
|------|------|-------------|--------|
| Petty Thief | Bronze | Win 5 robberies | $200, 100 XP |
| Career Criminal | Silver | Win 25 robberies | $1,000, 400 XP |
| Master Thief | Gold | Win 100 robberies | $5,000, 1000 XP, "Master Thief" title |
| Iron Defense | Gold | Defend 50 robberies | $3,000, 800 XP, "Untouchable" title |

### Dedication Category
| Name | Tier | Requirement | Reward |
|------|------|-------------|--------|
| Showing Up | Bronze | 7-day check-in streak | $300, 150 XP |
| Loyal Soldier | Silver | 30-day check-in streak | $2,000, 600 XP |
| Devoted | Gold | 60-day check-in streak | $5,000, 1500 XP, "Devoted" title |
| Legendary Loyalty | Legendary | 365-day check-in streak | $50,000, 10000 XP, "Legend" title |

---

## Service Layer Implementation

**Files:**
- `web/src/lib/services/achievement.service.ts`
- `web/src/lib/services/title.service.ts`

### AchievementService Methods

```typescript
export const AchievementService = {
  /**
   * Get all achievements for user
   */
  async getAchievements(userId: number): Promise<Achievement[]>

  /**
   * Get user's progress on all achievements
   */
  async getUserProgress(userId: number): Promise<UserAchievementProgress[]>

  /**
   * Increment progress on an achievement type
   */
  async incrementProgress(
    userId: number,
    requirementType: string,
    amount: number
  ): Promise<AchievementUnlock[]>

  /**
   * Set progress to specific value (for "highest" type achievements)
   */
  async setProgress(
    userId: number,
    requirementType: string,
    value: number
  ): Promise<AchievementUnlock[]>

  /**
   * Check and unlock completed achievements
   */
  async checkCompletions(userId: number): Promise<AchievementUnlock[]>

  /**
   * Get achievement by key
   */
  async getByKey(key: string): Promise<Achievement | null>

  /**
   * Get achievements by category
   */
  async getByCategory(category: string): Promise<Achievement[]>
}
```

### TitleService Methods

```typescript
export const TitleService = {
  /**
   * Get all titles for user
   */
  async getUserTitles(userId: number): Promise<Title[]>

  /**
   * Award title to user
   */
  async awardTitle(userId: number, title: string, source: string): Promise<void>

  /**
   * Equip a title
   */
  async equipTitle(userId: number, titleId: number): Promise<void>

  /**
   * Unequip current title
   */
  async unequipTitle(userId: number): Promise<void>

  /**
   * Check if user has title
   */
  async hasTitle(userId: number, title: string): Promise<boolean>
}
```

### Progress Update Flow

```typescript
async function incrementProgress(
  userId: number,
  requirementType: string,
  amount: number
): Promise<AchievementUnlock[]> {
  // Get all achievements with this requirement type
  const achievements = await prisma.achievements.findMany({
    where: {
      requirement_type: requirementType,
      is_active: true,
    },
  })

  const unlocked: AchievementUnlock[] = []

  for (const achievement of achievements) {
    // Get or create user progress
    const progress = await prisma.user_achievements.upsert({
      where: {
        user_id_achievement_id: {
          user_id: userId,
          achievement_id: achievement.id,
        },
      },
      update: {
        current_progress: { increment: amount },
      },
      create: {
        user_id: userId,
        achievement_id: achievement.id,
        current_progress: amount,
      },
    })

    // Check for completion
    if (!progress.is_completed && progress.current_progress >= achievement.requirement_value) {
      await completeAchievement(userId, achievement, progress)
      unlocked.push({
        achievement,
        rewards: {
          wealth: achievement.reward_wealth,
          xp: achievement.reward_xp,
          title: achievement.reward_title,
        },
      })
    }
  }

  return unlocked
}
```

### Achievement Completion

```typescript
async function completeAchievement(
  userId: number,
  achievement: Achievement,
  progress: UserAchievementProgress
): Promise<void> {
  // Mark as completed
  await prisma.user_achievements.update({
    where: { id: progress.id },
    data: {
      is_completed: true,
      completed_at: new Date(),
    },
  })

  // Award rewards
  if (achievement.reward_wealth) {
    await UserService.addWealth(userId, achievement.reward_wealth)
  }

  if (achievement.reward_xp) {
    await UserService.addXp(userId, achievement.reward_xp)
  }

  if (achievement.reward_title) {
    await TitleService.awardTitle(userId, achievement.reward_title, 'achievement')
  }

  // Send notification
  await NotificationService.create(userId, 'achievement', {
    title: 'Achievement Unlocked!',
    message: `You earned "${achievement.name}"`,
    achievement_id: achievement.id,
  })

  // Post to Discord (platinum+ only)
  if (['platinum', 'legendary'].includes(achievement.tier)) {
    await DiscordService.postAchievement(userId, achievement)
  }
}
```

---

## API Endpoints

### GET /api/achievements
Get all achievements with user progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": 1,
        "key": "first_paycheck",
        "name": "First Paycheck",
        "description": "Earn your first $1,000",
        "category": "wealth",
        "tier": "bronze",
        "requirement_type": "total_wealth_earned",
        "requirement_value": 1000,
        "current_progress": 850,
        "is_completed": false,
        "reward_wealth": 100,
        "reward_xp": 50,
        "reward_title": null
      }
    ],
    "completedCount": 12,
    "totalCount": 50
  }
}
```

### GET /api/titles
Get user's unlocked titles.

### POST /api/titles/equip
Equip a title.

---

## System Interdependencies

### Depends On
- **User System:** Rewards distribution
- **Title System:** Title awards
- **Notification System:** Unlock notifications
- **Discord System:** Major achievement posts

### Depended On By (Progress Updates From)
- **Play System:** play_count, total_wealth_earned
- **Rob System:** rob_wins, rob_defenses
- **Check-in System:** checkin_streak
- **Jail System:** bust_count, bail_count
- **Crate System:** legendary_crate_item
- **Gambling System:** gambling stats
- **Faction System:** faction stats
- **Juicernaut System:** juicernaut stats

---

## Configuration & Constants

```typescript
// Categories
const ACHIEVEMENT_CATEGORIES = {
  WEALTH: 'wealth',
  EXPERIENCE: 'experience',
  CRIME: 'crime',
  SOCIAL: 'social',
  COLLECTION: 'collection',
  DEDICATION: 'dedication',
  SPECIAL: 'special',
  SEASONAL: 'seasonal',
  SECRET: 'secret',
}

// Tiers
const ACHIEVEMENT_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  LEGENDARY: 'legendary',
}

// Discord posting threshold
const DISCORD_FEED_CONFIG = {
  ACHIEVEMENT_MIN_TIER: 'platinum',  // Only post platinum+ to Discord
}
```

---

## Known Limitations & TODOs

### Completed Features
- 9 achievement categories
- 5 achievement tiers
- 30+ requirement types
- Title rewards from achievements
- Hidden/secret achievements
- Discord integration for major unlocks
- Notification system

### Technical Notes
- `incrementProgress` for cumulative stats (wealth earned, rob wins)
- `setProgress` for "highest" stats (level, streak)
- Hidden achievements show as "???" until unlocked
- Platinum+ achievements post to Discord

---

**File Location:** `web/src/lib/services/achievement.service.ts`
**Related Files:**
- `web/src/lib/services/title.service.ts`
- `web/src/lib/game/constants.ts` (ACHIEVEMENT_REQUIREMENT_TYPES)
- `web/src/app/api/achievements/route.ts`
- `web/src/app/api/titles/route.ts`
