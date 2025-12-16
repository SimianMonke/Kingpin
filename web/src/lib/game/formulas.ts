// =============================================================================
// KINGPIN GAME FORMULAS
// All calculations based on specifications from documentation
// =============================================================================

import {
  TIERS,
  Tier,
  TIER_LEVELS,
  TIER_MULTIPLIERS,
  ROB_CONFIG,
  CHECKIN_CONFIG,
  PLAY_EVENTS,
  PlayEventType,
  CRATE_DROP_TABLES,
  CrateTier,
  CRATE_TIERS,
  ITEM_TIERS,
  ItemTier,
  JUICERNAUT_BUFFS,
  JAIL_CONFIG,
  DURABILITY_CONFIG,
  SLOTS_CONFIG,
  GAMBLING_CONFIG,
  GAMBLING_LUCK_BY_TIER,
  GAMBLING_MAX_BET_BY_TIER,
} from './constants'

// =============================================================================
// XP & LEVELING
// =============================================================================

/**
 * Calculate XP required for a specific level
 * Formula: XP = 100 × 1.25^(N-1)
 */
export function xpForLevel(level: number): number {
  if (level < 1) return 0
  return Math.floor(100 * Math.pow(1.25, level - 1))
}

/**
 * Calculate total XP required to reach a level (cumulative)
 */
export function totalXpForLevel(level: number): number {
  let total = 0
  for (let i = 1; i <= level; i++) {
    total += xpForLevel(i)
  }
  return total
}

/**
 * Calculate level from total XP
 */
export function levelFromXp(totalXp: number): number {
  let level = 1
  let xpNeeded = 0

  while (true) {
    xpNeeded += xpForLevel(level)
    if (totalXp < xpNeeded) {
      return level
    }
    level++
    // Safety cap at level 200
    if (level > 200) return 200
  }
}

/**
 * Calculate XP progress within current level
 */
export function xpProgressInLevel(totalXp: number): { current: number; required: number; percentage: number } {
  const level = levelFromXp(totalXp)
  const xpForCurrentLevel = totalXpForLevel(level - 1)
  const xpForNextLevel = xpForLevel(level)
  const current_progress = totalXp - xpForCurrentLevel

  return {
    current: current_progress,
    required: xpForNextLevel,
    percentage: Math.floor((current_progress / xpForNextLevel) * 100),
  }
}

// =============================================================================
// TIER SYSTEM
// =============================================================================

/**
 * Get tier from level
 */
export function getTierFromLevel(level: number): Tier {
  for (const [tier, range] of Object.entries(TIER_LEVELS)) {
    if (level >= range.min && level <= range.max) {
      return tier as Tier
    }
  }
  return TIERS.KINGPIN
}

/**
 * Get tier multiplier for rewards
 */
export function getTierMultiplier(tier: Tier): number {
  return TIER_MULTIPLIERS[tier] || 1.0
}

/**
 * Check if level qualifies for a tier
 */
export function meetsMinTierLevel(level: number, requiredTier: Tier): boolean {
  const requiredMin = TIER_LEVELS[requiredTier].min
  return level >= requiredMin
}

// =============================================================================
// ROBBERY CALCULATIONS
// =============================================================================

interface RobCalculationParams {
  attackerLevel: number
  defenderLevel: number
  attackerWeaponBonus: number   // 0-15% expressed as decimal (0.15)
  defenderArmorBonus: number    // 0-15% expressed as decimal (0.15)
}

/**
 * Calculate robbery success rate
 * Formula:
 * Base: 60%
 * + Attacker weapon bonus (0-15%)
 * - Defender armor bonus (0-15%)
 * ± Level difference × 1% (max ±10%)
 * = Final rate (clamped 45-85%)
 */
