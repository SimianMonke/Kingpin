import axios, { AxiosInstance, AxiosError } from 'axios'
import { config } from './config'
import { logger } from './utils/logger'

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface UserProfile {
  id: number
  username: string
  kingpinName: string | null
  level: number
  xp: number
  xpToNextLevel: number
  wealth: number
  statusTier: string
  equippedTitle: string | null
  checkinStreak: number
  isJailed: boolean
  jailReleaseAt: string | null
  faction: {
    id: number
    name: string
  } | null
}

export interface PlayResult {
  success: boolean
  event: {
    name: string
    description: string
    wealthChange: number
    xpGained: number
    isBust: boolean
  }
  player: {
    wealth: number
    xp: number
    level: number
  }
  jailed?: {
    releaseAt: string
    durationMinutes: number
  }
  crateDropped?: {
    tier: string
    toEscrow: boolean
  }
  expiringBuffs?: Array<{
    buffType: string
    description: string | null
    remainingMinutes: number | null
  }>
}

export interface RobResult {
  success: boolean
  robSuccess: boolean
  wealthStolen: number
  itemStolen?: {
    name: string
    type: string
    tier: string
  }
  attacker: {
    wealth: number
  }
  defender: {
    username: string
    wealth: number
  }
  failReason?: string
}

export interface BailResult {
  success: boolean
  paid: number
  newWealth: number
}

export interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  displayName: string | null
  value: number
}

export interface JuicernautSession {
  id: number
  title: string | null
  platform: string
  isActive: boolean
  totalContributionsUsd: number
  currentJuicernaut: {
    id: number
    username: string
    displayName: string | null
    totalUsd: number
  } | null
  leaderboard: Array<{
    rank: number
    userId: number
    username: string
    totalUsd: number
    isJuicernaut: boolean
  }>
}

// =============================================================================
// API CLIENT
// =============================================================================

class ApiClient {
  private client: AxiosInstance
  private adminClient: AxiosInstance

