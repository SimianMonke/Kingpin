/**
 * Rob Service Tests
 * Tests robbery mechanics including:
 * - Pre-check validations
 * - Success rate calculations
 * - Cooldown management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const { mockFindUnique, mockFindFirst, mockFindMany, mockUpdate, mockCreate, mockTransaction, mockBuffFindFirst } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockBuffFindFirst: vi.fn(),
}))

// Mock the db module
vi.mock('../../db', () => ({
  prisma: {
    users: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    active_buffs: {
      findFirst: mockBuffFindFirst,
    },
    game_events: {
      create: mockCreate,
      findMany: mockFindMany,
    },
    user_inventory: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: mockTransaction,
  },
}))

// Mock dependent services
vi.mock('../jail.service', () => ({
  JailService: {
    getJailStatus: vi.fn(),
    hasCooldown: vi.fn(),
    setCooldown: vi.fn().mockResolvedValue(undefined),
    jailUser: vi.fn().mockResolvedValue(new Date(Date.now() + 60 * 60 * 1000)),
  },
}))

vi.mock('../inventory.service', () => ({
  InventoryService: {
    getEquippedItems: vi.fn(),
    degradeAttackerWeapon: vi.fn(),
    degradeDefenderArmor: vi.fn(),
  },
}))

vi.mock('../leaderboard.service', () => ({
  LeaderboardService: {
    updateSnapshot: vi.fn().mockResolvedValue(undefined),
    checkAndUpdateRecord: vi.fn().mockResolvedValue({ isRecord: false }),
  },
}))

vi.mock('../mission.service', () => ({
  MissionService: { updateProgress: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../achievement.service', () => ({
  AchievementService: { incrementProgress: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../faction.service', () => ({
  FactionService: {
    getAggregatedBuffs: vi.fn().mockResolvedValue({ robBonus: 0, defenseBonus: 0 }),
    addTerritoryScore: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../notification.service', () => ({
  NotificationService: {
    notifyRobbed: vi.fn().mockResolvedValue(undefined),
    notifyRobDefended: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../discord.service', () => ({
  DiscordService: { postItemTheft: vi.fn().mockResolvedValue(undefined) },
}))

import { RobService } from '../rob.service'
import { JailService } from '../jail.service'
import { InventoryService } from '../inventory.service'

describe('RobService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(async (cb) => cb({
      users: { update: mockUpdate, findUnique: mockFindUnique },
      game_events: { create: mockCreate },
      user_inventory: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('canRob', () => {
    it('returns false when attacker is jailed', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: true,
        remainingFormatted: '30m',
        expiresAt: new Date(),
      })

      const result = await RobService.canRob(1, 'target')

      expect(result.canRob).toBe(false)
      expect(result.reason).toContain('jail')
    })

    it('returns false when target not found', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })
      mockFindFirst.mockResolvedValue(null)

      const result = await RobService.canRob(1, 'nonexistent')

      expect(result.canRob).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('returns false when trying to rob yourself', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })
      mockFindFirst.mockResolvedValue({
        id: 1,
        username: 'testuser',
        kingpin_name: null,
        level: 10,
        wealth: BigInt(5000),
      })

      const result = await RobService.canRob(1, 'testuser')

      expect(result.canRob).toBe(false)
      expect(result.reason).toContain("can't rob yourself")
    })

    it('returns false when target has no wealth', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })
      mockFindFirst.mockResolvedValue({
        id: 2,
        username: 'pooruser',
        kingpin_name: null,
        level: 5,
        wealth: BigInt(0),
      })

      const result = await RobService.canRob(1, 'pooruser')

      expect(result.canRob).toBe(false)
      expect(result.reason).toContain('no wealth')
    })

    it('returns false when target has Juicernaut immunity', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })
      mockFindFirst.mockResolvedValue({
        id: 2,
        username: 'juicernaut',
        kingpin_name: null,
        level: 50,
        wealth: BigInt(100000),
      })
      mockBuffFindFirst.mockResolvedValue({
        id: 1,
        user_id: 2,
        buff_type: 'juicernaut_immunity',
        is_active: true,
        expires_at: null,
      })

      const result = await RobService.canRob(1, 'juicernaut')

      expect(result.canRob).toBe(false)
      expect(result.reason).toContain('Juicernaut')
    })

    it('returns false when on cooldown', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })
      mockFindFirst.mockResolvedValue({
        id: 2,
        username: 'target',
        kingpin_name: null,
        level: 10,
        wealth: BigInt(5000),
      })
      mockBuffFindFirst.mockResolvedValue(null)
      vi.mocked(JailService.hasCooldown).mockResolvedValue({
        active: true,
        remainingSeconds: 3600,
        expires_at: new Date(Date.now() + 3600 * 1000),
      })

      const result = await RobService.canRob(1, 'target')

      expect(result.canRob).toBe(false)
      expect(result.reason).toContain('recently')
    })

    it('returns true with success rate when all checks pass', async () => {
      vi.mocked(JailService.getJailStatus).mockResolvedValue({
        isJailed: false,
        remainingFormatted: null,
        expiresAt: null,
      })
      mockFindFirst.mockResolvedValue({
        id: 2,
        username: 'target',
        kingpin_name: null,
        level: 10,
        wealth: BigInt(5000),
      })
      mockFindUnique.mockResolvedValue({ level: 10 })
      mockBuffFindFirst.mockResolvedValue(null)
      vi.mocked(JailService.hasCooldown).mockResolvedValue({
        active: false,
        remainingSeconds: 0,
        expires_at: null,
      })
      vi.mocked(InventoryService.getEquippedItems).mockResolvedValue({
        weapon: null,
        armor: null,
        business: null,
        housing: null,
      })

      const result = await RobService.canRob(1, 'target')

      expect(result.canRob).toBe(true)
      expect(result.successRate).toBeGreaterThanOrEqual(45)
      expect(result.successRate).toBeLessThanOrEqual(85)
    })
  })

  // Note: executeRob tests require comprehensive mocking of:
  // - Transaction callbacks
  // - FactionService.getAggregatedBuffs response
  // - Multiple service dependencies
  // These are better suited for integration tests with a test database
  // The core business logic (success rates, steal calculations) is tested via formulas.test.ts

  describe('getRobHistory', () => {
    it('returns formatted rob events', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          event_type: 'rob',
          wealth_change: BigInt(5000),
          success: true,
          event_description: 'Robbed target for $5,000',
          created_at: new Date(),
          users_game_events_target_user_idTousers: {
            username: 'victim',
            kingpin_name: null,
          },
        },
      ])

      const history = await RobService.getRobHistory(1)

      expect(history).toHaveLength(1)
      expect(history[0].event_type).toBe('rob')
      expect(history[0].wealth_change).toBe(BigInt(5000))
    })
  })
})
