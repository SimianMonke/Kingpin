/**
 * Play Service Tests
 * Tests the core play functionality including:
 * - Jail status checks
 * - Bust mechanics
 * - Event selection distribution
 * - Crate tier weighting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const { mockFindUnique, mockFindMany, mockUpdate, mockCreate, mockTransaction } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockTransaction: vi.fn(),
}))

// Mock the db module
vi.mock('../../db', () => ({
  prisma: {
    users: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    active_buffs: {
      findMany: mockFindMany,
    },
    game_events: {
      create: mockCreate,
    },
    $transaction: mockTransaction,
  },
}))

// Mock dependent services
vi.mock('../jail.service', () => ({
  JailService: {
    getJailStatus: vi.fn(),
    jailUser: vi.fn(),
  },
}))

vi.mock('../leaderboard.service', () => ({
  LeaderboardService: { updateSnapshot: vi.fn() },
}))

vi.mock('../mission.service', () => ({
  MissionService: { updateProgress: vi.fn() },
}))

vi.mock('../achievement.service', () => ({
  AchievementService: { incrementProgress: vi.fn(), setProgress: vi.fn() },
}))

vi.mock('../crate.service', () => ({
  CrateService: { awardCrate: vi.fn() },
}))

vi.mock('../faction.service', () => ({
  FactionService: {
    getAggregatedBuffs: vi.fn().mockResolvedValue({ wealthBonus: 0, xpBonus: 0 }),
    addTerritoryScore: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../notification.service', () => ({
  NotificationService: { notifyLevelUp: vi.fn(), notifyTierPromotion: vi.fn() },
}))

vi.mock('../discord.service', () => ({
  DiscordService: { postTierPromotion: vi.fn() },
}))

// Import after mocks
import { PlayService } from '../play.service'
import { JailService } from '../jail.service'

describe('PlayService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(async (cb) => cb({
      users: { update: mockUpdate },
      game_events: { create: mockCreate },
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('canPlay', () => {
    it('returns false when user is jailed', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: true,
        remainingFormatted: '45m 30s',
        expiresAt: new Date(Date.now() + 45 * 60 * 1000),
      })

      const result = await PlayService.canPlay(1)

      expect(result.canPlay).toBe(false)
      expect(result.isJailed).toBe(true)
      expect(result.reason).toContain('jail')
    })

    it('returns true when user is not jailed', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })

      const result = await PlayService.canPlay(1)

      expect(result.canPlay).toBe(true)
      expect(result.isJailed).toBe(false)
    })
  })

  describe('selectEvent', () => {
    it('returns a valid event for Rookie tier', () => {
      const event = PlayService.selectEvent('Rookie')

      expect(event).toBeDefined()
      expect(event.name).toBeDefined()
      expect(event.wealth).toBeDefined()
      expect(event.xp).toBeDefined()
    })

    it('returns negative event ~15% of the time', () => {
      const iterations = 1000
      let negativeCount = 0

      for (let i = 0; i < iterations; i++) {
        const event = PlayService.selectEvent('Rookie')
        if (event.isNegative) {
          negativeCount++
        }
      }

      // Should be roughly 15% ± 5%
      const percentage = negativeCount / iterations
      expect(percentage).toBeGreaterThan(0.10)
      expect(percentage).toBeLessThan(0.20)
    })
  })

  describe('rollCrateTier', () => {
    it('returns a valid crate tier', () => {
      const validTiers = ['common', 'uncommon', 'rare', 'legendary']
      const tier = PlayService.rollCrateTier('Rookie')

      expect(validTiers).toContain(tier)
    })

    it('weighted distribution favors common crates for Rookie', () => {
      const iterations = 1000
      const counts = { common: 0, uncommon: 0, rare: 0, legendary: 0 }

      for (let i = 0; i < iterations; i++) {
        const tier = PlayService.rollCrateTier('Rookie')
        counts[tier as keyof typeof counts]++
      }

      expect(counts.common).toBeGreaterThan(counts.uncommon)
      expect(counts.uncommon).toBeGreaterThan(counts.rare)
    })

    it('higher tier players get better crate distribution', () => {
      const rookieCounts = { common: 0, uncommon: 0, rare: 0, legendary: 0 }
      const kingpinCounts = { common: 0, uncommon: 0, rare: 0, legendary: 0 }
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        const rookieTier = PlayService.rollCrateTier('Rookie')
        const kingpinTier = PlayService.rollCrateTier('Kingpin')
        rookieCounts[rookieTier as keyof typeof rookieCounts]++
        kingpinCounts[kingpinTier as keyof typeof kingpinCounts]++
      }

      const rookieRarePlus = rookieCounts.rare + rookieCounts.legendary
      const kingpinRarePlus = kingpinCounts.rare + kingpinCounts.legendary
      expect(kingpinRarePlus).toBeGreaterThan(rookieRarePlus)
    })
  })

  describe('executePlay', () => {
    beforeEach(() => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })

      mockFindUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        wealth: BigInt(10000),
        xp: BigInt(500),
        level: 10,
        status_tier: 'Rookie',
        total_play_count: 50,
      })

      mockFindMany.mockResolvedValue([])
    })

    it('returns failure when user cannot play', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: true,
        remainingFormatted: '30m',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })

      const result = await PlayService.executePlay(1)

      expect(result.success).toBe(false)
      expect(result.jailed).toBe(true)
      expect(result.wealth_earned).toBe(0)
    })

    it('handles bust scenario (5% chance)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.01)
      vi.mocked(JailService.jailUser).mockResolvedValue(
        new Date(Date.now() + 60 * 60 * 1000)
      )

      const result = await PlayService.executePlay(1)

      expect(result.busted).toBe(true)
      expect(result.jailed).toBe(true)
      expect(result.wealth_earned).toBe(0)
    })

    // Note: Transaction-based tests require comprehensive integration testing
    // The transaction pattern is verified via code review and integration tests
  })

  describe('getJuicernautBuffs', () => {
    it('returns no buffs when none active', async () => {
      mockFindMany.mockResolvedValue([])

      const buffs = await PlayService.getJuicernautBuffs(1)

      expect(buffs.isJuicernaut).toBe(false)
      expect(buffs.hasWealthBuff).toBe(false)
    })

    it('detects active Juicernaut buffs', async () => {
      mockFindMany.mockResolvedValue([
        { buff_type: 'juicernaut_wealth', is_active: true, expires_at: null },
        { buff_type: 'juicernaut_xp', is_active: true, expires_at: null },
      ])

      const buffs = await PlayService.getJuicernautBuffs(1)

      expect(buffs.isJuicernaut).toBe(true)
      expect(buffs.hasWealthBuff).toBe(true)
      expect(buffs.hasXpBuff).toBe(true)
    })
  })
})
