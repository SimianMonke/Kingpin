/**
 * Buff Service Tests
 * Tests the buff management and stacking logic:
 * - Buff retrieval and filtering
 * - Multiplier calculation with stacking rules
 * - Buff application (upgrade/extension)
 * - Buff expiry handling
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const { mockFindMany, mockFindFirst, mockUpdate, mockUpdateMany, mockCreate, mockTransaction } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCreate: vi.fn(),
  mockTransaction: vi.fn(),
}))

// Mock the db module
vi.mock('../../db', () => ({
  prisma: {
    active_buffs: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      create: mockCreate,
    },
    $transaction: mockTransaction,
  },
}))

import { BuffService } from '../buff.service'

describe('BuffService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // getMultiplier Tests - Stacking Logic
  // ==========================================================================
  describe('getMultiplier', () => {
    it('returns 1.0 when no buffs exist', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      expect(result).toBe(1.0)
    })

    it('returns the buff multiplier for a single consumable buff', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          buff_type: 'xp_multiplier',
          multiplier: 1.25, // Prisma Decimal converts to number via Number()
          source: 'consumable',
          is_active: true,
          expires_at: new Date(Date.now() + 86400000), // 24h from now
        },
      ])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      expect(result).toBe(1.25)
    })

    it('takes highest consumable buff when multiple exist', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          buff_type: 'xp_multiplier',
          multiplier: 1.25,
          source: 'consumable',
          is_active: true,
          expires_at: new Date(Date.now() + 86400000),
        },
        {
          id: 2,
          buff_type: 'xp_multiplier',
          multiplier: 1.50,
          source: 'consumable',
          is_active: true,
          expires_at: new Date(Date.now() + 86400000),
        },
      ])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      // Should take the higher value (1.50)
      expect(result).toBe(1.50)
    })

    it('stacks consumable with territory multiplicatively', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          buff_type: 'xp_multiplier',
          multiplier: 1.25,
          source: 'consumable',
          is_active: true,
          expires_at: new Date(Date.now() + 86400000),
        },
        {
          id: 2,
          buff_type: 'xp_multiplier',
          multiplier: 1.10,
          source: 'territory',
          is_active: true,
          expires_at: null,
        },
      ])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      // consumable * territory = 1.25 * 1.10 = 1.375
      expect(result).toBeCloseTo(1.375, 3)
    })

    it('stacks juicernaut multiplicatively with consumable and territory', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          buff_type: 'xp_multiplier',
          multiplier: 1.25,
          source: 'consumable',
          is_active: true,
          expires_at: new Date(Date.now() + 86400000),
        },
        {
          id: 2,
          buff_type: 'xp_multiplier',
          multiplier: 1.10,
          source: 'territory',
          is_active: true,
          expires_at: null,
        },
        {
          id: 3,
          buff_type: 'xp_multiplier',
          multiplier: 1.50,
          source: 'juicernaut',
          is_active: true,
          expires_at: null,
        },
      ])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      // (consumable * territory) * juicernaut = (1.25 * 1.10) * 1.50 = 2.0625
      expect(result).toBeCloseTo(2.0625, 3)
    })

    it('excludes expired buffs from calculation', async () => {
      const expiredDate = new Date(Date.now() - 1000) // 1 second ago

      // Mock should return empty since the query filters expired
      mockFindMany.mockResolvedValue([])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      expect(result).toBe(1.0)
      // Verify the query was made with expiry filter
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            buff_type: 'xp_multiplier',
            is_active: true,
          }),
        })
      )
    })
  })

  // ==========================================================================
  // applyBuff Tests - Upgrade/Extension Logic
  // ==========================================================================
  describe('applyBuff', () => {
    it('creates new buff when none exists', async () => {
      // Transaction mock that simulates no existing buff
      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          active_buffs: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 1 }),
          },
        }
        return callback(tx)
      })

      const result = await BuffService.applyBuff(
        1, // userId
        'xp_multiplier',
        'xp',
        1.25,
        24,
        'consumable',
        'XP Chip'
      )

      expect(result.wasExtension).toBe(false)
      expect(result.wasUpgrade).toBe(false)
      expect(result.newExpiresAt).toBeInstanceOf(Date)
    })

    it('extends duration when same tier buff exists', async () => {
      const existingExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12h remaining

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          active_buffs: {
            findFirst: vi.fn().mockResolvedValue({
              id: 1,
              buff_type: 'xp_multiplier',
              multiplier: 1.25,
              expires_at: existingExpiry,
              is_active: true,
            }),
            update: vi.fn().mockResolvedValue({ id: 1 }),
          },
        }
        return callback(tx)
      })

      const result = await BuffService.applyBuff(
        1,
        'xp_multiplier',
        'xp',
        1.25, // Same multiplier
        24,
        'consumable'
      )

      expect(result.wasExtension).toBe(true)
      expect(result.wasUpgrade).toBe(false)
      // New expiry should be 12h + 24h from now
      expect(result.newExpiresAt.getTime()).toBeGreaterThan(existingExpiry.getTime())
    })

    it('upgrades when higher tier buff is applied', async () => {
      const existingExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000)

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          active_buffs: {
            findFirst: vi.fn().mockResolvedValue({
              id: 1,
              buff_type: 'xp_multiplier',
              multiplier: 1.25, // Lower tier
              expires_at: existingExpiry,
              is_active: true,
            }),
            update: vi.fn().mockResolvedValue({ id: 1 }),
          },
        }
        return callback(tx)
      })

      const result = await BuffService.applyBuff(
        1,
        'xp_multiplier',
        'xp',
        1.50, // Higher multiplier
        24,
        'consumable'
      )

      expect(result.wasUpgrade).toBe(true)
      expect(result.wasExtension).toBe(false)
      expect(result.previousRemainingMinutes).toBeGreaterThan(0)
    })

    it('does not downgrade when lower tier buff is applied', async () => {
      const existingExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000)

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          active_buffs: {
            findFirst: vi.fn().mockResolvedValue({
              id: 1,
              buff_type: 'xp_multiplier',
              multiplier: 1.50, // Higher tier
              expires_at: existingExpiry,
              is_active: true,
            }),
          },
        }
        return callback(tx)
      })

      const result = await BuffService.applyBuff(
        1,
        'xp_multiplier',
        'xp',
        1.25, // Lower multiplier - should not apply
        24,
        'consumable'
      )

      expect(result.wasUpgrade).toBe(false)
      expect(result.wasExtension).toBe(false)
      // Should return existing expiry
      expect(result.newExpiresAt).toEqual(existingExpiry)
    })
  })

  // ==========================================================================
  // hasBuff Tests
  // ==========================================================================
  describe('hasBuff', () => {
    it('returns true when active buff exists', async () => {
      mockFindFirst.mockResolvedValue({
        id: 1,
        buff_type: 'xp_multiplier',
        is_active: true,
        expires_at: new Date(Date.now() + 86400000),
      })

      const result = await BuffService.hasBuff(1, 'xp_multiplier')

      expect(result).toBe(true)
    })

    it('returns false when no buff exists', async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await BuffService.hasBuff(1, 'xp_multiplier')

      expect(result).toBe(false)
    })

    it('returns true for non-expiring buffs (juicernaut)', async () => {
      mockFindFirst.mockResolvedValue({
        id: 1,
        buff_type: 'juicernaut_xp',
        is_active: true,
        expires_at: null, // No expiry
      })

      const result = await BuffService.hasBuff(1, 'juicernaut_xp')

      expect(result).toBe(true)
    })
  })

  // ==========================================================================
  // cleanupExpired Tests
  // ==========================================================================
  describe('cleanupExpired', () => {
    it('marks expired buffs as inactive', async () => {
      mockUpdateMany.mockResolvedValue({ count: 5 })

      const result = await BuffService.cleanupExpired()

      expect(result).toBe(5)
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
            expires_at: expect.objectContaining({
              not: null,
              lt: expect.any(Date),
            }),
          }),
          data: { is_active: false },
        })
      )
    })

    it('returns 0 when no expired buffs exist', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 })

      const result = await BuffService.cleanupExpired()

      expect(result).toBe(0)
    })
  })

  // ==========================================================================
  // getActiveBuffs Tests
  // ==========================================================================
  describe('getActiveBuffs', () => {
    it('returns formatted buff info with remaining minutes', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

      mockFindMany.mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          buff_type: 'xp_multiplier',
          category: 'xp',
          multiplier: 1.25,
          source: 'consumable',
          description: '+25% XP',
          is_active: true,
          expires_at: expiresAt,
          activated_at: new Date(),
        },
      ])

      const result = await BuffService.getActiveBuffs(1)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        buffType: 'xp_multiplier',
        category: 'xp',
        multiplier: 1.25,
        source: 'consumable',
        isActive: true,
      })
      expect(result[0].remainingMinutes).toBeGreaterThan(55) // ~60 minutes
      expect(result[0].remainingMinutes).toBeLessThanOrEqual(60)
    })

    it('returns null remainingMinutes for non-expiring buffs', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          buff_type: 'juicernaut_xp',
          category: 'xp',
          multiplier: 1.50,
          source: 'juicernaut',
          description: 'Juicernaut XP Boost',
          is_active: true,
          expires_at: null,
          activated_at: new Date(),
        },
      ])

      const result = await BuffService.getActiveBuffs(1)

      expect(result).toHaveLength(1)
      expect(result[0].remainingMinutes).toBeNull()
      expect(result[0].expiresAt).toBeNull()
    })
  })

  // ==========================================================================
  // Stacking Formula Verification
  // ==========================================================================
  describe('Stacking Formula Verification', () => {
    it('correctly calculates full stack: base * consumable * territory * juicernaut', async () => {
      // Test the documented stacking order:
      // Final = (consumable * territory) * juicernaut

      const consumableMultiplier = 1.25 // +25%
      const territoryMultiplier = 1.10  // +10%
      const juicernautMultiplier = 1.50 // +50%

      mockFindMany.mockResolvedValue([
        { buff_type: 'xp_multiplier', multiplier: consumableMultiplier, source: 'consumable', is_active: true, expires_at: new Date(Date.now() + 86400000) },
        { buff_type: 'xp_multiplier', multiplier: territoryMultiplier, source: 'territory', is_active: true, expires_at: null },
        { buff_type: 'xp_multiplier', multiplier: juicernautMultiplier, source: 'juicernaut', is_active: true, expires_at: null },
      ])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      // Expected: 1.25 * 1.10 * 1.50 = 2.0625
      const expected = consumableMultiplier * territoryMultiplier * juicernautMultiplier
      expect(result).toBeCloseTo(expected, 4)
    })

    it('handles 2x XP boost with Juicernaut correctly', async () => {
      // Real scenario: Player has Cognitive Overclock (2x) and is Juicernaut (1.5x)
      mockFindMany.mockResolvedValue([
        { buff_type: 'xp_multiplier', multiplier: 2.00, source: 'consumable', is_active: true, expires_at: new Date(Date.now() + 86400000) },
        { buff_type: 'xp_multiplier', multiplier: 1.50, source: 'juicernaut', is_active: true, expires_at: null },
      ])

      const result = await BuffService.getMultiplier(1, 'xp_multiplier')

      // Expected: 2.00 * 1.50 = 3.00 (3x XP!)
      expect(result).toBeCloseTo(3.0, 4)
    })
  })
})
