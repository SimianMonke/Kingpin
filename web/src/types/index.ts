// =============================================================================
// KINGPIN TYPE DEFINITIONS
// =============================================================================

import type { Tier, ItemType, ItemTier, CrateTier, EquipmentSlot } from '@/lib/game'

// =============================================================================
// USER TYPES
// =============================================================================

export interface UserProfile {
  id: number
  username: string
  display_name: string | null
  kingpin_name: string | null
  wealth: bigint
  xp: bigint
  level: number
  status_tier: Tier
  hp: number
  checkin_streak: number
  last_checkin_date: Date | null
  total_play_count: number
  wins: number
  losses: number
  faction_id: number | null
  created_at: Date
  last_seen: Date
}

export interface UserStats {
  totalWealth: bigint
  totalXp: bigint
  level: number
  tier: Tier
  xpProgress: {
    current: number
    required: number
    percentage: number
  }
  checkin_streak: number
  totalPlays: number
  winRate: number
}

// =============================================================================
// INVENTORY TYPES
// =============================================================================

export interface InventoryItem {
  id: number
  item_id: number
  itemName: string
  type: ItemType
  tier: ItemTier
  durability: number
  maxDurability: number
  is_equipped: boolean
  slot: EquipmentSlot | null
  is_escrowed: boolean
  escrow_expires_at: Date | null
  acquired_at: Date
  // Stats
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
}

export interface EquippedItems {
  weapon: InventoryItem | null
  armor: InventoryItem | null
  business: InventoryItem | null
  housing: InventoryItem | null
}

// =============================================================================
// CRATE TYPES
// =============================================================================

export interface UserCrateInfo {
  id: number
  crate_tier: CrateTier
  is_escrowed: boolean
  escrow_expires_at: Date | null
  acquired_at: Date
  source: string | null
}

export interface CrateOpenResult {
  crate_tier: CrateTier
  drop_type: 'item' | 'wealth' | 'title'
  item?: {
    id: number
    name: string
    type: ItemType
    tier: ItemTier
  }
  wealth?: number
  title?: {
    name: string
    wasDuplicate: boolean
    duplicate_conversion?: number
  }
}

// =============================================================================
// SHOP TYPES
// =============================================================================

export interface ShopItem {
  id: number
  item_id: number
  itemName: string
  type: ItemType
  tier: ItemTier
  price: number
  description: string | null
  // Stats for display
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
}

export interface BlackMarketItem extends ShopItem {
  stock_quantity: number
  original_stock: number
  is_featured: boolean
  discount_percent: number
  discountedPrice: number
  available_until: Date
}

// =============================================================================
// GAME ACTION TYPES
// =============================================================================

export interface PlayResult {
  event_type: string
  event_description: string
  tier: number
  wealth: number
  xp: number
  levelUp: boolean
  newLevel?: number
  tierPromotion: boolean
  newTier?: Tier
  crateDropped: boolean
  crate_tier?: CrateTier
  was_busted: boolean
  jailUntil?: Date
}

export interface RobResult {
  success: boolean
  successRate: number
  wealthStolen: number
  wealthProtectedByInsurance: number
  netWealthStolen: number
  xp_earned: number
  itemStolen: boolean
  stolenItem?: {
    id: number
    name: string
    type: ItemType
    tier: ItemTier
  }
  attackerItemBroke: boolean
  defenderItemBroke: boolean
}

export interface BailResult {
  success: boolean
  cost: number
  newWealth: bigint
}

// =============================================================================
// MISSION TYPES
// =============================================================================

export interface Mission {
  id: number
  templateId: string
  mission_type: 'daily' | 'weekly'
  name: string
  description: string
  objectiveType: string
  objective_value: number
  current_progress: number
  reward_wealth: number
  reward_xp: number
  is_completed: boolean
  expires_at: Date
  assignedTier: Tier
}

export interface MissionCompletionResult {
  completion_type: 'daily' | 'weekly'
  missions: Mission[]
  totalWealth: number
  totalXp: number
  bonusWealth: number
  bonusXp: number
  crateAwarded: CrateTier | null
}

// =============================================================================
// ACHIEVEMENT TYPES
// =============================================================================

export interface Achievement {
  id: number
  key: string
  name: string
  description: string
  category: string
  tier: string
  requirement_type: string
  requirement_value: number
  current_progress: number
  is_completed: boolean
  completed_at: Date | null
  reward_wealth: number
  reward_xp: number
  reward_title: string | null
  iconUrl: string | null
  is_hidden: boolean
}

export interface Title {
  id: number
  title: string
  is_equipped: boolean
  unlocked_at: Date
}

// =============================================================================
// FACTION TYPES
// =============================================================================

export interface Faction {
  id: number
  name: string
  description: string | null
  color_hex: string | null
  motto: string | null
  total_members: number
  territories_controlled: number
}

export interface Territory {
  id: number
  name: string
  description: string | null
  controlling_faction_id: number | null
  factionsName: string | null
  is_contested: boolean
  buff_type: string | null
  buff_value: number | null
}

export interface FactionBuff {
  type: string
  value: number
  territoryName: string
}

// =============================================================================
// LEADERBOARD TYPES
// =============================================================================

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'annual' | 'lifetime'
export type LeaderboardType = 'wealth' | 'xp' | 'chatters' | 'donations'

export interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string
  display_name: string | null
  value: number | bigint
  equippedTitle: string | null
}

// =============================================================================
// JUICERNAUT TYPES
// =============================================================================

export interface JuicernautSession {
  id: number
  is_active: boolean
  started_at: Date
  ended_at: Date | null
  total_contributions_usd: number
  current_juicernaut: {
    user_id: number
    username: string
    totalUsd: number
  } | null
}

export interface JuicernautContribution {
  user_id: number
  username: string
  totalUsd: number
  contributionsCount: number
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export type NotificationType =
  | 'checkin'
  | 'checkin_milestone'
  | 'level_up'
  | 'tier_promotion'
  | 'robbed'
  | 'rob_defended'
  | 'item_stolen'
  | 'item_broke'
  | 'crate_received'
  | 'crate_escrow'
  | 'crate_expired'
  | 'achievement'
  | 'title_unlocked'
  | 'mission_complete'
  | 'mission_expired'
  | 'faction_joined'
  | 'territory_captured'
  | 'territory_lost'
  | 'faction_reward'
  | 'juicernaut_crown'
  | 'juicernaut_dethroned'
  | 'juicernaut_reward'
  | 'monetization'
  | 'heist_won'
  | 'black_market_rotation'

export interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  icon: string | null
  link_type: string | null
  link_id: string | null
  is_seen: boolean
  is_dismissed: boolean
  created_at: Date
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// =============================================================================
// PLATFORM TYPES
// =============================================================================

export type Platform = 'kick' | 'twitch' | 'discord'

export interface PlatformIdentity {
  platform: Platform
  platformUserId: string
  username: string
}

// =============================================================================
// HEIST TYPES
// =============================================================================

export type HeistEventType =
  | 'quick_grab'
  | 'code_crack'
  | 'trivia'
  | 'word_scramble'
  | 'riddle'
  | 'math_hack'

export type HeistDifficulty = 'easy' | 'medium' | 'hard'

export interface HeistEvent {
  id: number
  event_type: HeistEventType
  difficulty: HeistDifficulty
  prompt: string
  timeLimit: number
  started_at: Date
  ended_at: Date | null
  winner: {
    user_id: number
    username: string
    platform: Platform
    response_time_ms: number
  } | null
  crate_tier: CrateTier | null
}
