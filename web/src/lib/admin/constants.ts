// =============================================================================
// Admin Panel Constants
// =============================================================================

/**
 * Admin roles with their display names and descriptions
 */
export const ADMIN_ROLES = {
  owner: {
    name: 'Owner',
    description: 'Full access to all admin functions',
    color: 'text-amber-500',
    badge: 'bg-amber-500/20 text-amber-500',
  },
  moderator: {
    name: 'Moderator',
    description: 'Limited access for player management',
    color: 'text-blue-500',
    badge: 'bg-blue-500/20 text-blue-500',
  },
} as const;

/**
 * Thresholds for dangerous actions requiring type-to-confirm
 */
export const DANGER_THRESHOLDS = {
  WEALTH_GRANT: 10000,        // Amounts above this require type-to-confirm
  XP_GRANT: 10000,            // Amounts above this require type-to-confirm
  BULK_ACTION_COUNT: 10,      // Bulk actions affecting more than this many users
} as const;

/**
 * Setting categories with display info
 */
export const SETTING_CATEGORIES = {
  features: {
    name: 'Feature Flags',
    description: 'Enable or disable game features',
    icon: 'ToggleLeft',
    order: 1,
  },
  economy: {
    name: 'Economy',
    description: 'Multipliers and economic adjustments',
    icon: 'DollarSign',
    order: 2,
  },
  gameplay: {
    name: 'Gameplay',
    description: 'Cooldowns and game mechanics',
    icon: 'Gamepad2',
    order: 3,
  },
  display: {
    name: 'Display',
    description: 'UI messages and announcements',
    icon: 'MessageSquare',
    order: 4,
  },
} as const;

/**
 * Audit log action icons and colors
 */
export const AUDIT_ACTION_STYLES: Record<string, { icon: string; color: string }> = {
  // Player actions
  PLAYER_EDIT: { icon: 'UserPen', color: 'text-blue-500' },
  PLAYER_BAN: { icon: 'UserX', color: 'text-red-500' },
  PLAYER_UNBAN: { icon: 'UserCheck', color: 'text-green-500' },
  PLAYER_GRANT_WEALTH: { icon: 'Coins', color: 'text-amber-500' },
  PLAYER_GRANT_XP: { icon: 'Star', color: 'text-purple-500' },
  PLAYER_GRANT_ITEM: { icon: 'Package', color: 'text-cyan-500' },
  PLAYER_GRANT_CRATE: { icon: 'Box', color: 'text-orange-500' },
  PLAYER_CLEAR_COOLDOWNS: { icon: 'Clock', color: 'text-gray-500' },

  // Setting actions
  SETTING_CHANGE: { icon: 'Settings', color: 'text-gray-500' },
  SETTING_BULK_CHANGE: { icon: 'Settings2', color: 'text-gray-500' },

  // Economy actions
  ECONOMY_ADJUST: { icon: 'TrendingUp', color: 'text-emerald-500' },
  JACKPOT_RESET: { icon: 'RefreshCw', color: 'text-amber-500' },
  LOTTERY_FORCE_DRAW: { icon: 'Ticket', color: 'text-purple-500' },

  // Content actions
  HEIST_TRIVIA_CREATE: { icon: 'Plus', color: 'text-green-500' },
  HEIST_TRIVIA_UPDATE: { icon: 'Edit', color: 'text-blue-500' },
  HEIST_TRIVIA_DELETE: { icon: 'Trash2', color: 'text-red-500' },

  // System actions
  ADMIN_GRANT: { icon: 'Shield', color: 'text-amber-500' },
  ADMIN_REVOKE: { icon: 'ShieldOff', color: 'text-red-500' },
  MAINTENANCE_TOGGLE: { icon: 'Construction', color: 'text-orange-500' },
};

/**
 * Audit log category colors
 */
export const AUDIT_CATEGORY_COLORS: Record<string, string> = {
  player: 'bg-blue-500/20 text-blue-400',
  setting: 'bg-gray-500/20 text-gray-400',
  economy: 'bg-emerald-500/20 text-emerald-400',
  content: 'bg-purple-500/20 text-purple-400',
  system: 'bg-amber-500/20 text-amber-400',
};

/**
 * Admin navigation items
 */
export const ADMIN_NAV_ITEMS = [
  {
    href: '/admin',
    icon: 'LayoutDashboard',
    label: 'Dashboard',
    description: 'Overview and quick actions',
    ownerOnly: false,
  },
  {
    href: '/admin/players',
    icon: 'Users',
    label: 'Players',
    description: 'Search and manage players',
    ownerOnly: false,
  },
  {
    href: '/admin/settings',
    icon: 'Settings',
    label: 'Settings',
    description: 'Feature flags and configuration',
    ownerOnly: true,
  },
  {
    href: '/admin/economy',
    icon: 'DollarSign',
    label: 'Economy',
    description: 'Economy stats and adjustments',
    ownerOnly: true,
  },
  {
    href: '/admin/content',
    icon: 'FileText',
    label: 'Content',
    description: 'Heists and game content',
    ownerOnly: true,
  },
  {
    href: '/admin/logs',
    icon: 'ScrollText',
    label: 'Audit Logs',
    description: 'View admin action history',
    ownerOnly: false,
  },
] as const;

/**
 * Player stat fields that can be edited
 */
export const EDITABLE_PLAYER_FIELDS = [
  { key: 'wealth', label: 'Wealth', type: 'number', unit: '$' },
  { key: 'xp', label: 'XP', type: 'number', unit: 'XP' },
  { key: 'hp', label: 'HP', type: 'number', min: 0, max: 100 },
  { key: 'checkin_streak', label: 'Check-in Streak', type: 'number', min: 0 },
  { key: 'kingpin_name', label: 'Kingpin Name', type: 'string', maxLength: 100 },
] as const;

/**
 * Ban type options
 */
export const BAN_TYPES = [
  { value: 'temporary', label: 'Temporary', description: 'Ban expires after duration' },
  { value: 'permanent', label: 'Permanent', description: 'Ban never expires' },
] as const;

/**
 * Common ban durations in hours
 */
export const BAN_DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
  { hours: 720, label: '30 days' },
] as const;

/**
 * Rate limits for admin endpoints (requests per minute)
 */
export const ADMIN_RATE_LIMITS = {
  read: 100,    // GET requests
  write: 20,    // POST/PATCH/DELETE requests
  bulk: 5,      // Bulk operations
} as const;
