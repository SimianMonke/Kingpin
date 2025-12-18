# Admin Panel Implementation Specification

> Complete implementation guide for the Kingpin Admin Control Panel.
> **Version:** 1.0
> **Status:** Approved for Implementation
> **Created:** December 18, 2024

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Phase 1: Core Admin Functions](#4-phase-1-core-admin-functions)
5. [Phase 2: Game Configuration](#5-phase-2-game-configuration)
6. [Phase 3: Operations & Analytics](#6-phase-3-operations--analytics)
7. [Safety Mechanisms](#7-safety-mechanisms)
8. [API Route Reference](#8-api-route-reference)
9. [UI Component Specifications](#9-ui-component-specifications)
10. [Testing Requirements](#10-testing-requirements)

---

## 1. Architecture Overview

### 1.1 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Defense in Depth** | Multiple auth checks, rate limiting, audit logging |
| **Least Privilege** | Role-based access (Owner > Moderator) |
| **Audit Everything** | Every admin action creates immutable record |
| **Graceful Degradation** | Admin panel works even if some services fail |
| **Human-Centered Safety** | Confirmation dialogs prevent accidents |

### 1.2 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      ADMIN PANEL                             │
├─────────────────────────────────────────────────────────────┤
│  Frontend    │  Next.js 14 App Router + Tailwind + Shadcn   │
│  Backend     │  Next.js API Routes (Server Actions)          │
│  Database    │  PostgreSQL (Neon) via Prisma                 │
│  Auth        │  NextAuth.js + Admin Role Middleware          │
│  State       │  React Query for server state                 │
│  Real-time   │  Polling (30s intervals for dashboard)        │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 URL Structure

```
/admin                    → Dashboard (overview stats)
/admin/players            → Player search & management
/admin/players/[id]       → Individual player editor
/admin/settings           → Global settings & feature flags
/admin/economy            → Economy stats & manual adjustments
/admin/content            → Heists, items, achievements
/admin/content/heists     → Heist pool management
/admin/content/items      → Item catalog viewer
/admin/logs               → Audit log viewer
/admin/logs/[id]          → Individual log entry detail
```

### 1.4 File Structure

```
web/src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx              # Admin layout with sidebar
│   │   ├── page.tsx                # Dashboard
│   │   ├── players/
│   │   │   ├── page.tsx            # Player search
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Player editor
│   │   ├── settings/
│   │   │   └── page.tsx            # Global settings
│   │   ├── economy/
│   │   │   └── page.tsx            # Economy overview
│   │   ├── content/
│   │   │   ├── page.tsx            # Content hub
│   │   │   └── heists/
│   │   │       └── page.tsx        # Heist management
│   │   └── logs/
│   │       └── page.tsx            # Audit logs
│   └── api/
│       └── admin/
│           ├── middleware.ts       # Auth middleware
│           ├── players/
│           │   ├── route.ts        # GET: search, POST: bulk actions
│           │   └── [id]/
│           │       └── route.ts    # GET/PATCH/DELETE player
│           ├── settings/
│           │   └── route.ts        # GET/PATCH settings
│           ├── economy/
│           │   ├── route.ts        # GET stats
│           │   └── adjust/
│           │       └── route.ts    # POST adjustments
│           ├── content/
│           │   └── heists/
│           │       └── route.ts    # CRUD heist content
│           └── logs/
│               └── route.ts        # GET audit logs
├── lib/
│   └── admin/
│       ├── auth.ts                 # Admin auth utilities
│       ├── audit.ts                # Audit logging service
│       ├── settings.ts             # Settings service
│       └── constants.ts            # Admin-specific constants
└── components/
    └── admin/
        ├── AdminSidebar.tsx
        ├── AdminHeader.tsx
        ├── PlayerSearch.tsx
        ├── PlayerEditor.tsx
        ├── SettingsPanel.tsx
        ├── AuditLogTable.tsx
        ├── ConfirmDialog.tsx
        └── StatCard.tsx
```

---

## 2. Database Schema

### 2.1 New Tables

Add to `web/prisma/schema.prisma`:

```prisma
// =============================================================================
// ADMIN PANEL - Settings, Audit, and Access Control
// =============================================================================

/// Global admin-configurable settings stored as JSON values
/// Use for runtime-tunable values that don't require code deploys
model admin_settings {
  key          String    @id @db.VarChar(100)
  value        Json                              // Flexible JSON value
  value_type   String    @db.VarChar(20)         // 'boolean', 'number', 'string', 'json'
  category     String    @db.VarChar(50)         // 'features', 'economy', 'gameplay', 'display'
  label        String    @db.VarChar(100)        // Human-readable label
  description  String?                           // Help text for admins
  constraints  Json?                             // { min?: number, max?: number, options?: string[] }
  is_sensitive Boolean   @default(false)         // Hide value in logs
  updated_by   Int?
  updated_at   DateTime  @default(now()) @db.Timestamp(6)

  @@index([category])
}

/// Immutable audit log of all admin actions
/// CRITICAL: Never delete or modify existing records
model admin_audit_log {
  id           Int       @id @default(autoincrement())
  admin_id     Int                               // User ID of admin
  admin_name   String    @db.VarChar(100)        // Denormalized for query speed
  action       String    @db.VarChar(100)        // Action identifier
  category     String    @db.VarChar(50)         // 'player', 'setting', 'economy', 'content', 'system'
  target_type  String?   @db.VarChar(50)         // 'user', 'setting', 'item', etc.
  target_id    String?   @db.VarChar(100)        // ID of affected entity
  target_name  String?   @db.VarChar(200)        // Denormalized name for display
  old_value    Json?                             // Previous state (null for creates)
  new_value    Json?                             // New state (null for deletes)
  ip_address   String?   @db.VarChar(45)         // IPv4 or IPv6
  user_agent   String?   @db.VarChar(500)        // Browser/client info
  reason       String?                           // Optional admin-provided reason
  session_id   String?   @db.VarChar(100)        // For correlating related actions
  created_at   DateTime  @default(now()) @db.Timestamp(6)

  @@index([admin_id])
  @@index([created_at(sort: Desc)])
  @@index([category])
  @@index([target_type, target_id])
  @@index([action])
}

/// Admin role assignments
/// Separate from users table for clean separation of concerns
model admin_users {
  id          Int       @id @default(autoincrement())
  user_id     Int       @unique
  role        String    @db.VarChar(20)          // 'owner', 'moderator'
  permissions Json?                              // Optional granular permissions override
  granted_by  Int?                               // User ID who granted access
  granted_at  DateTime  @default(now()) @db.Timestamp(6)
  revoked_at  DateTime? @db.Timestamp(6)         // Soft delete
  notes       String?                            // Why they have access
  users       users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([role])
}

/// Player bans with history
model player_bans {
  id           Int       @id @default(autoincrement())
  user_id      Int
  banned_by    Int                               // Admin user ID
  reason       String
  ban_type     String    @db.VarChar(20)         // 'temporary', 'permanent'
  expires_at   DateTime? @db.Timestamp(6)        // NULL for permanent
  is_active    Boolean   @default(true)
  unbanned_by  Int?
  unbanned_at  DateTime? @db.Timestamp(6)
  unban_reason String?
  created_at   DateTime  @default(now()) @db.Timestamp(6)
  users        users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([is_active])
}
```

### 2.2 Users Table Addition

Add relation to existing `users` model:

```prisma
model users {
  // ... existing fields ...

  // Add these relations:
  admin_users   admin_users?
  player_bans   player_bans[]
}
```

### 2.3 Initial Settings Seed Data

Create `web/prisma/seed-admin.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INITIAL_SETTINGS = [
  // Feature Flags
  {
    key: 'feature_maintenance_mode',
    value: false,
    value_type: 'boolean',
    category: 'features',
    label: 'Maintenance Mode',
    description: 'Disable all gameplay. Only admins can access the site.',
    is_sensitive: false,
  },
  {
    key: 'feature_gambling_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Gambling Enabled',
    description: 'Enable/disable all gambling features (slots, blackjack, coinflip, lottery).',
    is_sensitive: false,
  },
  {
    key: 'feature_robbery_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Robbery Enabled',
    description: 'Enable/disable the rob command.',
    is_sensitive: false,
  },
  {
    key: 'feature_heists_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Heists Enabled',
    description: 'Enable/disable stream heist events.',
    is_sensitive: false,
  },
  {
    key: 'feature_missions_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Missions Enabled',
    description: 'Enable/disable daily and weekly missions.',
    is_sensitive: false,
  },
  {
    key: 'feature_registration_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'New Registration',
    description: 'Allow new users to register.',
    is_sensitive: false,
  },

  // Economy Settings
  {
    key: 'economy_wealth_multiplier',
    value: 1.0,
    value_type: 'number',
    category: 'economy',
    label: 'Global Wealth Multiplier',
    description: 'Multiplier applied to all wealth gains. Use for events.',
    constraints: { min: 0.1, max: 10.0 },
    is_sensitive: false,
  },
  {
    key: 'economy_xp_multiplier',
    value: 1.0,
    value_type: 'number',
    category: 'economy',
    label: 'Global XP Multiplier',
    description: 'Multiplier applied to all XP gains. Use for events.',
    constraints: { min: 0.1, max: 10.0 },
    is_sensitive: false,
  },
  {
    key: 'economy_rob_success_modifier',
    value: 0,
    value_type: 'number',
    category: 'economy',
    label: 'Rob Success Modifier (%)',
    description: 'Added to base rob success rate. Positive = easier, negative = harder.',
    constraints: { min: -30, max: 30 },
    is_sensitive: false,
  },

  // Display Settings
  {
    key: 'display_motd',
    value: '',
    value_type: 'string',
    category: 'display',
    label: 'Message of the Day',
    description: 'Shown on dashboard. Leave empty to hide.',
    is_sensitive: false,
  },
  {
    key: 'display_announcement',
    value: null,
    value_type: 'json',
    category: 'display',
    label: 'Site Announcement',
    description: 'Banner announcement. JSON: { text, type, link? }',
    is_sensitive: false,
  },
];

async function seedAdminSettings() {
  console.log('Seeding admin settings...');

  for (const setting of INITIAL_SETTINGS) {
    await prisma.admin_settings.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        value_type: setting.value_type,
        category: setting.category,
        label: setting.label,
        description: setting.description,
        constraints: setting.constraints || null,
        is_sensitive: setting.is_sensitive,
      },
    });
  }

  console.log(`Seeded ${INITIAL_SETTINGS.length} admin settings`);
}

seedAdminSettings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 2.4 Migration Steps

```bash
# 1. Generate migration
cd web
npx prisma migrate dev --name add_admin_panel_tables

# 2. Seed initial settings
npx tsx prisma/seed-admin.ts

# 3. Grant yourself owner access (replace USER_ID)
npx prisma db execute --stdin <<EOF
INSERT INTO admin_users (user_id, role, notes, granted_at)
VALUES (YOUR_USER_ID, 'owner', 'Initial owner setup', NOW());
EOF
```

---

## 3. Authentication & Authorization

### 3.1 Admin Roles

| Role | Permissions |
|------|-------------|
| **owner** | Full access to all admin functions |
| **moderator** | Player management, view logs, limited settings |

### 3.2 Permission Matrix

| Action | Owner | Moderator |
|--------|-------|-----------|
| View dashboard | ✅ | ✅ |
| Search players | ✅ | ✅ |
| Edit player wealth/XP | ✅ | ✅ (< $10,000) |
| Ban/unban players | ✅ | ✅ |
| Edit global settings | ✅ | ❌ |
| Toggle maintenance mode | ✅ | ❌ |
| View audit logs | ✅ | ✅ (own actions only) |
| Edit game content | ✅ | ❌ |
| Grant admin access | ✅ | ❌ |

### 3.3 Auth Middleware Implementation

Create `web/src/lib/admin/auth.ts`:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export type AdminRole = 'owner' | 'moderator';

export interface AdminSession {
  userId: number;
  username: string;
  role: AdminRole;
  permissions?: Record<string, boolean>;
}

/**
 * Get admin session or null if not an admin
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const userId = parseInt(session.user.id);

  const adminUser = await prisma.admin_users.findUnique({
    where: { user_id: userId },
    include: { users: { select: { username: true } } },
  });

  if (!adminUser || adminUser.revoked_at) {
    return null;
  }

  return {
    userId,
    username: adminUser.users.username,
    role: adminUser.role as AdminRole,
    permissions: adminUser.permissions as Record<string, boolean> | undefined,
  };
}

/**
 * Require admin access - returns session or throws redirect
 */
export async function requireAdmin(minRole?: AdminRole): Promise<AdminSession> {
  const admin = await getAdminSession();

  if (!admin) {
    throw new Error('UNAUTHORIZED');
  }

  if (minRole === 'owner' && admin.role !== 'owner') {
    throw new Error('FORBIDDEN');
  }

  return admin;
}

/**
 * Check if admin can perform specific action
 */
export function canPerform(
  admin: AdminSession,
  action: string,
  context?: { amount?: number }
): boolean {
  // Owners can do everything
  if (admin.role === 'owner') return true;

  // Check custom permissions override
  if (admin.permissions?.[action] !== undefined) {
    return admin.permissions[action];
  }

  // Default moderator permissions
  const moderatorAllowed: Record<string, boolean | ((ctx: any) => boolean)> = {
    'view_dashboard': true,
    'search_players': true,
    'view_player': true,
    'edit_player_wealth': (ctx) => (ctx?.amount || 0) <= 10000,
    'edit_player_xp': (ctx) => (ctx?.amount || 0) <= 10000,
    'ban_player': true,
    'unban_player': true,
    'view_own_logs': true,
  };

  const permission = moderatorAllowed[action];
  if (typeof permission === 'function') {
    return permission(context);
  }
  return permission ?? false;
}

/**
 * API route wrapper for admin endpoints
 */
export function withAdminAuth(
  handler: (req: NextRequest, admin: AdminSession) => Promise<NextResponse>,
  options?: { minRole?: AdminRole }
) {
  return async (req: NextRequest) => {
    try {
      const admin = await requireAdmin(options?.minRole);
      return await handler(req, admin);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'UNAUTHORIZED') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (error.message === 'FORBIDDEN') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      console.error('Admin auth error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  };
}
```

### 3.4 Client-Side Auth Hook

Create `web/src/hooks/useAdminAuth.ts`:

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

interface AdminStatus {
  isAdmin: boolean;
  role: 'owner' | 'moderator' | null;
  isLoading: boolean;
}

export function useAdminAuth(): AdminStatus {
  const { data: session, status } = useSession();

  const { data: adminData, isLoading: isAdminLoading } = useQuery({
    queryKey: ['admin-status', session?.user?.id],
    queryFn: async () => {
      const res = await fetch('/api/admin/status');
      if (!res.ok) return { isAdmin: false, role: null };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    isAdmin: adminData?.isAdmin ?? false,
    role: adminData?.role ?? null,
    isLoading: status === 'loading' || isAdminLoading,
  };
}
```

---

## 4. Phase 1: Core Admin Functions

### 4.1 Dashboard Overview

**Route:** `/admin` (page.tsx)

**Features:**
- Total registered users
- Active users (24h)
- Total wealth in circulation
- Current Juicernaut (if streaming)
- Recent admin actions (last 10)
- Quick action buttons

**API Endpoint:** `GET /api/admin/dashboard`

```typescript
interface DashboardStats {
  users: {
    total: number;
    active24h: number;
    newToday: number;
    banned: number;
  };
  economy: {
    totalWealth: bigint;
    totalXp: bigint;
    avgWealth: number;
    wealthChange24h: bigint;
  };
  streaming: {
    isLive: boolean;
    currentJuicernaut: { id: number; username: string } | null;
    sessionId: number | null;
  };
  recentActions: AuditLogEntry[];
}
```

**Implementation Steps:**

1. Create `web/src/app/api/admin/dashboard/route.ts`:
   ```typescript
   export const GET = withAdminAuth(async (req, admin) => {
     const [userStats, economyStats, streamingStatus, recentActions] = await Promise.all([
       getUserStats(),
       getEconomyStats(),
       getStreamingStatus(),
       getRecentAdminActions(10),
     ]);

     return NextResponse.json({
       users: userStats,
       economy: economyStats,
       streaming: streamingStatus,
       recentActions,
     });
   });
   ```

2. Create stats query functions in `web/src/lib/admin/stats.ts`

3. Build dashboard UI with stat cards and recent activity list

### 4.2 Player Management

**Route:** `/admin/players` (search) and `/admin/players/[id]` (editor)

**Features:**

| Feature | Description |
|---------|-------------|
| Search | By username, ID, Kick/Twitch/Discord ID |
| View Profile | All player stats, inventory, history |
| Edit Stats | Wealth, XP, level (auto-calculated), HP |
| Edit Faction | Change or remove faction |
| Clear Cooldowns | Remove all active cooldowns |
| Ban/Unban | With reason and optional duration |
| View History | Recent game events, gambling, transactions |

**API Endpoints:**

```
GET    /api/admin/players?q=search&page=1&limit=20
GET    /api/admin/players/[id]
PATCH  /api/admin/players/[id]
POST   /api/admin/players/[id]/ban
DELETE /api/admin/players/[id]/ban
POST   /api/admin/players/[id]/clear-cooldowns
POST   /api/admin/players/[id]/grant-item
POST   /api/admin/players/[id]/grant-crate
```

**Player Editor Fields:**

```typescript
interface PlayerEditPayload {
  wealth?: number;          // Absolute value or delta with +/-
  xp?: number;              // Absolute value or delta
  hp?: number;              // 0-100
  faction_id?: number | null;
  checkin_streak?: number;
  kingpin_name?: string;
}

interface BanPayload {
  reason: string;
  duration_hours?: number;  // null = permanent
}
```

**Implementation Steps:**

1. Create search API with pagination:
   ```typescript
   // Supports: ?q=username, ?q=id:123, ?q=kick:abc, ?q=discord:123
   export const GET = withAdminAuth(async (req, admin) => {
     const { searchParams } = new URL(req.url);
     const query = searchParams.get('q') || '';
     const page = parseInt(searchParams.get('page') || '1');
     const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

     const results = await searchPlayers(query, { page, limit });
     return NextResponse.json(results);
   });
   ```

2. Create player detail endpoint with full data aggregation

3. Create PATCH endpoint with validation and audit logging:
   ```typescript
   export const PATCH = withAdminAuth(async (req, admin) => {
     const { id } = params;
     const body = await req.json();

     // Validate permissions
     if (body.wealth && Math.abs(body.wealth) > 10000) {
       if (!canPerform(admin, 'edit_player_wealth', { amount: body.wealth })) {
         return NextResponse.json({ error: 'Amount exceeds your permission' }, { status: 403 });
       }
     }

     // Get old values for audit
     const oldPlayer = await prisma.users.findUnique({ where: { id: parseInt(id) } });

     // Apply changes in transaction
     const updated = await prisma.$transaction(async (tx) => {
       // Update player
       const player = await tx.users.update({
         where: { id: parseInt(id) },
         data: buildUpdateData(body),
       });

       // Create audit log
       await tx.admin_audit_log.create({
         data: {
           admin_id: admin.userId,
           admin_name: admin.username,
           action: 'PLAYER_EDIT',
           category: 'player',
           target_type: 'user',
           target_id: id,
           target_name: oldPlayer.username,
           old_value: extractChangedFields(oldPlayer, body),
           new_value: extractChangedFields(player, body),
           ip_address: getClientIP(req),
           reason: body.reason,
         },
       });

       return player;
     });

     return NextResponse.json(updated);
   });
   ```

4. Build PlayerSearch component with filters

5. Build PlayerEditor component with form validation

### 4.3 Global Settings

**Route:** `/admin/settings`

**Features:**

| Category | Settings |
|----------|----------|
| Features | Maintenance mode, gambling, robbery, heists, missions, registration |
| Economy | Wealth multiplier, XP multiplier, rob success modifier |
| Display | MOTD, site announcement |

**API Endpoints:**

```
GET   /api/admin/settings
PATCH /api/admin/settings
```

**Implementation Steps:**

1. Create settings API:
   ```typescript
   export const GET = withAdminAuth(async (req, admin) => {
     const settings = await prisma.admin_settings.findMany({
       orderBy: [{ category: 'asc' }, { key: 'asc' }],
     });

     // Group by category
     const grouped = settings.reduce((acc, s) => {
       if (!acc[s.category]) acc[s.category] = [];
       acc[s.category].push({
         key: s.key,
         value: s.value,
         type: s.value_type,
         label: s.label,
         description: s.description,
         constraints: s.constraints,
       });
       return acc;
     }, {} as Record<string, any[]>);

     return NextResponse.json(grouped);
   });

   export const PATCH = withAdminAuth(async (req, admin) => {
     const updates = await req.json(); // { key: value, ... }

     // Only owners can change settings
     if (admin.role !== 'owner') {
       return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
     }

     await prisma.$transaction(async (tx) => {
       for (const [key, value] of Object.entries(updates)) {
         const existing = await tx.admin_settings.findUnique({ where: { key } });
         if (!existing) continue;

         // Validate constraints
         if (existing.constraints) {
           const constraints = existing.constraints as any;
           if (constraints.min !== undefined && value < constraints.min) continue;
           if (constraints.max !== undefined && value > constraints.max) continue;
         }

         await tx.admin_settings.update({
           where: { key },
           data: { value, updated_by: admin.userId, updated_at: new Date() },
         });

         // Audit log
         await tx.admin_audit_log.create({
           data: {
             admin_id: admin.userId,
             admin_name: admin.username,
             action: 'SETTING_CHANGE',
             category: 'setting',
             target_type: 'setting',
             target_id: key,
             target_name: existing.label,
             old_value: existing.value,
             new_value: value,
             ip_address: getClientIP(req),
           },
         });
       }
     });

     return NextResponse.json({ success: true });
   }, { minRole: 'owner' });
   ```

2. Create settings service for reading settings throughout app:
   ```typescript
   // web/src/lib/admin/settings.ts
   import { prisma } from '@/lib/prisma';

   const settingsCache = new Map<string, { value: any; expires: number }>();
   const CACHE_TTL = 30_000; // 30 seconds

   export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
     const cached = settingsCache.get(key);
     if (cached && cached.expires > Date.now()) {
       return cached.value as T;
     }

     const setting = await prisma.admin_settings.findUnique({ where: { key } });
     const value = setting?.value ?? defaultValue;

     settingsCache.set(key, { value, expires: Date.now() + CACHE_TTL });
     return value as T;
   }

   export async function isFeatureEnabled(feature: string): Promise<boolean> {
     return getSetting(`feature_${feature}`, true);
   }

   export async function getMultiplier(type: 'wealth' | 'xp'): Promise<number> {
     return getSetting(`economy_${type}_multiplier`, 1.0);
   }

   export function invalidateSettingsCache(): void {
     settingsCache.clear();
   }
   ```

3. Build SettingsPanel with grouped toggles and number inputs

### 4.4 Audit Log Viewer

**Route:** `/admin/logs`

**Features:**
- Filterable by: admin, action type, category, date range, target
- Paginated results
- Expandable rows showing old/new values
- Export to CSV

**API Endpoint:** `GET /api/admin/logs`

```typescript
interface AuditLogQuery {
  admin_id?: number;
  category?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

interface AuditLogEntry {
  id: number;
  admin_name: string;
  action: string;
  category: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  old_value: any;
  new_value: any;
  reason: string | null;
  created_at: string;
}
```

**Implementation Steps:**

1. Create logs API with filtering
2. Build AuditLogTable component with expandable rows
3. Add CSV export functionality

---

## 5. Phase 2: Game Configuration

### 5.1 Economy Controls

**Route:** `/admin/economy`

**Features:**

| Feature | Description |
|---------|-------------|
| Stats Overview | Total wealth, distribution chart, flow analysis |
| Manual Adjustment | Add/remove wealth to individual or bulk players |
| Jackpot Management | View/reset slot jackpot pool |
| Lottery Admin | View current draws, force draw |

**API Endpoints:**

```
GET  /api/admin/economy/stats
POST /api/admin/economy/adjust
GET  /api/admin/economy/jackpot
POST /api/admin/economy/jackpot/reset
GET  /api/admin/economy/lottery
POST /api/admin/economy/lottery/draw
```

**Implementation Steps:**

1. Create economy stats aggregation queries
2. Build adjustment form with confirmation dialog
3. Add jackpot and lottery management sections

### 5.2 Content Management

**Route:** `/admin/content/*`

**Features:**

| Content Type | Management |
|--------------|------------|
| Heist Trivia | Add/edit/disable questions |
| Heist Riddles | Add/edit/disable riddles |
| Quick Grab | Add/edit/disable phrases |
| Items | View catalog (read-only for now) |
| Achievements | View catalog (read-only for now) |

**API Endpoints:**

```
GET    /api/admin/content/heists/trivia
POST   /api/admin/content/heists/trivia
PATCH  /api/admin/content/heists/trivia/[id]
DELETE /api/admin/content/heists/trivia/[id]
# Similar for riddles and quick-grab
```

**Implementation Steps:**

1. Create CRUD APIs for heist content
2. Build content editor forms
3. Add bulk import functionality (CSV)

---

## 6. Phase 3: Operations & Analytics

### 6.1 Live Dashboard

**Route:** `/admin` (enhanced)

**Features:**
- Real-time active user count
- Current stream status
- Recent transactions feed
- Error/alert notifications

**Implementation:**
- Use polling (30s interval) for live data
- WebSocket optional for future enhancement

### 6.2 Analytics

**Route:** `/admin/analytics` (future)

**Features:**
- User growth over time
- Economy health metrics
- Feature usage statistics
- Platform breakdown (Kick vs Twitch vs Discord)

---

## 7. Safety Mechanisms

### 7.1 Confirmation Dialogs

**Trigger Conditions:**

| Action | Confirmation Type |
|--------|-------------------|
| Wealth adjustment > $10,000 | Type-to-confirm: "GRANT-10000" |
| Permanent ban | Type-to-confirm: "BAN-{username}" |
| Reset player progress | Type-to-confirm: "RESET-{username}" |
| Toggle maintenance mode | Standard confirm dialog |
| Change economy multipliers | Standard confirm dialog |

**Implementation:**

```typescript
// web/src/components/admin/ConfirmDialog.tsx
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;           // Button text
  typeToConfirm?: string;         // If set, user must type this
  variant?: 'warning' | 'danger';
}
```

### 7.2 Rate Limiting

**Limits:**

| Endpoint Category | Limit |
|-------------------|-------|
| Read operations | 100/minute |
| Write operations | 20/minute |
| Bulk operations | 5/minute |

**Implementation:**
Use existing rate limiting middleware or add admin-specific limits.

### 7.3 Session Validation

- Verify admin status on every request (not just initial load)
- Invalidate admin sessions if role is revoked
- Log all admin session starts/ends

---

## 8. API Route Reference

### 8.1 Complete Route Map

```
/api/admin/
├── status                    GET     Check admin status
├── dashboard                 GET     Dashboard stats
├── players                   GET     Search players
├── players/[id]              GET     Player details
├── players/[id]              PATCH   Edit player
├── players/[id]/ban          POST    Ban player
├── players/[id]/ban          DELETE  Unban player
├── players/[id]/clear-cooldowns POST Clear cooldowns
├── players/[id]/grant-item   POST    Grant item
├── players/[id]/grant-crate  POST    Grant crate
├── settings                  GET     Get all settings
├── settings                  PATCH   Update settings
├── economy/stats             GET     Economy statistics
├── economy/adjust            POST    Manual adjustment
├── economy/jackpot           GET     Jackpot status
├── economy/jackpot/reset     POST    Reset jackpot
├── economy/lottery           GET     Lottery status
├── economy/lottery/draw      POST    Force lottery draw
├── content/heists/trivia     GET     List trivia
├── content/heists/trivia     POST    Add trivia
├── content/heists/trivia/[id] PATCH  Edit trivia
├── content/heists/trivia/[id] DELETE Delete trivia
├── content/heists/riddles    GET     List riddles
├── content/heists/riddles    POST    Add riddle
├── content/heists/riddles/[id] PATCH Edit riddle
├── content/heists/riddles/[id] DELETE Delete riddle
├── content/heists/quickgrab  GET     List quick-grab
├── content/heists/quickgrab  POST    Add phrase
├── content/heists/quickgrab/[id] PATCH Edit phrase
├── content/heists/quickgrab/[id] DELETE Delete phrase
├── logs                      GET     Audit logs (filtered)
└── logs/export               GET     Export logs CSV
```

### 8.2 Standard Response Format

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Human readable message',
    details?: { ... }
  }
}

// Paginated
{
  success: true,
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  }
}
```

---

## 9. UI Component Specifications

### 9.1 Admin Layout

```typescript
// web/src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 9.2 Sidebar Navigation

```typescript
const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/players', icon: Users, label: 'Players' },
  { href: '/admin/settings', icon: Settings, label: 'Settings', ownerOnly: true },
  { href: '/admin/economy', icon: DollarSign, label: 'Economy', ownerOnly: true },
  { href: '/admin/content', icon: FileText, label: 'Content', ownerOnly: true },
  { href: '/admin/logs', icon: ScrollText, label: 'Audit Logs' },
];
```

### 9.3 Key Components

| Component | Purpose |
|-----------|---------|
| `StatCard` | Display single statistic with trend |
| `PlayerSearch` | Search input with results dropdown |
| `PlayerEditor` | Form for editing player stats |
| `SettingsPanel` | Grouped settings with toggles/inputs |
| `AuditLogTable` | Paginated, filterable log viewer |
| `ConfirmDialog` | Confirmation modal with type-to-confirm |
| `QuickActions` | Common action buttons |

### 9.4 Design Tokens

Follow existing Kingpin dark theme:

```css
/* Admin-specific additions */
--admin-accent: #f59e0b;     /* Amber for admin elements */
--admin-danger: #ef4444;     /* Red for destructive actions */
--admin-success: #22c55e;    /* Green for success states */
--admin-warning: #eab308;    /* Yellow for warnings */
```

---

## 10. Testing Requirements

### 10.1 Unit Tests

| Module | Test Coverage |
|--------|---------------|
| Admin auth utilities | Permission checks, role validation |
| Settings service | Cache behavior, default values |
| Audit logging | Log creation, sensitive data masking |

### 10.2 Integration Tests

| Test Case | Description |
|-----------|-------------|
| Non-admin access | Verify 401 on all admin routes |
| Moderator limits | Verify 403 on owner-only actions |
| Player edit audit | Verify audit log created on edit |
| Settings cache | Verify cache invalidation |

### 10.3 E2E Tests

| Flow | Steps |
|------|-------|
| Player ban | Search → Select → Ban → Verify status |
| Setting toggle | Open settings → Toggle feature → Verify effect |
| Audit trail | Perform action → View in logs → Verify details |

---

## Implementation Checklist

### Phase 1 (MVP)

- [ ] Database migration (admin tables)
- [ ] Seed initial settings
- [ ] Admin auth middleware
- [ ] `/api/admin/status` endpoint
- [ ] `/api/admin/dashboard` endpoint
- [ ] `/api/admin/players/*` endpoints
- [ ] `/api/admin/settings` endpoints
- [ ] `/api/admin/logs` endpoint
- [ ] Admin layout component
- [ ] Dashboard page
- [ ] Player search page
- [ ] Player editor page
- [ ] Settings page
- [ ] Audit logs page
- [ ] Confirmation dialog component

### Phase 2

- [ ] Economy stats endpoints
- [ ] Manual adjustment functionality
- [ ] Jackpot management
- [ ] Lottery administration
- [ ] Heist content CRUD
- [ ] Content management UI

### Phase 3

- [ ] Real-time dashboard updates
- [ ] Analytics endpoints
- [ ] Analytics visualizations
- [ ] Alert system
- [ ] CSV export functionality

---

## Security Checklist

- [ ] All admin routes use `withAdminAuth` wrapper
- [ ] Permission checks before every write operation
- [ ] Audit log for every state change
- [ ] Rate limiting on admin endpoints
- [ ] Input validation on all payloads
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (React auto-escaping)
- [ ] CSRF protection (NextAuth handles)
- [ ] Sensitive data masked in audit logs
- [ ] Admin session timeout (8 hours)

---

*Document generated for Kingpin Admin Panel implementation*
*Last updated: December 18, 2024*
