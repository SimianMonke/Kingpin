# KINGPIN FORENSIC AUDIT: PHASE 12 - CORE MECHANICS REVIEW

**Audit Date:** December 15, 2025
**Auditor:** Claude Code (Opus 4.5)
**Scope:** Authentication, Economy Mode, Title Display, Play Events

---

## Executive Summary

The Kingpin codebase has solid foundations but contains two significant gaps that require immediate attention:

1. **CRITICAL:** Discord OAuth allows account creation without the required Kick/Twitch link
2. **HIGH:** The economy operates in "always free" mode with no live/offline detection

The title system is well-implemented but underutilized in chat announcements. Play events are more numerous than initially documented (78 vs 30) but still below the 300-event target.

---

## 1. Status Report Table

| Area | Current State | Gap Analysis | Priority |
|------|--------------|--------------|----------|
| OAuth-Only Auth | :warning: Partial | Discord OAuth creates accounts without Kick/Twitch linked first | **CRITICAL** |
| Economy Mode Flex | :x: Missing | No live/offline mode detection; economy always free via webapp | **HIGH** |
| Title Display | :white_check_mark: Mostly Complete | Titles work but not prepended to all chat announcements | **MEDIUM** |
| Play Event Count | :warning: Partial | 78 events exist (26% of 300 target) | **MEDIUM** |

---

## 2. Detailed Code Findings

### AREA 1: Authentication & Account Creation

#### What Works Correctly

- **Login page** (`web/src/app/(auth)/login/page.tsx:83-125`): Shows ONLY OAuth buttons (Kick, Twitch, Discord) - no form-based registration exists
- **API protection**: All protected routes use `getAuthSession()` properly
- **User service** (`web/src/lib/services/user.service.ts:148-160`): `getOrCreate()` correctly uses platform identifiers

#### CRITICAL FINDING: Discord Creates Profiles Without Kick/Twitch

**File:** `web/src/lib/auth.ts:68-81`

```typescript
if (!dbUser) {
  // Create new user
  dbUser = await prisma.user.create({
    data: {
      [platformField]: account.providerAccountId,
      username: user.name || `user_${account.providerAccountId}`,
      displayName: user.name,
      // Set Discord-specific fields if signing in with Discord
      ...(account.provider === 'discord' && {
        discordUsername: user.name,
        discordLinkedAt: new Date(),
      }),
    },
  })
}
```

**Issue:** When `account.provider === 'discord'`, a new user is created with ONLY `discordUserId` populated. There is NO check that the user must have Kick or Twitch linked first.

**Spec Violation:** Per `01_USERS_PROGRESSION.md`: *"Discord messages do NOT create profiles - users must link Kick or Twitch first"*

#### Severity Classification

- :red_circle: **CRITICAL**: Discord OAuth creates profiles without Kick/Twitch linked

---

### AREA 2: Economy Mode Flexibility (LIVE vs. OFFLINE)

#### What Exists

- **Session detection:** `JuicernautService.getActiveSession()` exists (`web/src/lib/services/juicernaut.service.ts:265-296`)
- **Dual-mode routing:** Play, Rob, Bail routes support both bot API key and webapp session auth

**File:** `web/src/app/api/play/route.ts:19-40`

```typescript
if (apiKey && botKey && apiKey === botKey) {
  // Bot request - get userId from body
  userId = body.userId
} else {
  // Website request - use session
  const session = await getAuthSession()
  userId = session.user.id
}

// Execute play - NO CHECK FOR STREAM STATUS
const result = await PlayService.executePlay(userId)
```

#### HIGH GAP: No Mode Detection Logic

**What's Missing:**

1. No check for `isStreamLive()` before allowing free webapp execution
2. All routes allow direct execution regardless of streaming state
3. The route comment says "channel point redemption handler" but allows unrestricted webapp calls

**Desired Behavior:**

| Action | When Streamer is LIVE | When Streamer is OFFLINE |
|--------|----------------------|--------------------------|
| Play | Channel points (Kick/Twitch) | Free via webapp AND Discord |
| Rob | Channel points (Kick/Twitch) | Free via webapp AND Discord |
| Bail | Channel points (Kick/Twitch) | Free via webapp AND Discord |
| Reroll Shop | Channel points (Kick/Twitch) | Free via webapp AND Discord |

#### Severity Classification

- :orange_circle: **HIGH**: No mode detection exists - economy completely inaccessible when offline (if channel points required)

---

### AREA 3: Title Display System

#### What Works Correctly

1. **Schema** (`web/prisma/schema.prisma:427-439`):

```prisma
model UserTitle {
  id          Int       @id @default(autoincrement())
  userId      Int
  title       String
  isEquipped  Boolean   @default(false)
  unlockedAt  DateTime  @default(now())
  @@unique([userId, title])
}
```