export function calculateRobSuccessRate(params: RobCalculationParams): number {
  const { attackerLevel, defenderLevel, attackerWeaponBonus, defenderArmorBonus } = params

  // Base rate
  let rate = ROB_CONFIG.BASE_SUCCESS_RATE

  // Add weapon bonus (capped at 15%)
  rate += Math.min(attackerWeaponBonus, ROB_CONFIG.MAX_WEAPON_BONUS)

  // Subtract armor reduction (capped at 15%)
  rate -= Math.min(defenderArmorBonus, ROB_CONFIG.MAX_ARMOR_REDUCTION)

  // Level difference modifier
  const levelDiff = attackerLevel - defenderLevel
  const levelModifier = Math.max(
    -ROB_CONFIG.MAX_LEVEL_MODIFIER,
    Math.min(ROB_CONFIG.MAX_LEVEL_MODIFIER, levelDiff * ROB_CONFIG.LEVEL_DIFF_MODIFIER)
  )
  rate += levelModifier

  // Clamp to min/max
  return Math.max(ROB_CONFIG.MIN_SUCCESS_RATE, Math.min(ROB_CONFIG.MAX_SUCCESS_RATE, rate))
}

/**
 * Calculate wealth stolen in a robbery
 */
export function calculateRobAmount(targetWealth: number): number {
  const percentage = ROB_CONFIG.STEAL_PERCENTAGE.min +
    Math.random() * (ROB_CONFIG.STEAL_PERCENTAGE.max - ROB_CONFIG.STEAL_PERCENTAGE.min)
  return Math.floor(targetWealth * percentage)
}

/**
 * Calculate insurance protection amount
 */
export function calculateInsuranceProtection(robAmount: number, insurance_percent: number): number {
  return Math.floor(robAmount * insurance_percent)
}

// =============================================================================
// PLAY COMMAND
// =============================================================================

/**
 * Select a random play event based on weights
 */
export function selectPlayEvent(): PlayEventType {
  const events = Object.entries(PLAY_EVENTS)
  const totalWeight = events.reduce((sum, [, event]) => sum + event.weight, 0)

  let random = Math.random() * totalWeight
  for (const [name, event] of events) {
    random -= event.weight
    if (random <= 0) {
      return name as PlayEventType
    }
  }

  // Fallback to first event
  return events[0][0] as PlayEventType
}

/**
 * Calculate play rewards with tier multiplier
 */
export function calculatePlayRewards(
  event_type: PlayEventType,
  tier: Tier,
  isJuicernaut: boolean = false
): { wealth: number; xp: number } {
  const event = PLAY_EVENTS[event_type]
  const tier_multiplier = getTierMultiplier(tier)

  let wealth = Math.floor(
    (event.wealth.min + Math.random() * (event.wealth.max - event.wealth.min)) * tier_multiplier
  )
  let xp = Math.floor(
    (event.xp.min + Math.random() * (event.xp.max - event.xp.min)) * tier_multiplier
  )

  // Apply Juicernaut buffs
  if (isJuicernaut) {
    wealth = Math.floor(wealth * JUICERNAUT_BUFFS.WEALTH_MULTIPLIER)
    xp = Math.floor(xp * JUICERNAUT_BUFFS.XP_MULTIPLIER)
  }

  return { wealth, xp }
}

/**
 * Check if a crate drops from play
 */
export function rollCrateDrop(isJuicernaut: boolean = false): boolean {
  const baseChance = 0.02 // 2%
  const chance = isJuicernaut ? baseChance * JUICERNAUT_BUFFS.LOOT_MULTIPLIER : baseChance
  return Math.random() < chance
}

/**
 * Determine crate tier for play drop
 */
export function rollPlayCrateTier(): CrateTier {
  const roll = Math.random()
  if (roll < 0.60) return CRATE_TIERS.COMMON
  if (roll < 0.90) return CRATE_TIERS.UNCOMMON
  if (roll < 0.98) return CRATE_TIERS.RARE
  return CRATE_TIERS.LEGENDARY
}

// =============================================================================
// CHECK-IN
// =============================================================================

/**
 * Calculate check-in rewards based on streak
 */
