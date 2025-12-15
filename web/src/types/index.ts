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
  displayName: string | null
  kingpinName: string | null
  wealth: bigint
  xp: bigint
  level: number
  statusTier: Tier
  hp: number
  checkinStreak: number
  lastCheckinDate: Date | null
  totalPlayCount: number
  wins: number
  losses: number
  factionId: number | null
  createdAt: Date
  lastSeen: Date
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
  checkinStreak: number
  totalPlays: number
  winRate: number
}

// =============================================================================
// INVENTORY TYPES
// =============================================================================

export interface InventoryItem {
  id: number
  itemId: number
  itemName: string
  itemType: ItemType
  tier: ItemTier
  durability: number
  maxDurability: number
  isEquipped: boolean
  slot: EquipmentSlot | null
  isEscrowed: boolean
  escrowExpiresAt: Date | null
  acquiredAt: Date
  // Stats
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
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
  crateTier: CrateTier
  isEscrowed: boolean
  escrowExpiresAt: Date | null
  acquiredAt: Date
  source: string | null
}

export interface CrateOpenResult {
  crateTier: CrateTier
  dropType: 'item' | 'wealth' | 'title'
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
    duplicateConversion?: number
  }
}

// =============================================================================
// SHOP TYPES
// =============================================================================

export interface ShopItem {
  id: number
  itemId: number
  itemName: string
  itemType: ItemType
  tier: ItemTier
  price: number
  description: string | null
  // Stats for display
  robBonus: number | null
  defenseBonus: number | null
  revenueMin: number | null
  revenueMax: number | null
  insurancePercent: number | null
}

export interface BlackMarketItem extends ShopItem {
  stockQuantity: number
  originalStock: number
  isFeatured: boolean
  discountPercent: number
  discountedPrice: number
  availableUntil: Date
}

// =============================================================================
// GAME ACTION TYPES
// =============================================================================

export interface PlayResult {
  eventType: string
  eventDescription: string
  tier: number
  wealth: number
  xp: number
  levelUp: boolean
  newLevel?: number
  tierPromotion: boolean
  newTier?: Tier
  crateDropped: boolean
  crateTier?: CrateTier
  wasBusted: boolean
  jailUntil?: Date
}

export interface RobResult {
  success: boolean
  successRate: number
  wealthStolen: number
  wealthProtectedByInsurance: number
  netWealthStolen: number
  xpEarned: number
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
  missionType: 'daily' | 'weekly'
  name: string
  description: string
  objectiveType: string
  objectiveValue: number
  currentProgress: number
  rewardWealth: number
  rewardXp: number
  isCompleted: boolean
  expiresAt: Date
  assignedTier: Tier
}

export interface MissionCompletionResult {
  completionType: 'daily' | 'weekly'
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
  requirementType: string
  requirementValue: number
  currentProgress: number
  isCompleted: boolean
  completedAt: Date | null
  rewardWealth: number
  rewardXp: number
  rewardTitle: string | null
  iconUrl: string | null
  isHidden: boolean
}

export interface Title {
  id: number
  title: string
  isEquipped: boolean
  unlockedAt: Date
}

// =============================================================================
// FACTION TYPES
// =============================================================================

export interface Faction {
  id: number
  name: string
  description: string | null
  colorHex: string | null
  motto: string | null
  totalMembers: number
  territoriesControlled: number
}

export interface Territory {
  id: number
  name: string
  description: string | null
  controllingFactionId: number | null
  controllingFactionName: string | null
  isContested: boolean
  buffType: string | null
  buffValue: number | null
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
  userId: number
  username: string
  displayName: string | null
  value: number | bigint
  equippedTitle: string | null
}

// =============================================================================
// JUICERNAUT TYPES
// =============================================================================

export interface JuicernautSession {
  id: number
  isActive: boolean
  startedAt: Date
  endedAt: Date | null
  totalContributionsUsd: number
  currentJuicernaut: {
    userId: number
    username: string
    totalUsd: number
  } | null
}

export interface JuicernautContribution {
  userId: number
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
  linkType: string | null
  linkId: string | null
  isSeen: boolean
  isDismissed: boolean
  createdAt: Date
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
  eventType: HeistEventType
  difficulty: HeistDifficulty
  prompt: string
  timeLimit: number
  startedAt: Date
  endedAt: Date | null
  winner: {
    userId: number
    username: string
    platform: Platform
    responseTimeMs: number
  } | null
  crateTier: CrateTier | null
}
