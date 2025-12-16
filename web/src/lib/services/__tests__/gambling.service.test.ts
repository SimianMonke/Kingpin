/**
 * Gambling Service Tests
 * Tests gambling mechanics including:
 * - Pre-check validations
 * - Bet limits by tier
 * - Payout calculations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const { mockFindUnique, mockFindFirst, mockCreate, mockUpdate, mockUpsert, mockTransaction } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpsert: vi.fn(),
  mockTransaction: vi.fn(),
}))

// Mock the db module
vi.mock('@/lib/db', () => ({
  prisma: {
    users: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    cooldowns: {
      findFirst: mockFindFirst,
    },
    gambling_sessions: {
      create: mockCreate,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    player_gambling_stats: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
    slot_jackpots: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    game_events: {
      create: mockCreate,
    },
    coinflip_challenges: {
      findFirst: mockFindFirst,
      create: mockCreate,
    },
    $transaction: mockTransaction,
  },
}))

import { GamblingService } from '../gambling.service'
import { GAMBLING_CONFIG } from '@/lib/game/constants'

describe('GamblingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(async (cb) => cb({
      users: { update: mockUpdate, findUnique: mockFindUnique },
      gambling_sessions: { create: mockCreate, update: mockUpdate, findFirst: mockFindFirst },
      player_gambling_stats: { upsert: mockUpsert, findUnique: mockFindUnique },
      slot_jackpots: { update: mockUpdate, findFirst: mockFindFirst },
      game_events: { create: mockCreate },
      coinflip_challenges: { create: mockCreate, findFirst: mockFindFirst },
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('canGamble', () => {
    it('returns false when user not found', async () => {
      mockFindUnique.mockResolvedValue(null)

      const result = await GamblingService.canGamble(1)

      expect(result.canGamble).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('returns false when user is jailed', async () => {
      mockFindUnique.mockResolvedValue({
        wealth: BigInt(10000),
        level: 10,
      })
      mockFindFirst.mockResolvedValue({
        id: 1,
        user_id: 1,
        command_type: 'jail',
        expires_at: new Date(Date.now() + 60000),
      })

      const result = await GamblingService.canGamble(1)

      expect(result.canGamble).toBe(false)
      expect(result.reason).toContain('jail')
    })

    it('returns false when wealth is below minimum bet', async () => {
      mockFindUnique.mockResolvedValue({
        wealth: BigInt(GAMBLING_CONFIG.MIN_BET - 1),
        level: 10,
      })
      mockFindFirst.mockResolvedValue(null)

      const result = await GamblingService.canGamble(1)

      expect(result.canGamble).toBe(false)
      expect(result.reason).toContain('Minimum bet')
    })

    it('returns true with correct tier info', async () => {
      mockFindUnique.mockResolvedValue({
        wealth: BigInt(100000),
        level: 50,
      })
      mockFindFirst.mockResolvedValue(null)

      const result = await GamblingService.canGamble(1)

      expect(result.canGamble).toBe(true)
      expect(result.tier).toBe('Soldier')
      expect(result.maxBet).toBeGreaterThan(0)
    })

    it('Kingpin gets higher max bet than Rookie', async () => {
      mockFindUnique.mockResolvedValue({
        wealth: BigInt(1000000),
        level: 100,
      })
      mockFindFirst.mockResolvedValue(null)

      const kingpinResult = await GamblingService.canGamble(1)

      mockFindUnique.mockResolvedValue({
        wealth: BigInt(1000000),
        level: 10,
      })
      mockFindFirst.mockResolvedValue(null)

      const rookieResult = await GamblingService.canGamble(2)

      expect(kingpinResult.maxBet).toBeGreaterThan(rookieResult.maxBet)
    })
  })

  describe('playSlots validation', () => {
    beforeEach(() => {
      mockFindUnique.mockResolvedValue({
        wealth: BigInt(100000),
        level: 50,
      })
      mockFindFirst.mockResolvedValue(null)
    })

    it('throws error when bet is below minimum', async () => {
      await expect(
        GamblingService.playSlots(1, BigInt(GAMBLING_CONFIG.MIN_BET - 1))
      ).rejects.toThrow('Minimum bet')
    })

    it('throws error when bet exceeds max for tier', async () => {
      await expect(
        GamblingService.playSlots(1, BigInt(999999999))
      ).rejects.toThrow('Maximum bet')
    })

    // Note: Full playSlots execution tests require comprehensive transaction mocking
    // Payout calculations are verified in the "Gambling Payout Verification" suite below
  })

  describe('blackjack', () => {
    beforeEach(() => {
      // First call for canGamble user check
      mockFindUnique
        .mockResolvedValueOnce({
          id: 1,
          wealth: BigInt(100000),
          level: 50,
        })
        // Second call for player stats (null = new player)
        .mockResolvedValue(null)

      // First for jail check, second for existing session check
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ session_id: 123 })
      mockUpdate.mockResolvedValue({ wealth: BigInt(99000) })
    })

    it('startBlackjack creates a valid session', async () => {
      const state = await GamblingService.startBlackjack(1, BigInt(1000))

      expect(state).toHaveProperty('session_id')
      expect(state).toHaveProperty('playerCards')
      expect(state).toHaveProperty('dealerCards')
      expect(state.playerCards).toHaveLength(2)
      expect(state.dealerCards).toHaveLength(1)
      expect(state.dealerHidden).toBeDefined()
      expect(['playing', 'blackjack']).toContain(state.status)
    })
  })

  // Note: Coinflip tests require mocking coin_flip_challenges table
  // which is complex to set up. These are better tested via integration tests.
})

// Pure formula verification tests (use actual formulas)
describe('Gambling Payout Verification', () => {
  describe('Slots payouts', () => {
    it('three of a kind gives positive multiplier', async () => {
      const { calculateSlotsPayout } = await import('@/lib/game/formulas')
      const result = calculateSlotsPayout(['💎', '💎', '💎'])

      expect(result.matchCount).toBe(3)
      expect(result.multiplier).toBeGreaterThan(0)
    })

    it('no match gives zero multiplier', async () => {
      const { calculateSlotsPayout } = await import('@/lib/game/formulas')
      const result = calculateSlotsPayout(['💎', '🍒', '7️⃣'])

      expect(result.matchCount).toBe(0)
      expect(result.multiplier).toBe(0)
    })

    it('jackpot symbol triggers jackpot flag', async () => {
      const { calculateSlotsPayout } = await import('@/lib/game/formulas')
      const result = calculateSlotsPayout(['🎰', '🎰', '🎰'])

      expect(result.isJackpot).toBe(true)
    })
  })

  describe('Blackjack hand values', () => {
    it('face cards count as 10', async () => {
      const { calculateBlackjackHand } = await import('@/lib/game/formulas')
      const hand = calculateBlackjackHand([
        { rank: 'K', suit: '♠' },
        { rank: 'Q', suit: '♥' },
      ])

      expect(hand.value).toBe(20)
    })

    it('aces adjust when busting', async () => {
      const { calculateBlackjackHand } = await import('@/lib/game/formulas')
      const hand = calculateBlackjackHand([
        { rank: 'A', suit: '♠' },
        { rank: '8', suit: '♥' },
        { rank: '6', suit: '♦' },
      ])

      expect(hand.value).toBe(15)
      expect(hand.isSoft).toBe(false)
    })
  })

  describe('Lottery payouts', () => {
    it('3 matches returns full pool', async () => {
      const { calculateLotteryPayout } = await import('@/lib/game/formulas')
      const payout = calculateLotteryPayout(3, BigInt(100), BigInt(10000))

      expect(payout).toBe(BigInt(10000))
    })

    it('2 matches returns 10x ticket', async () => {
      const { calculateLotteryPayout } = await import('@/lib/game/formulas')
      const payout = calculateLotteryPayout(2, BigInt(100), BigInt(10000))

      expect(payout).toBe(BigInt(1000))
    })

    it('1 match returns 2x ticket', async () => {
      const { calculateLotteryPayout } = await import('@/lib/game/formulas')
      const payout = calculateLotteryPayout(1, BigInt(100), BigInt(10000))

      expect(payout).toBe(BigInt(200))
    })

    it('0 matches returns nothing', async () => {
      const { calculateLotteryPayout } = await import('@/lib/game/formulas')
      const payout = calculateLotteryPayout(0, BigInt(100), BigInt(10000))

      expect(payout).toBe(BigInt(0))
    })
  })
})