export function calculateCheckinRewards(streak: number): { wealth: number; xp: number } {
  const effectiveStreak = Math.min(streak, CHECKIN_CONFIG.MAX_STREAK_BONUS_DAYS)

  const wealth = CHECKIN_CONFIG.BASE_WEALTH +
    (effectiveStreak * CHECKIN_CONFIG.STREAK_BONUS_WEALTH_PER_DAY)
  const xp = CHECKIN_CONFIG.BASE_XP +
    (effectiveStreak * CHECKIN_CONFIG.STREAK_BONUS_XP_PER_DAY)

  return { wealth, xp }
}

/**
 * CRIT-06 fix: Perpetual milestone crate cycle
 * - Every 28 days: Legendary crate (takes priority)
 * - Every 7 days (not 28): Uncommon crate
 *
 * Example pattern:
 * Day 7: Uncommon, Day 14: Uncommon, Day 21: Uncommon, Day 28: Legendary
 * Day 35: Uncommon, Day 42: Uncommon, Day 49: Uncommon, Day 56: Legendary
 * ...continues forever
 */
export function getStreakMilestoneReward(streak: number): CrateTier | null {
  const { MILESTONE_CYCLE } = CHECKIN_CONFIG

  // Check 28-day milestone first (takes priority)
  if (streak % MILESTONE_CYCLE.MONTHLY_INTERVAL === 0) {
    return MILESTONE_CYCLE.MONTHLY_CRATE
  }

  // Check 7-day milestone
  if (streak % MILESTONE_CYCLE.WEEKLY_INTERVAL === 0) {
    return MILESTONE_CYCLE.WEEKLY_CRATE
  }

  return null
}

// =============================================================================
// BAIL
// =============================================================================

/**
 * Calculate bail cost
 */
export function calculateBailCost(wealth: number): number {
  return Math.max(JAIL_CONFIG.MIN_BAIL, Math.floor(wealth * JAIL_CONFIG.BAIL_COST_PERCENT))
}

// =============================================================================
// CRATE OPENING
// =============================================================================

type CrateDropType = 'weapon' | 'armor' | 'wealth' | 'title'

/**
 * Roll what type of drop from a crate
 */
export function rollCrateDropType(crate_tier: CrateTier): CrateDropType {
  const table = CRATE_DROP_TABLES[crate_tier]
  const roll = Math.random()

  let cumulative = 0
  cumulative += table.weapon
  if (roll < cumulative) return 'weapon'

  cumulative += table.armor
  if (roll < cumulative) return 'armor'

  cumulative += table.wealth
  if (roll < cumulative) return 'wealth'

  return 'title'
}

/**
 * Roll item tier from crate
 */
export function rollCrateItemTier(crate_tier: CrateTier): ItemTier {
  const weights = CRATE_DROP_TABLES[crate_tier].item_tierWeights
  const roll = Math.random()

  let cumulative = 0
  for (const [tier, weight] of Object.entries(weights)) {
    cumulative += weight
    if (roll < cumulative) {
      return tier as ItemTier
    }
  }

  return ITEM_TIERS.COMMON
}

/**
 * Roll wealth amount from crate
 */
export function rollCrateWealth(crate_tier: CrateTier): number {
  const range = CRATE_DROP_TABLES[crate_tier].wealthRange
  return Math.floor(range.min + Math.random() * (range.max - range.min))
}

// =============================================================================
// DURABILITY
// =============================================================================

/**
 * Calculate durability decay for an action
 * Note: Durability only decays during robbery, NOT during play
 * HIGH-01 fix: Now returns random value within configured range
 */
export function calculateDurabilityDecay(
  action: 'rob_attacker' | 'rob_defender'
): number {
  let range: { min: number; max: number }
  switch (action) {
    case 'rob_attacker':
      range = DURABILITY_CONFIG.DECAY_PER_ROB_ATTACKER
      break
    case 'rob_defender':
      range = DURABILITY_CONFIG.DECAY_PER_ROB_DEFENDER
      break
  }
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
}

