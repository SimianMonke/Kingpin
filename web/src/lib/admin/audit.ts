import { prisma } from '@/lib/db';
import { AdminContext } from './auth';

// =============================================================================
// Types
// =============================================================================

export type AuditCategory = 'player' | 'setting' | 'economy' | 'content' | 'system';
export type AuditTargetType = 'user' | 'setting' | 'item' | 'crate' | 'faction' | 'heist' | 'jackpot' | 'lottery';

export interface AuditLogEntry {
  action: string;
  category: AuditCategory;
  targetType?: AuditTargetType;
  targetId?: string;
  targetName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface AuditLogRecord {
  id: number;
  admin_id: number;
  admin_name: string;
  action: string;
  category: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  reason: string | null;
  created_at: Date;
}

export interface AuditLogQuery {
  adminId?: number;
  category?: AuditCategory;
  action?: string;
  targetType?: string;
  targetId?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

// =============================================================================
// Audit Logging Functions
// =============================================================================

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  context: AdminContext,
  entry: AuditLogEntry,
  sessionId?: string
): Promise<void> {
  // Mask sensitive values before logging
  const sanitizedOldValue = sanitizeForLog(entry.oldValue, entry.category);
  const sanitizedNewValue = sanitizeForLog(entry.newValue, entry.category);

  await prisma.admin_audit_log.create({
    data: {
      admin_id: context.admin.userId,
      admin_name: context.admin.username,
      action: entry.action,
      category: entry.category,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      target_name: entry.targetName || null,
      old_value: sanitizedOldValue as any,
      new_value: sanitizedNewValue as any,
      ip_address: context.ip,
      user_agent: context.userAgent,
      reason: entry.reason || null,
      session_id: sessionId || null,
    },
  });
}

/**
 * Query audit logs with filtering and pagination
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<{
  logs: AuditLogRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 50, 100);
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (query.adminId) {
    where.admin_id = query.adminId;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.action) {
    where.action = { contains: query.action, mode: 'insensitive' };
  }

  if (query.targetType) {
    where.target_type = query.targetType;
  }

  if (query.targetId) {
    where.target_id = query.targetId;
  }

  if (query.fromDate || query.toDate) {
    where.created_at = {};
    if (query.fromDate) {
      (where.created_at as Record<string, Date>).gte = query.fromDate;
    }
    if (query.toDate) {
      (where.created_at as Record<string, Date>).lte = query.toDate;
    }
  }

  // Execute query
  const [logs, total] = await Promise.all([
    prisma.admin_audit_log.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.admin_audit_log.count({ where }),
  ]);

  return {
    logs: logs as AuditLogRecord[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get recent admin actions for dashboard
 */
export async function getRecentAdminActions(limit: number = 10): Promise<AuditLogRecord[]> {
  const logs = await prisma.admin_audit_log.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return logs as AuditLogRecord[];
}

/**
 * Get audit logs for a specific target
 */
export async function getTargetAuditHistory(
  targetType: AuditTargetType,
  targetId: string,
  limit: number = 20
): Promise<AuditLogRecord[]> {
  const logs = await prisma.admin_audit_log.findMany({
    where: {
      target_type: targetType,
      target_id: targetId,
    },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return logs as AuditLogRecord[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sensitive field patterns - keys containing these will be masked
 */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'private',
  'credential',
  'auth',
  'bearer',
  'session',
  'cookie',
  'ssn',
  'social_security',
];

/**
 * PII field patterns - personally identifiable information
 */
const PII_KEY_PATTERNS = [
  'email',
  'phone',
  'address',
  'ip_address',
  'user_agent',
  'birth',
  'dob',
  'ssn',
];

/**
 * Fields that should show partial masking (last 4 chars visible)
 */
const PARTIAL_MASK_KEYS = [
  'card',
  'account',
  'bank',
];

/**
 * Check if a key matches any sensitive patterns
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

/**
 * Check if a key matches any PII patterns
 */
function isPIIKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return PII_KEY_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

/**
 * Check if a key should be partially masked
 */
function isPartialMaskKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return PARTIAL_MASK_KEYS.some(pattern => lowerKey.includes(pattern));
}

/**
 * Mask a string value based on type
 */
function maskValue(value: unknown, maskType: 'full' | 'partial' | 'pii'): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length === 0) return value;

    switch (maskType) {
      case 'full':
        return '[REDACTED]';
      case 'partial':
        // Show last 4 characters
        if (value.length <= 4) return '****';
        return '*'.repeat(value.length - 4) + value.slice(-4);
      case 'pii':
        // Mask email: show first char and domain
        if (value.includes('@')) {
          const [local, domain] = value.split('@');
          if (local.length > 1) {
            return local[0] + '***@' + domain;
          }
          return '***@' + domain;
        }
        // Mask IP: show first octet
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
          const parts = value.split('.');
          return parts[0] + '.***.***.***';
        }
        // Default PII mask
        if (value.length <= 2) return '**';
        return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
      default:
        return value;
    }
  }

  if (typeof value === 'number') {
    if (maskType === 'full') return 0;
    return value;
  }

  return value;
}

