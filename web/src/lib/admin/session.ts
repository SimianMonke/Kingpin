// =============================================================================
// Admin Session Management
// Implements 8-hour session timeout for admin access
// =============================================================================

import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

// =============================================================================
// Constants
// =============================================================================

const ADMIN_SESSION_COOKIE = 'admin_session_start';
const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const ADMIN_SESSION_COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds (for cookie)

// In-memory session store for additional validation
// Maps: admin_user_id -> { startTime, lastActivity }
const adminSessions = new Map<number, { startTime: number; lastActivity: number }>();

// =============================================================================
// Session Functions
// =============================================================================

/**
 * Start or refresh an admin session
 * Called when admin successfully authenticates
 */
export async function startAdminSession(userId: number): Promise<void> {
  const now = Date.now();

  // Set cookie with session start time
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, now.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_COOKIE_MAX_AGE,
    path: '/admin',
  });

  // Update in-memory store
  adminSessions.set(userId, {
    startTime: now,
    lastActivity: now,
  });

  // Log session start to audit (fire-and-forget)
  logAdminSessionStart(userId).catch(() => {});
}

/**
 * Validate admin session is still within timeout window
 * Returns true if session is valid, false if expired
 */
export async function validateAdminSession(userId: number): Promise<{
  valid: boolean;
  remainingMs?: number;
  reason?: string;
}> {
  const now = Date.now();

  // Check cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);

  if (!sessionCookie?.value) {
    // No session cookie - first admin access, start new session
    await startAdminSession(userId);
    return { valid: true, remainingMs: ADMIN_SESSION_MAX_AGE };
  }

  const sessionStart = parseInt(sessionCookie.value, 10);
  if (isNaN(sessionStart)) {
    // Invalid cookie value - start new session
    await startAdminSession(userId);
    return { valid: true, remainingMs: ADMIN_SESSION_MAX_AGE };
  }

  // Check if session has expired
  const sessionAge = now - sessionStart;
  if (sessionAge > ADMIN_SESSION_MAX_AGE) {
    // Session expired
    await endAdminSession(userId);
    return {
      valid: false,
      reason: 'Admin session expired. Please re-authenticate.',
    };
  }

  // Session is valid - update last activity in memory
  const memSession = adminSessions.get(userId);
  if (memSession) {
    memSession.lastActivity = now;
  } else {
    // Restore memory session from cookie
    adminSessions.set(userId, {
      startTime: sessionStart,
      lastActivity: now,
    });
  }

  const remainingMs = ADMIN_SESSION_MAX_AGE - sessionAge;
  return { valid: true, remainingMs };
}

/**
 * End an admin session (logout or timeout)
 */
export async function endAdminSession(userId: number): Promise<void> {
  // Remove cookie
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);

  // Remove from memory
  adminSessions.delete(userId);

  // Log session end (fire-and-forget)
  logAdminSessionEnd(userId).catch(() => {});
}

/**
 * Get session info for display (e.g., in admin header)
 */
export async function getAdminSessionInfo(userId: number): Promise<{
  isActive: boolean;
  startedAt?: Date;
  expiresAt?: Date;
  remainingMinutes?: number;
} | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  const sessionStart = parseInt(sessionCookie.value, 10);
  if (isNaN(sessionStart)) {
    return null;
  }

  const now = Date.now();
  const expiresAt = sessionStart + ADMIN_SESSION_MAX_AGE;
  const remainingMs = expiresAt - now;

  if (remainingMs <= 0) {
    return { isActive: false };
  }

  return {
    isActive: true,
    startedAt: new Date(sessionStart),
    expiresAt: new Date(expiresAt),
    remainingMinutes: Math.ceil(remainingMs / 60000),
  };
}

/**
 * Extend session by resetting the timeout
 * Only allowed if session is still valid and within last 2 hours
 */
export async function extendAdminSession(userId: number): Promise<boolean> {
  const validation = await validateAdminSession(userId);

  if (!validation.valid) {
    return false;
  }

  // Only allow extension if less than 2 hours remaining
  if (validation.remainingMs && validation.remainingMs > 2 * 60 * 60 * 1000) {
    return false; // Session still has plenty of time
  }

  // Start new session (effectively extending it)
  await startAdminSession(userId);
  return true;
}

// =============================================================================
// Audit Logging (Internal)
// =============================================================================

async function logAdminSessionStart(userId: number): Promise<void> {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    await prisma.admin_audit_log.create({
      data: {
        admin_id: userId,
        admin_name: user?.username || 'Unknown',
        action: 'ADMIN_SESSION_START',
        category: 'system',
        target_type: 'user',
        target_id: userId.toString(),
        target_name: user?.username,
      },
    });
  } catch (error) {
    console.error('Failed to log admin session start:', error);
  }
}

async function logAdminSessionEnd(userId: number): Promise<void> {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    await prisma.admin_audit_log.create({
      data: {
        admin_id: userId,
        admin_name: user?.username || 'Unknown',
        action: 'ADMIN_SESSION_END',
        category: 'system',
        target_type: 'user',
        target_id: userId.toString(),
        target_name: user?.username,
        reason: 'Session timeout or logout',
      },
    });
  } catch (error) {
    console.error('Failed to log admin session end:', error);
  }
}

// =============================================================================
// Cleanup (for memory management)
// =============================================================================

// Periodically clean up stale in-memory sessions
setInterval(() => {
  const now = Date.now();
  const staleThreshold = ADMIN_SESSION_MAX_AGE + 60 * 60 * 1000; // 9 hours

  for (const [userId, session] of adminSessions.entries()) {
    if (now - session.startTime > staleThreshold) {
      adminSessions.delete(userId);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes
