# LEADERBOARD SYSTEM - Implementation Documentation

## Overview

The Leaderboard System tracks player statistics across multiple time periods and categories, maintains historical rankings, and manages the Hall of Fame records for all-time achievements.

**Current Implementation Status:** Complete

---

## Database Schema

### Leaderboard Snapshots

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Snapshot ID |
| `user_id` | INT (FK) | User ID |
| `period_type` | VARCHAR(20) | daily, weekly, monthly, annual |
| `period_start` | DATE | Period start date |
| `period_end` | DATE | Period end date |
| `wealth_earned` | BIGINT | Wealth earned in period |
| `xp_earned` | BIGINT | XP earned in period |
| `messages_sent` | INT | Chat messages sent |
| `watch_time_minutes` | INT | Watch time (Twitch) |
| `play_count` | INT | Number of plays |
| `rob_count` | INT | Robbery attempts |
| `rob_success_count` | INT | Successful robberies |
| `checkins` | INT | Daily check-ins |
| `crates_opened` | INT | Crates opened |
| `subs_count` | INT | Subscriptions |
| `gift_subs_given` | INT | Gift subs given |
| `bits_donated` | INT | Bits donated |
| `kicks_sent` | INT | Kicks sent |
| `donations_usd` | DECIMAL(10,2) | USD donations |
| `total_contributed_usd` | DECIMAL(10,2) | Total contribution value |
| `created_at` | TIMESTAMP | Record creation time |

**Unique Constraint:** `(user_id, period_type, period_start)`

### Hall of Fame Records

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Record ID |
| `record_type` | VARCHAR(50) | Type of record |
| `user_id` | INT (FK) | Record holder |
| `value` | BIGINT | Record value |
| `achieved_at` | TIMESTAMP | When achieved |
| `previous_holder_id` | INT | Previous record holder |
| `previous_value` | BIGINT | Previous record value |

**Record Types:**
- `biggest_single_rob` - Largest single robbery
- `highest_level` - Highest level reached
- `longest_streak` - Longest check-in streak
- `most_wealth` - Peak wealth reached
- `most_gambling_won` - Most won in single gambling session
- `biggest_jackpot` - Largest slots jackpot

### Leaderboard History

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | History ID |
| `period_type` | VARCHAR(20) | Period type |
| `period_start` | DATE | Period start |
| `period_end` | DATE | Period end |
| `leaderboard_type` | VARCHAR(50) | Category |
| `rankings` | JSONB | Serialized rankings |
| `archived_at` | TIMESTAMP | When archived |

---

## Leaderboard Categories

| Category | Description | Tracked Stat |
|----------|-------------|--------------|
| `wealth` | Wealth earned | wealth_earned |
| `xp` | XP earned | xp_earned |
| `chatters` | Messages sent | messages_sent |
| `donations` | Total contributions | total_contributed_usd |
| `plays` | Play commands used | play_count |
| `robberies` | Successful robberies | rob_success_count |
| `checkins` | Check-ins completed | checkins |
| `crates` | Crates opened | crates_opened |

## Time Periods

| Period | Duration | Reset |
|--------|----------|-------|
| `daily` | 24 hours | 00:00 UTC |
| `weekly` | 7 days | Monday 00:00 UTC |
| `monthly` | Calendar month | 1st 00:00 UTC |
| `annual` | Calendar year | Jan 1st 00:00 UTC |
| `lifetime` | All time | Never |

---

## Service Layer Implementation

**File:** `web/src/lib/services/leaderboard.service.ts`

### Public Methods

