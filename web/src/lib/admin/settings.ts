import { prisma } from '@/lib/db';

// =============================================================================
// Types
// =============================================================================

export interface AdminSetting {
  key: string;
  value: unknown;
  value_type: string;
  category: string;
  label: string;
  description: string | null;
  constraints: SettingConstraints | null;
  is_sensitive: boolean;
  updated_by: number | null;
  updated_at: Date;
}

export interface SettingConstraints {
  min?: number;
  max?: number;
  options?: string[];
}

export interface GroupedSettings {
  [category: string]: AdminSetting[];
}

// =============================================================================
// Cache
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const settingsCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Invalidate all cached settings
 */
export function invalidateSettingsCache(): void {
  settingsCache.clear();
}

/**
 * Invalidate a specific setting from cache
 */
export function invalidateSetting(key: string): void {
  settingsCache.delete(key);
}

// =============================================================================
// Read Functions
// =============================================================================

/**
 * Get a single setting value with caching
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  // Check cache first
  const cached = settingsCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value as T;
  }

  // Fetch from database
  const setting = await prisma.admin_settings.findUnique({
    where: { key },
  });

  const value = (setting?.value ?? defaultValue) as T;

  // Update cache
  settingsCache.set(key, { value, expires: Date.now() + CACHE_TTL });

  return value;
}

/**
 * Get multiple settings at once (more efficient for bulk reads)
 */
export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const keysToFetch: string[] = [];

  // Check cache for each key
  for (const key of keys) {
    const cached = settingsCache.get(key);
    if (cached && cached.expires > Date.now()) {
      result[key] = cached.value;
    } else {
      keysToFetch.push(key);
    }
  }

  // Fetch missing keys from database
  if (keysToFetch.length > 0) {
    const settings = await prisma.admin_settings.findMany({
      where: { key: { in: keysToFetch } },
    });

    for (const setting of settings) {
      result[setting.key] = setting.value;
      settingsCache.set(setting.key, {
        value: setting.value,
        expires: Date.now() + CACHE_TTL,
      });
    }
  }

  return result;
}

/**
 * Get all settings grouped by category
 */
export async function getAllSettings(): Promise<GroupedSettings> {
  const settings = await prisma.admin_settings.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });

  const grouped: GroupedSettings = {};

  for (const setting of settings) {
    if (!grouped[setting.category]) {
      grouped[setting.category] = [];
    }
    grouped[setting.category].push({
      key: setting.key,
      value: setting.value,
      value_type: setting.value_type,
      category: setting.category,
      label: setting.label,
      description: setting.description,
      constraints: setting.constraints as SettingConstraints | null,
      is_sensitive: setting.is_sensitive,
      updated_by: setting.updated_by,
      updated_at: setting.updated_at,
    });
  }

  return grouped;
}

// =============================================================================
// Feature Flag Helpers
// =============================================================================

/**
 * Check if a feature is enabled
 */
export async function isFeatureEnabled(feature: string): Promise<boolean> {
  return getSetting(`feature_${feature}_enabled`, true);
}

/**
 * Check if site is in maintenance mode
 */
export async function isMaintenanceMode(): Promise<boolean> {
  return getSetting('feature_maintenance_mode', false);
}

/**
 * Check if registration is enabled
 */
export async function isRegistrationEnabled(): Promise<boolean> {
  return getSetting('feature_registration_enabled', true);
}

// =============================================================================
// Economy Multiplier Helpers
// =============================================================================

/**
 * Get wealth multiplier for events
 */
export async function getWealthMultiplier(): Promise<number> {
  return getSetting('economy_wealth_multiplier', 1.0);
}

/**
 * Get XP multiplier for events
 */
export async function getXpMultiplier(): Promise<number> {
  return getSetting('economy_xp_multiplier', 1.0);
}

/**
 * Get rob success modifier
 */
export async function getRobSuccessModifier(): Promise<number> {
  return getSetting('economy_rob_success_modifier', 0);
}

/**
 * Get crate drop multiplier
 */
export async function getCrateDropMultiplier(): Promise<number> {
  return getSetting('economy_crate_drop_multiplier', 1.0);
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Get message of the day
 */
export async function getMotd(): Promise<string> {
  return getSetting('display_motd', '');
}

/**
 * Get site announcement
 */
export async function getAnnouncement(): Promise<{
  text: string;
  type: 'info' | 'warning' | 'error';
  link?: string;
} | null> {
  return getSetting('display_announcement', null);
}

/**
 * Get active event name
 */
export async function getEventName(): Promise<string> {
  return getSetting('display_event_name', '');
}

// =============================================================================
// Gameplay Helpers
// =============================================================================

/**
 * Get play cooldown in seconds
 */
export async function getPlayCooldown(): Promise<number> {
  return getSetting('gameplay_play_cooldown_seconds', 30);
}

/**
 * Get rob cooldown in seconds
 */
export async function getRobCooldown(): Promise<number> {
  return getSetting('gameplay_rob_cooldown_seconds', 300);
}

/**
 * Get jail duration in seconds
 */
export async function getJailDuration(): Promise<number> {
  return getSetting('gameplay_jail_duration_seconds', 300);
}

// =============================================================================
// Write Functions
// =============================================================================

/**
 * Update a single setting
 */
export async function updateSetting(
  key: string,
  value: unknown,
  updatedBy: number
): Promise<AdminSetting | null> {
  const existing = await prisma.admin_settings.findUnique({
    where: { key },
  });

  if (!existing) return null;

  // Validate constraints
  if (existing.constraints) {
    const constraints = existing.constraints as SettingConstraints;
    if (typeof value === 'number') {
      if (constraints.min !== undefined && value < constraints.min) {
        throw new Error(`Value must be at least ${constraints.min}`);
      }
      if (constraints.max !== undefined && value > constraints.max) {
        throw new Error(`Value must be at most ${constraints.max}`);
      }
    }
    if (constraints.options && typeof value === 'string') {
      if (!constraints.options.includes(value)) {
        throw new Error(`Value must be one of: ${constraints.options.join(', ')}`);
      }
    }
  }

  const updated = await prisma.admin_settings.update({
    where: { key },
    data: {
      value: value as any,
      updated_by: updatedBy,
      updated_at: new Date(),
    },
  });

  // Invalidate cache
  invalidateSetting(key);

  return {
    key: updated.key,
    value: updated.value,
    value_type: updated.value_type,
    category: updated.category,
    label: updated.label,
    description: updated.description,
    constraints: updated.constraints as SettingConstraints | null,
    is_sensitive: updated.is_sensitive,
    updated_by: updated.updated_by,
    updated_at: updated.updated_at,
  };
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(
  updates: Record<string, unknown>,
  updatedBy: number
): Promise<{ updated: string[]; errors: Record<string, string> }> {
  const updated: string[] = [];
  const errors: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    try {
      const result = await updateSetting(key, value, updatedBy);
      if (result) {
        updated.push(key);
      } else {
        errors[key] = 'Setting not found';
      }
    } catch (error) {
      errors[key] = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return { updated, errors };
}