2. **Title equipping with mutual exclusion** (`web/src/lib/services/title.service.ts:54-86`):

```typescript
async equipTitle(userId: number, title: string): Promise<TitleEquipResult> {
  await prisma.$transaction(async (tx) => {
    // Unequip all titles
    await tx.userTitle.updateMany({
      where: { userId, isEquipped: true },
      data: { isEquipped: false },
    })
    // Equip selected title
    await tx.userTitle.update({
      where: { userId_title: { userId, title } },
      data: { isEquipped: true },
    })
  })
}
```

3. **Format helper exists** (`web/src/lib/services/title.service.ts:155-158`):

```typescript
formatWithTitle(displayName: string, title: string | null): string {
  if (!title) return displayName
  return `[${title}] ${displayName}`
}
```

4. **Bot profile display includes title** (`bot/src/utils/formatter.ts:137-159`):

```typescript
const title = profile.equippedTitle ? ` [${profile.equippedTitle}]` : ''
return [
  `👤 ${displayName}${title}`,
  // ...
].join(' | ')
```

5. **Web profile page shows title** (`web/src/app/(dashboard)/profile/page.tsx:267-283`)

#### MEDIUM GAP: Announcements Don't Include Titles

The `formatPlayResult()` and `formatRobResult()` functions in `bot/src/utils/formatter.ts` do NOT prepend the user's title.

**Spec Requirement:** *"Titles appear before username in chat: `[Master Thief] SimianMonke: !play`"*

**Current Output:** `🎰 Street Hustle: Sold knockoff stims...`
**Expected Output:** `[Master Thief] @SimianMonke 🎰 Street Hustle: Sold knockoff stims...`

#### Severity Classification

- :yellow_circle: **MEDIUM**: Titles work but not displayed in chat announcements

---

### AREA 4: Play Event Variety

#### Current Implementation

**File:** `web/src/lib/game/constants.ts:192-295`

| Tier | Positive Events | Negative Events | Total |
|------|-----------------|-----------------|-------|
| Rookie | 10 | 3 | 13 |
| Associate | 10 | 3 | 13 |
| Soldier | 10 | 3 | 13 |
| Captain | 10 | 3 | 13 |
| Underboss | 10 | 3 | 13 |
| Kingpin | 10 | 3 | 13 |
| **TOTAL** | 60 | 18 | **78** |

#### Gap Analysis

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Events per tier | 13 | 50 | -37 |
| Total events | 78 | 300 | -222 |
| Completion | 26% | 100% | -74% |