```typescript
export const LeaderboardService = {
  /**
   * Get leaderboard for category and period
   */
  async getLeaderboard(
    category: LeaderboardCategory,
    period: LeaderboardPeriod,
    limit?: number
  ): Promise<LeaderboardEntry[]>

  /**
   * Get user's rank in a leaderboard
   */
  async getUserRank(
    userId: number,
    category: LeaderboardCategory,
    period: LeaderboardPeriod
  ): Promise<number | null>

  /**
   * Update user's snapshot for current periods
   */
  async updateSnapshot(
    userId: number,
    updates: Partial<SnapshotUpdates>
  ): Promise<void>

  /**
   * Check and update hall of fame record
   */
  async checkAndUpdateRecord(
    recordType: string,
    userId: number,
    value: number
  ): Promise<{ newRecord: boolean; previousHolder?: string }>

  /**
   * Get hall of fame records
   */
  async getHallOfFame(): Promise<HallOfFameRecord[]>

  /**
   * Archive current period leaderboards
   */
  async archivePeriod(periodType: LeaderboardPeriod): Promise<void>

  /**
   * Get historical leaderboard
   */
  async getHistoricalLeaderboard(
    periodType: LeaderboardPeriod,
    periodStart: Date,
    category: LeaderboardCategory
  ): Promise<LeaderboardEntry[]>
}
```

### Update Snapshot

```typescript
async function updateSnapshot(userId: number, updates: Partial<SnapshotUpdates>) {
  const now = new Date()

  // Get current period boundaries
  const periods = ['daily', 'weekly', 'monthly', 'annual']

  for (const periodType of periods) {
    const { start, end } = getPeriodBoundaries(periodType, now)

    // Upsert snapshot for each period
    await prisma.leaderboard_snapshots.upsert({
      where: {
        user_id_period_type_period_start: {
          user_id: userId,
          period_type: periodType,
          period_start: start,
        },
      },
      update: {
        wealth_earned: updates.wealth_earned
          ? { increment: updates.wealth_earned }
          : undefined,
        xp_earned: updates.xp_earned
          ? { increment: updates.xp_earned }
          : undefined,
        messages_sent: updates.messages_sent
          ? { increment: updates.messages_sent }
          : undefined,
        play_count: updates.play_count
          ? { increment: updates.play_count }
          : undefined,
        rob_count: updates.rob_count
          ? { increment: updates.rob_count }
          : undefined,
        rob_success_count: updates.rob_success_count
          ? { increment: updates.rob_success_count }
          : undefined,
        checkins: updates.checkins
          ? { increment: updates.checkins }
          : undefined,
        // ... other fields
      },
      create: {
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        ...updates,
      },
    })
  }
}
```

### Get Leaderboard

```typescript
async function getLeaderboard(
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const { start, end } = getPeriodBoundaries(period, new Date())

  const orderByField = getOrderByField(category)

  const snapshots = await prisma.leaderboard_snapshots.findMany({
    where: {
      period_type: period,
      period_start: start,
      [orderByField]: { gt: 0 },
    },
    orderBy: { [orderByField]: 'desc' },
    take: limit,
    include: {
      users: {
        select: {
          username: true,
          display_name: true,
          user_titles: { where: { is_equipped: true }, take: 1 },
        },
      },
    },
  })

  return snapshots.map((snap, index) => ({
    rank: index + 1,
    user_id: snap.user_id,
    username: snap.users.username,
    display_name: snap.users.display_name,
    value: snap[orderByField],
    equippedTitle: snap.users.user_titles[0]?.title || null,
  }))
}
```

### Hall of Fame Record Check

```typescript
async function checkAndUpdateRecord(
  recordType: string,
  userId: number,
  value: number
): Promise<{ newRecord: boolean; previousHolder?: string }> {
  const currentRecord = await prisma.hall_of_fame_records.findFirst({
    where: { record_type: recordType },
    include: { users: true },
  })

  if (!currentRecord || value > Number(currentRecord.value)) {
    await prisma.hall_of_fame_records.upsert({
      where: { record_type: recordType },
      update: {
        user_id: userId,
        value: BigInt(value),
        achieved_at: new Date(),
        previous_holder_id: currentRecord?.user_id,
        previous_value: currentRecord?.value,
      },
      create: {
        record_type: recordType,
        user_id: userId,
        value: BigInt(value),
        achieved_at: new Date(),
      },
    })

    // Notify Discord of new record
    await DiscordService.postNewRecord(recordType, userId, value)

    return {
      newRecord: true,
      previousHolder: currentRecord?.users.username,
    }
  }

  return { newRecord: false }
}
```

---

## Period Boundary Calculation

