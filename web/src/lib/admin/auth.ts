import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// =============================================================================
// Types
// =============================================================================

export type AdminRole = 'owner' | 'moderator';

export interface AdminSession {
  userId: number;
  username: string;
  role: AdminRole;
  permissions?: Record<string, boolean>;
}

export interface AdminContext {
  admin: AdminSession;
  ip: string | null;
  userAgent: string | null;
}

// =============================================================================
// Session Functions
// =============================================================================

/**
 * Get admin session or null if user is not an admin
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const userId = session.user.id;

  const adminUser = await prisma.admin_users.findUnique({
    where: { user_id: userId },
    include: { users: { select: { username: true } } },
  });

  // Check if user is admin and not revoked
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
 * Require admin access - returns session or throws
 */
export async function requireAdmin(minRole?: AdminRole): Promise<AdminSession> {
  const admin = await getAdminSession();

  if (!admin) {
    throw new AdminAuthError('UNAUTHORIZED', 'Admin access required');
  }

  if (minRole === 'owner' && admin.role !== 'owner') {
    throw new AdminAuthError('FORBIDDEN', 'Owner access required');
  }

  return admin;
}

/**
 * Get full admin context including IP and user agent
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const admin = await getAdminSession();
  if (!admin) return null;

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headersList.get('x-real-ip')
    || null;
  const userAgent = headersList.get('user-agent') || null;

  return { admin, ip, userAgent };
}

// =============================================================================
// Permission Checking
// =============================================================================

/**
 * Default moderator permissions
 */
const MODERATOR_PERMISSIONS: Record<string, boolean | ((ctx?: { amount?: number }) => boolean)> = {
  // Dashboard
  view_dashboard: true,

  // Players
  search_players: true,
  view_player: true,
  edit_player_wealth: (ctx) => Math.abs(ctx?.amount || 0) <= 10000,
  edit_player_xp: (ctx) => Math.abs(ctx?.amount || 0) <= 10000,
  edit_player_hp: true,
  edit_player_faction: false,
  clear_player_cooldowns: true,
  ban_player: true,
  unban_player: true,
  grant_item: false,
  grant_crate: false,

  // Settings
  view_settings: true,
  edit_settings: false,

  // Logs
  view_all_logs: false,
  view_own_logs: true,

  // Economy
  view_economy: true,
  adjust_economy: false,
  reset_jackpot: false,
  force_lottery: false,

  // Content
  view_content: true,
  edit_content: false,
};

/**
 * Check if admin can perform a specific action
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

  // Check default moderator permissions
  const permission = MODERATOR_PERMISSIONS[action];
  if (permission === undefined) return false;
  if (typeof permission === 'function') {
    return permission(context);
  }
  return permission;
}

/**
 * Require specific permission - throws if not allowed
 */
export function requirePermission(
  admin: AdminSession,
  action: string,
  context?: { amount?: number }
): void {
  if (!canPerform(admin, action, context)) {
    throw new AdminAuthError('FORBIDDEN', `Permission denied: ${action}`);
  }
}

// =============================================================================
// API Route Wrapper
// =============================================================================

type AdminHandler = (
  req: NextRequest,
  context: AdminContext
) => Promise<NextResponse>;

interface WithAdminAuthOptions {
  minRole?: AdminRole;
  requiredPermission?: string;
}

/**
 * Wrap an API route handler with admin authentication
 */
export function withAdminAuth(
  handler: AdminHandler,
  options?: WithAdminAuthOptions
) {
  return async (req: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      // Get admin context
      const adminContext = await getAdminContext();

      if (!adminContext) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
          { status: 401 }
        );
      }

      // Check minimum role
      if (options?.minRole === 'owner' && adminContext.admin.role !== 'owner') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Owner access required' } },
          { status: 403 }
        );
      }

      // Check required permission
      if (options?.requiredPermission) {
        if (!canPerform(adminContext.admin, options.requiredPermission)) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: `Permission denied: ${options.requiredPermission}` } },
            { status: 403 }
          );
        }
      }

      // Call the actual handler
      return await handler(req, adminContext);
    } catch (error) {
      if (error instanceof AdminAuthError) {
        const status = error.code === 'UNAUTHORIZED' ? 401 : 403;
        return NextResponse.json(
          { success: false, error: { code: error.code, message: error.message } },
          { status }
        );
      }

      console.error('Admin handler error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
        { status: 500 }
      );
    }
  };
}

// =============================================================================
// Error Class
// =============================================================================

export class AdminAuthError extends Error {
  constructor(
    public code: 'UNAUTHORIZED' | 'FORBIDDEN',
    message: string
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if user is banned
 */
export async function isUserBanned(userId: number): Promise<boolean> {
  const activeBan = await prisma.player_bans.findFirst({
    where: {
      user_id: userId,
      is_active: true,
      OR: [
        { expires_at: null }, // Permanent
        { expires_at: { gt: new Date() } }, // Not expired
      ],
    },
  });

  return !!activeBan;
}

/**
 * Get client IP from request
 */
export function getClientIP(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null;
}