/**
 * Check if item should break
 */
export function shouldItemBreak(currentDurability: number, decay: number): boolean {
  return currentDurability - decay <= DURABILITY_CONFIG.BREAK_THRESHOLD
}

// =============================================================================
// MISSION REWARDS
// =============================================================================

/**
 * Calculate mission rewards with tier scaling
 */
export function calculateMissionRewards(
  baseWealth: number,
  baseXp: number,
  tier: Tier
): { wealth: number; xp: number } {
  const multiplier = getTierMultiplier(tier)
  return {
    wealth: Math.floor(baseWealth * multiplier),
    xp: Math.floor(baseXp * multiplier),
  }
}

/**
 * Calculate mission objective with tier scaling
 */
export function calculateMissionObjective(baseValue: number, tier: Tier): number {
  const multiplier = getTierMultiplier(tier)
  return Math.ceil(baseValue * multiplier)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Weighted random selection
 */
export function weightedRandom<T>(items: Array<{ item: T; weight: number }>): T {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0)
  let random = Math.random() * totalWeight

  for (const { item, weight } of items) {
    random -= weight
    if (random <= 0) return item
  }

  return items[0].item
}

/**
 * Format wealth for display
 */
export function formatWealth(amount: number | bigint): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(num: number | bigint): string {
  const n = typeof num === 'bigint' ? Number(num) : num
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

/**
 * Format duration in human readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(endTime: Date): string {
  const now = new Date()
  const diff = endTime.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// =============================================================================
// GAMBLING FORMULAS (Phase 11)
// =============================================================================

/**
 * Get maximum bet amount for a tier
 */
export function getMaxBet(tier: string): number {
  return GAMBLING_MAX_BET_BY_TIER[tier] ?? GAMBLING_CONFIG.MAX_BET_BASE
}

/**
 * Get luck bonus for tier (added to win chances)
 */
export function getTierLuckBonus(tier: string): number {
  return GAMBLING_LUCK_BY_TIER[tier] ?? 0
}

/**
 * Spin slot machine reels
 * Returns array of 3 symbols
 */
export function spinSlotReels(): string[] {
  const symbols = Object.keys(SLOTS_CONFIG.SYMBOL_WEIGHTS) as string[]
  const weights = Object.values(SLOTS_CONFIG.SYMBOL_WEIGHTS)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const results: string[] = []
  for (let i = 0; i < SLOTS_CONFIG.REELS; i++) {
    let random = Math.random() * totalWeight
    for (let j = 0; j < symbols.length; j++) {
      random -= weights[j]
      if (random <= 0) {
        results.push(symbols[j])
        break
      }
    }
  }
  return results
}

/**
 * Calculate slots payout
 * Returns multiplier (0 = loss, >0 = win)
 */
export function calculateSlotsPayout(reels: string[]): { multiplier: number; isJackpot: boolean; matchCount: number } {
  const [r1, r2, r3] = reels

  // Three of a kind
  if (r1 === r2 && r2 === r3) {
    if (r1 === '🎰') {
      return { multiplier: 0, isJackpot: true, matchCount: 3 }
    }
    const payoutKey = r1 as keyof typeof SLOTS_CONFIG.PAYOUTS
    return {
      multiplier: SLOTS_CONFIG.PAYOUTS[payoutKey] ?? 0,
      isJackpot: false,
      matchCount: 3
    }
  }

  // Two of a kind (check all combinations)
  if (r1 === r2 || r2 === r3 || r1 === r3) {
    const matchedSymbol = r1 === r2 ? r1 : (r2 === r3 ? r2 : r1)
    const partialKey = matchedSymbol as keyof typeof SLOTS_CONFIG.PARTIAL_PAYOUTS
    return {
      multiplier: SLOTS_CONFIG.PARTIAL_PAYOUTS[partialKey] ?? 0,
      isJackpot: false,
      matchCount: 2
    }
  }

  // No match
  return { multiplier: 0, isJackpot: false, matchCount: 0 }
}

/**
 * Check if jackpot is triggered (beyond matching 🎰🎰🎰)
 * Small chance on any spin based on tier
 * Base: 0.1% (0.001), plus tier bonus (e.g., Kingpin +5% = 0.05)
 * CRIT-02 fix: Tier bonus adds percentage points directly
 */
export function rollJackpotChance(tier: string): boolean {
  const baseChance = GAMBLING_CONFIG.JACKPOT_TRIGGER_CHANCE // 0.001 (0.1%)
  const tierBonus = getTierLuckBonus(tier) // 0-0.05 based on tier
  // Tier bonus adds directly (e.g., Kingpin: 0.001 + 0.05 = 0.051 = 5.1%)
  return Math.random() < (baseChance + tierBonus)
}

export interface BlackjackCard {
  rank: string
  suit: string
}

/**
 * Calculate blackjack hand value
 * Returns { value: number, isSoft: boolean }
 */
export function calculateBlackjackHand(cards: BlackjackCard[]): { value: number; isSoft: boolean } {
  let value = 0
  let aces = 0

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++
      value += 11
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      value += 10
    } else {
      value += parseInt(card.rank)
    }
  }

  // Adjust aces from 11 to 1 if busting
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return { value, isSoft: aces > 0 && value <= 21 }
}

