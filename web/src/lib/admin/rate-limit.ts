// =============================================================================
// Admin Rate Limiting
// In-memory sliding window rate limiter for admin endpoints
// =============================================================================

import { ADMIN_RATE_LIMITS } from './constants';

// =============================================================================
// Types
// =============================================================================

export type RateLimitType = 'read' | 'write' | 'bulk';

interface RateLimitEntry {
  timestamps: number[];
  blocked_until?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // Unix timestamp when window resets
  retryAfter?: number; // Seconds until retry allowed (if blocked)
}

// =============================================================================
// Storage
// =============================================================================

// In-memory store: Map<userId, Map<type, RateLimitEntry>>
const rateLimitStore = new Map<number, Map<RateLimitType, RateLimitEntry>>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const WINDOW_MS = 60 * 1000; // 1 minute sliding window

// Cleanup old entries periodically
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS * 2; // Keep 2 windows of data

    for (const [userId, typeMap] of rateLimitStore.entries()) {
      for (const [type, entry] of typeMap.entries()) {
        // Remove old timestamps
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

        // Clear expired blocks
        if (entry.blocked_until && entry.blocked_until < now) {
          entry.blocked_until = undefined;
        }

        // Remove empty entries
        if (entry.timestamps.length === 0 && !entry.blocked_until) {
          typeMap.delete(type);
        }
      }

      // Remove empty user entries
      if (typeMap.size === 0) {
        rateLimitStore.delete(userId);
      }
    }
  }, CLEANUP_INTERVAL);
}

// =============================================================================
// Rate Limit Functions
// =============================================================================

/**
 * Check if request is allowed and update rate limit state
 */
export function checkRateLimit(
  userId: number,
  type: RateLimitType
): RateLimitResult {
  scheduleCleanup();

  const now = Date.now();
  const limit = ADMIN_RATE_LIMITS[type];
  const windowStart = now - WINDOW_MS;

  // Get or create user entry
  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, new Map());
  }
  const userLimits = rateLimitStore.get(userId)!;

  // Get or create type entry
  if (!userLimits.has(type)) {
    userLimits.set(type, { timestamps: [] });
  }
  const entry = userLimits.get(type)!;

  // Check if blocked
  if (entry.blocked_until && entry.blocked_until > now) {
    const retryAfter = Math.ceil((entry.blocked_until - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      reset: entry.blocked_until,
      retryAfter,
    };
  }

  // Clear expired block
  if (entry.blocked_until) {
    entry.blocked_until = undefined;
  }

  // Filter timestamps to current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  // Check limit
  if (entry.timestamps.length >= limit) {
    // Apply progressive backoff for repeated violations
    const violations = entry.timestamps.length - limit + 1;
    const blockDuration = Math.min(violations * 10 * 1000, 60 * 1000); // 10s per violation, max 60s
    entry.blocked_until = now + blockDuration;

    return {
      allowed: false,
      remaining: 0,
      reset: entry.blocked_until,
      retryAfter: Math.ceil(blockDuration / 1000),
    };
  }

  // Allow request and record timestamp
  entry.timestamps.push(now);
  const remaining = limit - entry.timestamps.length;

  // Calculate when oldest timestamp in window expires
  const oldestInWindow = entry.timestamps[0] || now;
  const reset = oldestInWindow + WINDOW_MS;

  return {
    allowed: true,
    remaining,
    reset,
  };
}

/**
 * Get current rate limit status without consuming
 */
export function getRateLimitStatus(
  userId: number,
  type: RateLimitType
): RateLimitResult {
  const now = Date.now();
  const limit = ADMIN_RATE_LIMITS[type];
  const windowStart = now - WINDOW_MS;

  const userLimits = rateLimitStore.get(userId);
  if (!userLimits) {
    return {
      allowed: true,
      remaining: limit,
      reset: now + WINDOW_MS,
    };
  }

  const entry = userLimits.get(type);
  if (!entry) {
    return {
      allowed: true,
      remaining: limit,
      reset: now + WINDOW_MS,
    };
  }

  // Check if blocked
  if (entry.blocked_until && entry.blocked_until > now) {
    return {
      allowed: false,
      remaining: 0,
      reset: entry.blocked_until,
      retryAfter: Math.ceil((entry.blocked_until - now) / 1000),
    };
  }

  // Count current window
  const currentCount = entry.timestamps.filter((t) => t > windowStart).length;
  const remaining = Math.max(0, limit - currentCount);

  return {
    allowed: remaining > 0,
    remaining,
    reset: (entry.timestamps[0] || now) + WINDOW_MS,
  };
}

/**
 * Reset rate limit for a user (admin override)
 */
export function resetRateLimit(userId: number, type?: RateLimitType): void {
  const userLimits = rateLimitStore.get(userId);
  if (!userLimits) return;

  if (type) {
    userLimits.delete(type);
  } else {
    rateLimitStore.delete(userId);
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  type: RateLimitType
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': ADMIN_RATE_LIMITS[type].toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.reset / 1000).toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

// =============================================================================
// Export rate limit info for clients
// =============================================================================

export const RATE_LIMIT_INFO = {
  read: {
    limit: ADMIN_RATE_LIMITS.read,
    window: '1 minute',
    description: 'GET requests',
  },
  write: {
    limit: ADMIN_RATE_LIMITS.write,
    window: '1 minute',
    description: 'POST/PATCH/DELETE requests',
  },
  bulk: {
    limit: ADMIN_RATE_LIMITS.bulk,
    window: '1 minute',
    description: 'Bulk operations',
  },
} as const;