```typescript
function getPeriodBoundaries(
  periodType: LeaderboardPeriod,
  date: Date
): { start: Date; end: Date } {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)

  switch (periodType) {
    case 'daily':
      return {
        start: d,
        end: new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1),
      }

    case 'weekly':
      // Start on Monday
      const day = d.getUTCDay()
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setUTCDate(diff))
      return {
        start: monday,
        end: new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
      }

    case 'monthly':
      const monthStart = new Date(d.getUTCFullYear(), d.getUTCMonth(), 1)
      const monthEnd = new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
      return { start: monthStart, end: monthEnd }

    case 'annual':
      return {
        start: new Date(d.getUTCFullYear(), 0, 1),
        end: new Date(d.getUTCFullYear(), 11, 31),
      }

    case 'lifetime':
      return {
        start: new Date(0),
        end: new Date(8640000000000000),  // Max date
      }
  }
}
```

---

## API Endpoints

### GET /api/leaderboards
Get leaderboard data.

**Query Parameters:**
- `category` - wealth, xp, chatters, donations, plays, robberies
- `period` - daily, weekly, monthly, annual, lifetime
- `limit` - Number of entries (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "rank": 1,
        "user_id": 42,
        "username": "TopPlayer",
        "display_name": "Top Player",
        "value": 150000,
        "equippedTitle": "Kingpin"
      }
    ],
    "period": {
      "type": "weekly",
      "start": "2024-01-15",
      "end": "2024-01-21"
    }
  }
}
```

### GET /api/leaderboards/rank
Get user's rank in a leaderboard.

### GET /api/leaderboards/records
Get Hall of Fame records.

---

## Scheduled Jobs

### Daily Archive (Cron: 00:01 UTC)

```typescript
async function archiveDailyLeaderboards() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  for (const category of LEADERBOARD_CATEGORIES) {
    await archivePeriod('daily', yesterday, category)
  }
}
```

### Weekly Archive (Cron: Monday 00:01 UTC)

```typescript
async function archiveWeeklyLeaderboards() {
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)

  for (const category of LEADERBOARD_CATEGORIES) {
    await archivePeriod('weekly', lastWeek, category)
  }
}
```

---

## System Interdependencies

### Depends On
- **User System:** User data for rankings
- **Database Layer:** Snapshot storage

### Depended On By
- **Play System:** Updates play_count, wealth_earned, xp_earned
- **Rob System:** Updates rob_count, rob_success_count
- **Check-in System:** Updates checkins
- **Mission System:** Checks for leaderboard_viewed objective
- **Juicernaut System:** Updates contributions
- **Chat System:** Updates messages_sent

---

## Configuration & Constants

```typescript
const LEADERBOARD_CATEGORIES = [
  'wealth',
  'xp',
  'chatters',
  'donations',
  'plays',
  'robberies',
  'checkins',
  'crates',
]

const LEADERBOARD_PERIODS = [
  'daily',
  'weekly',
  'monthly',
  'annual',
  'lifetime',
]

// Snapshot field mappings
const CATEGORY_FIELD_MAP = {
  wealth: 'wealth_earned',
  xp: 'xp_earned',
  chatters: 'messages_sent',
  donations: 'total_contributed_usd',
  plays: 'play_count',
  robberies: 'rob_success_count',
  checkins: 'checkins',
  crates: 'crates_opened',
}
```

---

## Known Limitations & TODOs

### Completed Features
- Multi-period tracking (daily, weekly, monthly, annual, lifetime)
- Multiple stat categories
- Hall of Fame records
- Historical leaderboard archiving
- User rank lookup
- Real-time snapshot updates

### Technical Notes
- Snapshots are upserted, not created fresh each action
- Period boundaries use UTC for consistency
- Lifetime leaderboards query aggregate user stats
- Historical data preserved in leaderboard_history table

---

**File Location:** `web/src/lib/services/leaderboard.service.ts`
**Related Files:**
- `web/src/app/api/leaderboards/route.ts`
- `web/src/app/api/cron/daily/route.ts` (archive job)
- `web/src/app/api/cron/weekly/route.ts` (archive job)