/**
 * Check if hand is blackjack (21 with 2 cards)
 */
export function isBlackjack(cards: BlackjackCard[]): boolean {
  if (cards.length !== 2) return false
  const { value } = calculateBlackjackHand(cards)
  return value === 21
}

/**
 * Create and shuffle a deck
 */
export function createDeck(): BlackjackCard[] {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const suits = ['♠', '♥', '♦', '♣']
  const deck: BlackjackCard[] = []

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit })
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

/**
 * Flip a coin
 */
export function flipCoin(): 'heads' | 'tails' {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

/**
 * Generate lottery winning numbers
 */
export function generateLotteryNumbers(): number[] {
  const numbers: number[] = []
  while (numbers.length < GAMBLING_CONFIG.LOTTERY_NUMBERS_COUNT) {
    const num = Math.floor(Math.random() * GAMBLING_CONFIG.LOTTERY_NUMBER_MAX) + 1
    if (!numbers.includes(num)) {
      numbers.push(num)
    }
  }
  return numbers.sort((a, b) => a - b)
}

/**
 * Check lottery ticket match count
 */
export function checkLotteryMatch(ticketNumbers: number[], winning_numbers: number[]): number {
  return ticketNumbers.filter(n => winning_numbers.includes(n)).length
}

/**
 * Calculate lottery payout based on matches
 * 3 match = jackpot (full pool)
 * 2 match = 10x ticket cost
 * 1 match = 2x ticket cost
 */
export function calculateLotteryPayout(matches: number, ticketCost: bigint, prize_pool: bigint): bigint {
  switch (matches) {
    case 3: return prize_pool
    case 2: return ticketCost * BigInt(10)
    case 1: return ticketCost * BigInt(2)
    default: return BigInt(0)
  }
}

/**
 * Update win/loss streak
 */
export function updateGamblingStreak(
  current_win_streak: number,
  current_loss_streak: number,
  best_win_streak: number,
  worst_loss_streak: number,
  isWin: boolean
): { winStreak: number; lossStreak: number; bestWin: number; worstLoss: number } {
  if (isWin) {
    const newWinStreak = current_win_streak + 1
    return {
      winStreak: newWinStreak,
      lossStreak: 0,
      bestWin: Math.max(best_win_streak, newWinStreak),
      worstLoss: worst_loss_streak,
    }
  } else {
    const newLossStreak = current_loss_streak + 1
    return {
      winStreak: 0,
      lossStreak: newLossStreak,
      bestWin: best_win_streak,
      worstLoss: Math.max(worst_loss_streak, newLossStreak),
    }
  }
}