/**
 * Deep sanitize an object, masking sensitive fields
 */
function sanitizeObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  // Prevent infinite recursion
  if (depth > 10) return { '[TRUNCATED]': 'Object too deep' };

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check what type of masking needed
    if (isSensitiveKey(key)) {
      sanitized[key] = maskValue(value, 'full');
    } else if (isPIIKey(key)) {
      sanitized[key] = maskValue(value, 'pii');
    } else if (isPartialMaskKey(key)) {
      sanitized[key] = maskValue(value, 'partial');
    } else if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          item !== null && typeof item === 'object'
            ? sanitizeObject(item as Record<string, unknown>, depth + 1)
            : item
        );
      } else {
        sanitized[key] = sanitizeObject(value as Record<string, unknown>, depth + 1);
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize values before logging to remove sensitive data
 */
function sanitizeForLog(value: unknown, category: AuditCategory): unknown {
  if (value === null || value === undefined) return null;

  // Handle objects
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item =>
        item !== null && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    }
    return sanitizeObject(value as Record<string, unknown>);
  }

  // Primitive values pass through
  return value;
}

/**
 * Extract only changed fields for audit logging
 */
export function extractChangedFields<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: Partial<T>,
  allowedFields?: (keyof T)[]
): Partial<T> {
  const changes: Partial<T> = {};

  for (const key of Object.keys(newObj) as (keyof T)[]) {
    // Skip if not in allowed fields
    if (allowedFields && !allowedFields.includes(key)) continue;

    // Only include if value actually changed
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Compare values (handle BigInt)
    const oldStr = typeof oldVal === 'bigint' ? oldVal.toString() : JSON.stringify(oldVal);
    const newStr = typeof newVal === 'bigint' ? newVal.toString() : JSON.stringify(newVal);

    if (oldStr !== newStr) {
      changes[key] = oldVal;
    }
  }

  return changes;
}

/**
 * Format audit action string
 */
export function formatAuditAction(
  verb: 'CREATE' | 'UPDATE' | 'DELETE' | 'GRANT' | 'REVOKE' | 'BAN' | 'UNBAN' | 'CLEAR' | 'RESET' | 'FORCE',
  noun: string
): string {
  return `${verb}_${noun.toUpperCase()}`;
}

// =============================================================================
// Common Audit Actions
// =============================================================================

export const AUDIT_ACTIONS = {
  // Player actions
  PLAYER_EDIT: 'PLAYER_EDIT',
  PLAYER_BAN: 'PLAYER_BAN',
  PLAYER_UNBAN: 'PLAYER_UNBAN',
  PLAYER_GRANT_WEALTH: 'PLAYER_GRANT_WEALTH',
  PLAYER_GRANT_XP: 'PLAYER_GRANT_XP',
  PLAYER_GRANT_ITEM: 'PLAYER_GRANT_ITEM',
  PLAYER_GRANT_CRATE: 'PLAYER_GRANT_CRATE',
  PLAYER_CLEAR_COOLDOWNS: 'PLAYER_CLEAR_COOLDOWNS',
  PLAYER_RESET_PROGRESS: 'PLAYER_RESET_PROGRESS',

  // Setting actions
  SETTING_CHANGE: 'SETTING_CHANGE',
  SETTING_BULK_CHANGE: 'SETTING_BULK_CHANGE',

  // Economy actions
  ECONOMY_ADJUST: 'ECONOMY_ADJUST',
  JACKPOT_RESET: 'JACKPOT_RESET',
  LOTTERY_FORCE_DRAW: 'LOTTERY_FORCE_DRAW',

  // Content actions
  HEIST_TRIVIA_CREATE: 'HEIST_TRIVIA_CREATE',
  HEIST_TRIVIA_UPDATE: 'HEIST_TRIVIA_UPDATE',
  HEIST_TRIVIA_DELETE: 'HEIST_TRIVIA_DELETE',
  HEIST_RIDDLE_CREATE: 'HEIST_RIDDLE_CREATE',
  HEIST_RIDDLE_UPDATE: 'HEIST_RIDDLE_UPDATE',
  HEIST_RIDDLE_DELETE: 'HEIST_RIDDLE_DELETE',
  HEIST_QUICKGRAB_CREATE: 'HEIST_QUICKGRAB_CREATE',
  HEIST_QUICKGRAB_UPDATE: 'HEIST_QUICKGRAB_UPDATE',
  HEIST_QUICKGRAB_DELETE: 'HEIST_QUICKGRAB_DELETE',

  // System actions
  ADMIN_GRANT: 'ADMIN_GRANT',
  ADMIN_REVOKE: 'ADMIN_REVOKE',
  MAINTENANCE_TOGGLE: 'MAINTENANCE_TOGGLE',
} as const;