**Note:** The current implementation is better than the "30 events" mentioned in the audit spec (it's actually 78), but still falls significantly short of the 300-event target.

#### Severity Classification

- :yellow_circle: **MEDIUM**: Only 78 events exist (gameplay becomes repetitive)

---

## 3. Implementation Plan

### CRITICAL: Fix Discord Account Creation

**File to modify:** `web/src/lib/auth.ts`

**Changes required:**

```typescript
async signIn({ user, account, profile }) {
  if (!account || !user) return false

  try {
    const platformField = getPlatformField(account.provider)
    if (!platformField) return false

    // CRITICAL FIX: Check if Discord login without Kick/Twitch linked
    if (account.provider === 'discord') {
      // Check if user exists with this Discord ID
      const existingUser = await prisma.user.findFirst({
        where: { discordUserId: account.providerAccountId },
      })

      if (!existingUser) {
        // Discord cannot create new accounts - must link to existing
        console.log('Discord login rejected - no existing account')
        return '/login?error=discord_no_linked_account'
      }

      // User exists - allow login
      return true
    }

    // Kick/Twitch can create accounts (existing logic)
    // ...
  }
}
```

**Complexity:** Simple fix, ~20 lines of code

**Database migrations:** None required

---

### HIGH: Implement Economy Mode Detection

**Files to modify:**

1. `web/src/lib/services/play.service.ts` (or new `economy-mode.service.ts`)
2. `web/src/app/api/play/route.ts`
3. `web/src/app/api/rob/route.ts`
4. `web/src/app/api/bail/route.ts`
5. `web/src/app/api/users/me/shop/reroll/route.ts`

**Proposed implementation:**

```typescript
// New: web/src/lib/services/economy-mode.service.ts
import { JuicernautService } from './juicernaut.service'

export const EconomyModeService = {
  async canExecuteFree(): Promise<boolean> {
    const activeSession = await JuicernautService.getActiveSession()

    // If no active session (offline), allow free execution
    if (!activeSession || !activeSession.isActive) {
      return true
    }

    // Stream is live - require channel points
    return false
  }
}
```

```typescript
// Update: web/src/app/api/play/route.ts
export const POST = withErrorHandling(async (request: NextRequest) => {
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  const isFromBot = apiKey && botKey && apiKey === botKey

  // Check if free execution is allowed
  if (!isFromBot) {
    const canPlayFree = await EconomyModeService.canExecuteFree()
    if (!canPlayFree) {
      return errorResponse(
        'Stream is live - use channel points in chat to play',
        403
      )
    }
  }

  // ... rest of handler
})
```

**Complexity:** Moderate, ~100 lines across 5 files

**Database migrations:** None required

---

### MEDIUM: Add Titles to Announcements

**File to modify:** `bot/src/utils/formatter.ts`

**Changes required:**

```typescript
// Update formatPlayResult to include user info
export function formatPlayResult(
  username: string,
  equippedTitle: string | null,
  result: { /* ... */ }
): string {
  const titlePrefix = equippedTitle ? `[${equippedTitle}] ` : ''
  const { event } = result

  let message = `${titlePrefix}@${username} 🎰 ${event.name}: ${event.description}`
  // ... rest
}

// Update formatRobResult similarly
export function formatRobResult(
  attackerName: string,
  attackerTitle: string | null,
  result: { /* ... */ }
): string {
  const titlePrefix = attackerTitle ? `[${attackerTitle}] ` : ''
  // ...
}
```

**Complexity:** Simple, ~50 lines across 2-3 files

**Database migrations:** None required

---

### MEDIUM: Expand Play Events to 300

**File to modify:** `web/src/lib/game/constants.ts`

**Approach options:**

1. **Manual expansion:** Write 222 additional events (significant content work)
2. **Database-driven:** Move events to database for easier management
3. **AI-assisted generation:** Generate themed events for each tier

**Recommended event categories per tier (10 each = 50 total):**

| Tier | Theme 1 | Theme 2 | Theme 3 | Theme 4 | Theme 5 |
|------|---------|---------|---------|---------|---------|
| Rookie | Petty Crime | Street Hustles | Scavenging | Information | Survival |
| Associate | Protection | Drugs | Vehicles | Gambling | Blackmail |
| Soldier | Heists | Convoys | Enforcement | Data | Smuggling |
| Captain | Banks | Kidnapping | Arms | Territory | Cyber |
| Underboss | Corporate | Political | Syndicate | Markets | Intelligence |
| Kingpin | Acquisitions | Government | Manipulation | Power | Ascension |

**Complexity:** High (content creation), Low (technical implementation)

**Database migrations:** Optional (if moving to database-driven events)

---

## 4. Priority Recommendations

### Immediate (Must Fix)

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **1** | Discord creates accounts without Kick/Twitch | Security violation - allows identity bypass | Simple |
| **2** | Economy mode detection | Gameplay blocked when offline | Moderate |

### Short-term (Should Fix)

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **3** | Title prefixes in announcements | User experience - titles feel useless | Simple |

### Long-term (Nice to Have)

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **4** | Expand to 300 play events | Gameplay variety - prevents repetition | High (content) |

---

## 5. Files Referenced

### Authentication

- `web/src/app/(auth)/login/page.tsx` - Login page UI
- `web/src/lib/auth.ts` - NextAuth configuration
- `web/src/app/api/auth/[...nextauth]/route.ts` - Auth route handler
- `web/src/lib/services/user.service.ts` - User CRUD operations
- `web/src/app/api/users/me/route.ts` - Current user API

### Economy Mode

- `web/src/app/api/play/route.ts` - Play action endpoint
- `web/src/app/api/rob/route.ts` - Rob action endpoint
- `web/src/app/api/bail/route.ts` - Bail action endpoint
- `web/src/app/api/users/me/shop/reroll/route.ts` - Shop reroll endpoint
- `web/src/lib/services/juicernaut.service.ts` - Session management

### Title Display

- `web/prisma/schema.prisma` - UserTitle model (lines 427-439)
- `web/src/lib/services/title.service.ts` - Title management
- `web/src/app/api/titles/route.ts` - Titles API
- `web/src/app/(dashboard)/profile/page.tsx` - Profile page
- `bot/src/utils/formatter.ts` - Chat message formatting
- `bot/src/commands/profile.ts` - Profile command

### Play Events

- `web/src/lib/game/constants.ts` - Event definitions (lines 192-295)
- `web/src/lib/services/play.service.ts` - Play execution

---

## 6. Conclusion

The Kingpin codebase demonstrates solid architecture and implementation patterns. The two critical issues identified (Discord auth bypass and economy mode detection) represent specification violations rather than fundamental design flaws, making them straightforward to remediate.

**Recommended next steps:**

1. Implement Discord auth restriction (Priority 1) - Est. 1-2 hours
2. Add economy mode detection (Priority 2) - Est. 4-6 hours
3. Update formatters with title prefixes (Priority 3) - Est. 2-3 hours
4. Plan event expansion strategy (Priority 4) - Content planning required

---

*Report generated by Claude Code forensic audit system*