  constructor() {
    // Regular bot client (for user actions)
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api.botApiKey,
      },
    })

    // Admin client (for session management)
    this.adminClient = axios.create({
      baseURL: config.api.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api.adminApiKey || config.api.botApiKey,
      },
    })

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        })
        return Promise.reject(error)
      }
    )
  }

  // ===========================================================================
  // USER LOOKUP
  // ===========================================================================

  async getUserByPlatform(
    platform: 'kick' | 'twitch' | 'discord',
    platformUserId: string
  ): Promise<ApiResponse<{ userId: number }>> {
    try {
      const response = await this.client.get(`/api/users/lookup`, {
        params: { platform, platformUserId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getProfile(userId: number): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await this.client.get(`/api/users/${userId}`)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getProfileByUsername(username: string): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await this.client.get(`/api/users/by-name/${encodeURIComponent(username)}`)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // GAME ACTIONS (Channel Point Redemptions)
  // ===========================================================================

  async play(userId: number): Promise<ApiResponse<PlayResult>> {
    try {
      const response = await this.client.post('/api/play', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async rob(userId: number, targetUsername: string): Promise<ApiResponse<RobResult>> {
    try {
      const response = await this.client.post('/api/rob', {
        userId,
        target: targetUsername,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async bail(userId: number): Promise<ApiResponse<BailResult>> {
    try {
      const response = await this.client.post('/api/bail', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async rerollShop(userId: number): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await this.client.post('/api/users/me/shop/reroll', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async openCrate(userId: number): Promise<ApiResponse<{
    crateTier: string
    dropType: string
    reward: {
      item?: { name: string; type: string; tier: string }
      wealth?: { amount: number }
      title?: { title: string; isDuplicate: boolean; duplicateValue?: number }
    }
  }>> {
    try {
      const response = await this.client.post('/api/crates/open', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // HEIST
  // ===========================================================================

  async submitHeistAnswer(
    userId: number,
    answer: string,
    platform: string
  ): Promise<ApiResponse<{
    correct: boolean
    winner?: boolean
    alreadyWon?: boolean
    expired?: boolean
    crateTier?: string
    responseTimeMs?: number
  }>> {
    try {
      const response = await this.client.post('/api/heist', {
        userId,
        answer,
        platform,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getActiveHeist(): Promise<ApiResponse<{
    id: number
    eventType: string
    difficulty: string
    prompt: string
    timeRemainingMs: number
    isActive: boolean
  } | null>> {
    try {
      const response = await this.client.get('/api/heist')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // LEADERBOARDS
  // ===========================================================================

  async getLeaderboard(
    metric: string = 'wealth',
    period: string = 'daily',
    limit: number = 10
  ): Promise<ApiResponse<{ entries: LeaderboardEntry[] }>> {
    try {
      const response = await this.client.get('/api/leaderboards', {
        params: { metric, period, limit },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getUserRank(
    userId: number,
    metric: string = 'wealth'
  ): Promise<ApiResponse<{
    ranks: Record<string, number>
  }>> {
    try {
      const response = await this.client.get('/api/leaderboards/rank', {
        params: { userId, metric },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // JUICERNAUT
  // ===========================================================================

  async getJuicernautSession(announce = false): Promise<ApiResponse<JuicernautSession | null>> {
    try {
      const response = await this.client.get('/api/juicernaut', {
        params: announce ? { announce: 'true' } : {},
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getJuicernautHallOfFame(): Promise<ApiResponse<{
    hallOfFame: Array<{
      rank: number
      username: string
      wins: number
      totalContributed: number
    }>
  }>> {
    try {
      const response = await this.client.get('/api/juicernaut', {
        params: { halloffame: true },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // FACTIONS
  // ===========================================================================

  async getFactions(): Promise<ApiResponse<{
    factions: Array<{
      id: number
      name: string
      memberCount: number
      territoriesControlled: number
    }>
  }>> {
    try {
      const response = await this.client.get('/api/factions')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getUserFaction(userId: number): Promise<ApiResponse<{
    faction: {
      id: number
      name: string
      motto: string | null
      memberCount: number
      territories: Array<{ name: string; buffType: string | null }>
      buffs: Array<{ type: string; value: number; territoryName: string }>
    } | null
    userRank: { rank: number; totalMembers: number; weeklyScore: number } | null
  }>> {
    try {
      const response = await this.client.get('/api/factions/my-faction', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async joinFaction(userId: number, factionName: string): Promise<ApiResponse<{
    success: boolean
    faction?: { name: string }
    assignedTerritory?: string
    error?: string
  }>> {
    try {
      const response = await this.client.post('/api/factions', {
        userId,
        factionName,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async leaveFaction(userId: number): Promise<ApiResponse<{
    success: boolean
    cooldownUntil?: string
    error?: string
  }>> {
    try {
      const response = await this.client.post('/api/factions/leave', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getTerritories(): Promise<ApiResponse<{
    territories: Array<{
      id: number
      name: string
      controllingFaction: { name: string; colorHex: string } | null
      buffType: string | null
      buffValue: number | null
    }>
  }>> {
    try {
      const response = await this.client.get('/api/factions/territories')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // MISSIONS & ACHIEVEMENTS
  // ===========================================================================

  async getMissions(userId: number): Promise<ApiResponse<{
    daily: Array<{
      id: number
      name: string
      description: string
      progress: number
      target: number
      isComplete: boolean
    }>
    weekly: Array<{
      id: number
      name: string
      description: string
      progress: number
      target: number
      isComplete: boolean
    }>
    dailyExpiresAt: string
    weeklyExpiresAt: string
  }>> {
    try {
      const response = await this.client.get('/api/missions', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getAchievements(userId: number): Promise<ApiResponse<{
    categories: Record<string, Array<{
      id: number
      name: string
      description: string
      tier: string
      progress: number
      target: number
      isComplete: boolean
    }>>
    stats: {
      total: number
      completed: number
    }
  }>> {
    try {
      const response = await this.client.get('/api/achievements', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getTitles(userId: number): Promise<ApiResponse<{
    titles: string[]
    equipped: string | null
  }>> {
    try {
      const response = await this.client.get('/api/titles', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async equipTitle(userId: number, title: string | null): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await this.client.post('/api/titles', {
        userId,
        title,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // INVENTORY & SHOP
  // ===========================================================================

  async getInventory(userId: number): Promise<ApiResponse<{
    items: Array<{
      id: number
      itemId: number
      name: string
      type: string
      tier: string
      durability: number
      maxDurability: number
      isEquipped: boolean
      slot: string | null
    }>
    equipped: {
      weapon: { name: string; durability: number } | null
      armor: { name: string; durability: number } | null
      business: { name: string } | null
      housing: { name: string } | null
    }
  }>> {
    try {
      const response = await this.client.get('/api/users/me/inventory', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // HIGH-03: Missing bot API methods for inventory management
  async buyItem(userId: number, itemId: number): Promise<ApiResponse<{
    success: boolean
    item?: { name: string; type: string; tier: string }
    newWealth?: number
    error?: string
  }>> {
    try {
      const response = await this.client.post('/api/users/me/shop/buy', {
        userId,
        itemId,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async equipItem(userId: number, inventoryId: number): Promise<ApiResponse<{
    success: boolean
    item?: { name: string; slot: string }
    previousItem?: { name: string }
  }>> {
    try {
      const response = await this.client.post('/api/users/me/inventory/equip', {
        userId,
        inventoryId,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async unequipItem(userId: number, slot: string): Promise<ApiResponse<{
    success: boolean
    item?: { name: string }
  }>> {
    try {
      const response = await this.client.post('/api/users/me/inventory/unequip', {
        userId,
        slot,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getShop(userId: number): Promise<ApiResponse<{
    items: Array<{
      id: number
      name: string
      type: string
      tier: string
      price: number
      stats: Record<string, number>
    }>
    refreshesAt: string
  }>> {
    try {
      const response = await this.client.get('/api/users/me/shop', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getMarket(): Promise<ApiResponse<{
    items: Array<{
      id: number
      name: string
      type: string
      tier: string
      price: number
      stock: number
      maxStock: number
      isFeatured: boolean
    }>
    rotatesAt: string
  }>> {
    try {
      const response = await this.client.get('/api/market')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getCrates(userId: number): Promise<ApiResponse<{
    crates: Array<{
      id: number
      tier: string
      source: string | null
      isEscrowed: boolean
    }>
    stats: {
      total: number
      maxCrates: number
      byTier: Record<string, number>
    }
  }>> {
    try {
      const response = await this.client.get('/api/crates', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // ADMIN ACTIONS
  // ===========================================================================

  async startSession(platform: string, title?: string): Promise<ApiResponse<{
    id: number
    title: string
    platform: string
  }>> {
    try {
      const response = await this.adminClient.post('/api/juicernaut/admin', {
        action: 'start',
        platform,
        title,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async endSession(sessionId: number): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await this.adminClient.post('/api/juicernaut/admin', {
        action: 'end',
        sessionId,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async giveWealth(userId: number, amount: number): Promise<ApiResponse<{ newWealth: number }>> {
    try {
      const response = await this.adminClient.post('/api/admin/give', {
        userId,
        type: 'wealth',
        amount,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async giveXp(userId: number, amount: number): Promise<ApiResponse<{ newXp: number; newLevel: number }>> {
    try {
      const response = await this.adminClient.post('/api/admin/give', {
        userId,
        type: 'xp',
        amount,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async giveCrate(userId: number, tier: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await this.adminClient.post('/api/admin/give', {
        userId,
        type: 'crate',
        crateTier: tier,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // HIGH-03: Missing admin methods
  async giveItem(userId: number, itemId: number): Promise<ApiResponse<{
    success: boolean
    item?: { name: string; type: string; tier: string }
  }>> {
    try {
      const response = await this.adminClient.post('/api/admin/give', {
        userId,
        type: 'item',
        itemId,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async rotateMarket(): Promise<ApiResponse<{
    success: boolean
    newItems?: number
  }>> {
    try {
      const response = await this.adminClient.post('/api/market/rotate', {})
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // GAMBLING (Phase 11)
  // ===========================================================================

  async playSlots(userId: number, amount: number): Promise<ApiResponse<{
    reels: string[]
    matchCount: number
    multiplier: number
    isJackpot: boolean
    wager: number
    payout: number
    jackpotAmount?: number
    newBalance: number
    xpGained: number
  }>> {
    try {
      const response = await this.client.post('/api/gambling/slots', {
        userId,
        wager: amount,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getJackpotInfo(): Promise<ApiResponse<{
    currentPool: number
    lastWinner?: number
    lastWinAmount?: number
    lastWonAt?: string
  }>> {
    try {
      const response = await this.client.get('/api/gambling/slots')
      return { success: true, data: response.data.data?.jackpot }
    } catch (error) {
      return this.handleError(error)
    }
  }

  async blackjackAction(
    userId: number,
    action: 'start' | 'hit' | 'stand' | 'double',
    wager?: number
  ): Promise<ApiResponse<{
    sessionId: number
    playerCards: Array<{ rank: string; suit: string }>
    dealerCards: Array<{ rank: string; suit: string }>
    playerValue: number
    dealerValue?: number
    wager: number
    status: string
    result?: string
    payout?: number
    newBalance?: number
    canDouble: boolean
    canSplit: boolean
  }>> {
    try {
      const response = await this.client.post('/api/gambling/blackjack', {
        userId,
        action,
        wager,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async coinflipAction(
    userId: number,
    action: 'create' | 'accept' | 'cancel',
    wager?: number,
    call?: 'heads' | 'tails',
    challengeId?: number
  ): Promise<ApiResponse<{
    success: boolean
    challengeId?: number
    result?: string
    winnerId?: number
    winnerName?: string
    payout?: number
    message: string
  }>> {
    try {
      const response = await this.client.post('/api/gambling/coinflip', {
        userId,
        action,
        wager,
        call,
        challengeId,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getOpenCoinflips(): Promise<ApiResponse<{
    challenges: Array<{
      id: number
      challengerId: number
      challenger: { id: number; displayName: string | null; username: string; level: number }
      wagerAmount: number
      challengerCall: string
      expiresAt: string
    }>
  }>> {
    try {
      const response = await this.client.get('/api/gambling/coinflip')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async buyLotteryTicket(userId: number, numbers: number[]): Promise<ApiResponse<{
    ticketId: number
    drawId: number
    numbers: number[]
    cost: number
  }>> {
    try {
      const response = await this.client.post('/api/gambling/lottery', {
        userId,
        numbers,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getCurrentLottery(): Promise<ApiResponse<{
    lottery: {
      id: number
      prizePool: number
      ticketCount: number
      drawAt: string
    } | null
  }>> {
    try {
      const response = await this.client.get('/api/gambling/lottery')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getGamblingStats(userId: number): Promise<ApiResponse<{
    stats: {
      totalWagered: number
      totalWon: number
      totalLost: number
      netProfit: number
      slotsPlayed: number
      slotsWon: number
      blackjackPlayed: number
      blackjackWon: number
      coinflipsPlayed: number
      coinflipsWon: number
      bestWinStreak: number
      worstLossStreak: number
      jackpotsHit: number
    } | null
  }>> {
    try {
      const response = await this.client.get('/api/gambling/stats', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // SUPPLY DEPOT & BUFFS (Phase 6)
  // ===========================================================================

  async getUserBuffs(userId: number): Promise<ApiResponse<{
    buffs: Array<{
      buffType: string
      category: string | null
      multiplier: number
      source: string
      description: string | null
      remainingMinutes: number | null
      expiresAt: string | null
    }>
    expiringBuffs: Array<{
      buffType: string
      description: string | null
      remainingMinutes: number | null
    }>
    totalActive: number
  }>> {
    try {
      const response = await this.client.get(`/api/users/${userId}/buffs`)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getSupplyCatalog(): Promise<ApiResponse<{
    consumables: Array<{
      id: string
      name: string
      category: string
      cost: number
      description: string | null
      isDurationBuff: boolean
      durationHours: number | null
      buffKey: string | null
      buffValue: number | null
      isSingleUse: boolean
      maxOwned: number | null
    }>
  }>> {
    try {
      const response = await this.client.get('/api/shop/supplies')
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getUserSupplyInventory(userId: number): Promise<ApiResponse<{
    inventory: Array<{
      consumableId: string
      name: string
      quantity: number
      maxOwned: number | null
    }>
  }>> {
    try {
      const response = await this.client.get('/api/shop/supplies/inventory', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async purchaseConsumable(userId: number, consumableId: string): Promise<ApiResponse<{
    success: boolean
    consumableName?: string
    pricePaid?: number
    newWealth?: number
    buffApplied?: boolean
    wasExtension?: boolean
    wasUpgrade?: boolean
    wasDowngrade?: boolean
    quantityNow?: number
    reason?: string
  }>> {
    try {
      const response = await this.client.post('/api/shop/supplies/purchase', {
        userId,
        consumableId,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // TOKENS (Phase 3 - Play Gating Currency)
  // ===========================================================================

  async getTokenStatus(userId: number): Promise<ApiResponse<{
    tokens: number
    tokensEarnedToday: number
    softCap: number
    hardCap: number
    aboveSoftCap: boolean
    atHardCap: boolean
    nextConversionCost: number
  }>> {
    try {
      const response = await this.client.get('/api/tokens', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async convertCreditsToTokens(userId: number): Promise<ApiResponse<{
    success: boolean
    tokensGained: number
    cost: number
    newBalance: number
    message: string
  }>> {
    try {
      const response = await this.client.post('/api/tokens', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // BONDS (Phase 4 - Premium Currency)
  // ===========================================================================

  async getBondStatus(userId: number): Promise<ApiResponse<{
    bonds: number
    lastBondConversion: string | null
    daysUntilNextConversion: number
    canConvert: boolean
    conversionCost: number
    conversionReward: number
    requiredLevel: number
  }>> {
    try {
      const response = await this.client.get('/api/bonds', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async convertCreditsToBonds(userId: number): Promise<ApiResponse<{
    success: boolean
    bondsGained: number
    cost: number
    newBalance: number
    message: string
  }>> {
    try {
      const response = await this.client.post('/api/bonds', { userId })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getBondPurchaseOptions(userId: number): Promise<ApiResponse<{
    currentBonds: number
    cosmetics: Array<{
      type: string
      cost: number
      canAfford: boolean
    }>
    seasonPass: {
      cost: number
      durationDays: number
      canAfford: boolean
    }
  }>> {
    try {
      const response = await this.client.get('/api/bonds/purchase', {
        params: { userId },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async purchaseWithBonds(
    userId: number,
    type: 'cosmetic' | 'season_pass',
    cosmeticType?: string,
    cosmeticName?: string
  ): Promise<ApiResponse<{
    success: boolean
    type: string
    cost: number
    remainingBonds: number
    message: string
  }>> {
    try {
      const response = await this.client.post('/api/bonds/purchase', {
        userId,
        type,
        cosmetic_type: cosmeticType,
        cosmetic_name: cosmeticName,
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getBondHistory(userId: number, limit: number = 10): Promise<ApiResponse<{
    currentBonds: number
    transactions: Array<{
      amount: number
      type: string
      description: string | null
      createdAt: string
      isCredit: boolean
    }>
  }>> {
    try {
      const response = await this.client.get('/api/bonds/history', {
        params: { userId, limit },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  private handleError(error: unknown): ApiResponse<never> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>
      return {
        success: false,
        error: axiosError.response?.data?.error || axiosError.message || 'API request failed',
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
export default apiClient
