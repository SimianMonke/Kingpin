/**
 * Consumable Service Tests
 * Tests the Supply Depot consumable purchase and usage logic:
 * - Catalog retrieval
 * - User inventory management
 * - Purchase flow (duration buffs and single-use items)
 * - Single-use item consumption
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mocks before vi.mock is hoisted
const {
  mockConsumableTypesFindMany,
  mockConsumableTypesFindUnique,
  mockUserConsumablesFindMany,
  mockUserConsumablesFindUnique,
  mockUserConsumablesUpdate,
  mockUserConsumablesCreate,
  mockUsersFindUnique,
  mockUsersUpdate,
  mockConsumablePurchasesCreate,
  mockConsumablePurchasesFindFirst,
  mockConsumablePurchasesUpdate,
  mockConsumablePurchasesAggregate,
  mockGameEventsCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockConsumableTypesFindMany: vi.fn(),
  mockConsumableTypesFindUnique: vi.fn(),
  mockUserConsumablesFindMany: vi.fn(),
  mockUserConsumablesFindUnique: vi.fn(),
  mockUserConsumablesUpdate: vi.fn(),
  mockUserConsumablesCreate: vi.fn(),
  mockUsersFindUnique: vi.fn(),
  mockUsersUpdate: vi.fn(),
  mockConsumablePurchasesCreate: vi.fn(),
  mockConsumablePurchasesFindFirst: vi.fn(),
  mockConsumablePurchasesUpdate: vi.fn(),
  mockConsumablePurchasesAggregate: vi.fn(),
  mockGameEventsCreate: vi.fn(),
  mockTransaction: vi.fn(),
}))

// Mock BuffService
const mockApplyBuff = vi.hoisted(() => vi.fn())
const mockGetBuffInfo = vi.hoisted(() => vi.fn())

vi.mock('../buff.service', () => ({
  BuffService: {
    applyBuff: mockApplyBuff,
    getBuffInfo: mockGetBuffInfo,
  },
}))

// Mock the db module
vi.mock('../../db', () => ({
  prisma: {
    consumable_types: {
      findMany: mockConsumableTypesFindMany,
      findUnique: mockConsumableTypesFindUnique,
    },
    user_consumables: {
      findMany: mockUserConsumablesFindMany,
      findUnique: mockUserConsumablesFindUnique,
      update: mockUserConsumablesUpdate,
      create: mockUserConsumablesCreate,
    },
    users: {
      findUnique: mockUsersFindUnique,
      update: mockUsersUpdate,
    },
    consumable_purchases: {
      create: mockConsumablePurchasesCreate,
      findFirst: mockConsumablePurchasesFindFirst,
      update: mockConsumablePurchasesUpdate,
      aggregate: mockConsumablePurchasesAggregate,
    },
    game_events: {
      create: mockGameEventsCreate,
    },
    $transaction: mockTransaction,
  },
}))

import { ConsumableService } from '../consumable.service'

// Sample test data
const sampleConsumables = [
  {
    id: 'xp_25',
    name: 'XP Chip',
    category: 'xp',
    cost: 25000,
    is_duration_buff: true,
    duration_hours: 24,
    buff_key: 'xp_multiplier',
    buff_value: 1.25,
    is_single_use: false,
    max_owned: null,
    description: '+25% XP gains for 24 hours',
    flavor_text: null,
    icon: 'chip',
    sort_order: 1,
    is_active: true,
    created_at: new Date(),
  },
  {
    id: 'bail_bond',
    name: 'Bail Bond',
    category: 'utility',
    cost: 15000,
    is_duration_buff: false,
    duration_hours: null,
    buff_key: null,
    buff_value: null,
    is_single_use: true,
    max_owned: 5,
    description: 'Skip the 10% bail cost once',
    flavor_text: null,
    icon: 'document',
    sort_order: 30,
    is_active: true,
    created_at: new Date(),
  },
]

describe('ConsumableService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // getCatalog Tests
  // ==========================================================================
  describe('getCatalog', () => {
    it('returns all active consumables', async () => {
      mockConsumableTypesFindMany.mockResolvedValue(sampleConsumables)

      const result = await ConsumableService.getCatalog()

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'xp_25',
        name: 'XP Chip',
        cost: 25000,
        isDurationBuff: true,
        isSingleUse: false,
      })
      expect(result[1]).toMatchObject({
        id: 'bail_bond',
        name: 'Bail Bond',
        isSingleUse: true,
        maxOwned: 5,
      })
    })

    it('orders by sort_order', async () => {
      mockConsumableTypesFindMany.mockResolvedValue(sampleConsumables)

      await ConsumableService.getCatalog()

      expect(mockConsumableTypesFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sort_order: 'asc' },
        })
      )
    })
  })

  // ==========================================================================
  // getUserInventory Tests
  // ==========================================================================
  describe('getUserInventory', () => {
    it('returns user owned single-use consumables', async () => {
      mockUserConsumablesFindMany.mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          consumable_id: 'bail_bond',
          quantity: 3,
          consumable_type: sampleConsumables[1],
        },
      ])

      const result = await ConsumableService.getUserInventory(1)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        consumableId: 'bail_bond',
        name: 'Bail Bond',
        quantity: 3,
        maxOwned: 5,
      })
    })

    it('excludes items with 0 quantity', async () => {
      mockUserConsumablesFindMany.mockResolvedValue([])

      const result = await ConsumableService.getUserInventory(1)

      expect(result).toHaveLength(0)
      expect(mockUserConsumablesFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            quantity: { gt: 0 },
          }),
        })
      )
    })
  })

  // ==========================================================================
  // hasConsumable Tests
  // ==========================================================================
  describe('hasConsumable', () => {
    it('returns true when user has consumable', async () => {
      mockUserConsumablesFindUnique.mockResolvedValue({
        id: 1,
        user_id: 1,
        consumable_id: 'bail_bond',
        quantity: 2,
      })

      const result = await ConsumableService.hasConsumable(1, 'bail_bond')

      expect(result).toBe(true)
    })

    it('returns false when user has 0 quantity', async () => {
      mockUserConsumablesFindUnique.mockResolvedValue({
        id: 1,
        user_id: 1,
        consumable_id: 'bail_bond',
        quantity: 0,
      })

      const result = await ConsumableService.hasConsumable(1, 'bail_bond')

      expect(result).toBe(false)
    })

    it('returns false when user does not have consumable', async () => {
      mockUserConsumablesFindUnique.mockResolvedValue(null)

      const result = await ConsumableService.hasConsumable(1, 'bail_bond')

      expect(result).toBe(false)
    })
  })

  // ==========================================================================
  // getConsumableCount Tests
  // ==========================================================================
  describe('getConsumableCount', () => {
    it('returns quantity when user has consumable', async () => {
      mockUserConsumablesFindUnique.mockResolvedValue({
        id: 1,
        user_id: 1,
        consumable_id: 'bail_bond',
        quantity: 3,
      })

      const result = await ConsumableService.getConsumableCount(1, 'bail_bond')

      expect(result).toBe(3)
    })

    it('returns 0 when user does not have consumable', async () => {
      mockUserConsumablesFindUnique.mockResolvedValue(null)

      const result = await ConsumableService.getConsumableCount(1, 'bail_bond')

      expect(result).toBe(0)
    })
  })

  // ==========================================================================
  // canPurchase Tests
  // ==========================================================================
  describe('canPurchase', () => {
    it('returns canPurchase true when user has enough wealth', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[0]) // xp_25
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(50000) })

      const result = await ConsumableService.canPurchase(1, 'xp_25')

      expect(result.canPurchase).toBe(true)
      expect(result.cost).toBe(25000)
    })

    it('returns canPurchase false when user lacks wealth', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[0])
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(10000) })

      const result = await ConsumableService.canPurchase(1, 'xp_25')

      expect(result.canPurchase).toBe(false)
      expect(result.reason).toContain('Not enough wealth')
    })

    it('returns canPurchase false when at max owned', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[1]) // bail_bond max=5
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(50000) })
      mockUserConsumablesFindUnique.mockResolvedValue({ quantity: 5 })

      const result = await ConsumableService.canPurchase(1, 'bail_bond')

      expect(result.canPurchase).toBe(false)
      expect(result.reason).toContain('maximum')
    })

    it('returns canPurchase false when consumable not found', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(null)

      const result = await ConsumableService.canPurchase(1, 'invalid_id')

      expect(result.canPurchase).toBe(false)
      expect(result.reason).toContain('not found')
    })
  })

  // ==========================================================================
  // purchase Tests - Duration Buffs
  // ==========================================================================
  describe('purchase - duration buffs', () => {
    it('purchases duration buff and applies via BuffService', async () => {
      const xpChip = sampleConsumables[0]
      mockConsumableTypesFindUnique.mockResolvedValue(xpChip)
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(50000) })

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          users: {
            update: vi.fn().mockResolvedValue({ wealth: BigInt(25000) }),
          },
          consumable_purchases: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
          },
          game_events: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
          },
        }
        return callback(tx)
      })

      mockApplyBuff.mockResolvedValue({
        wasExtension: false,
        wasUpgrade: false,
        newExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      mockGetBuffInfo.mockResolvedValue(null)
      mockConsumablePurchasesFindFirst.mockResolvedValue({ id: 1 })
      mockConsumablePurchasesUpdate.mockResolvedValue({ id: 1 })

      const result = await ConsumableService.purchase(1, 'xp_25')

      expect(result.success).toBe(true)
      expect(result.consumableName).toBe('XP Chip')
      expect(result.pricePaid).toBe(25000)
      expect(result.buffApplied).toBe(true)
      expect(mockApplyBuff).toHaveBeenCalledWith(
        1,
        'xp_multiplier',
        'xp',
        1.25,
        24,
        'consumable',
        expect.any(String)
      )
    })

    it('marks wasExtension when extending same tier buff', async () => {
      const xpChip = sampleConsumables[0]
      mockConsumableTypesFindUnique.mockResolvedValue(xpChip)
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(50000) })

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          users: { update: vi.fn().mockResolvedValue({ wealth: BigInt(25000) }) },
          consumable_purchases: { create: vi.fn().mockResolvedValue({ id: 1 }) },
          game_events: { create: vi.fn().mockResolvedValue({ id: 1 }) },
        }
        return callback(tx)
      })

      mockApplyBuff.mockResolvedValue({
        wasExtension: true,
        wasUpgrade: false,
        previousRemainingMinutes: 720,
        newExpiresAt: new Date(Date.now() + 36 * 60 * 60 * 1000),
      })
      mockGetBuffInfo.mockResolvedValue(null)
      mockConsumablePurchasesFindFirst.mockResolvedValue({ id: 1 })
      mockConsumablePurchasesUpdate.mockResolvedValue({ id: 1 })

      const result = await ConsumableService.purchase(1, 'xp_25')

      expect(result.success).toBe(true)
      expect(result.wasExtension).toBe(true)
    })
  })

  // ==========================================================================
  // purchase Tests - Single Use Items
  // ==========================================================================
  describe('purchase - single use items', () => {
    it('purchases single-use item and adds to inventory', async () => {
      const bailBond = sampleConsumables[1]
      mockConsumableTypesFindUnique.mockResolvedValue(bailBond)
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(50000) })
      mockUserConsumablesFindUnique.mockResolvedValue(null) // Not at max

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          users: { update: vi.fn().mockResolvedValue({ wealth: BigInt(35000) }) },
          user_consumables: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 1, quantity: 1 }),
          },
          consumable_purchases: { create: vi.fn().mockResolvedValue({ id: 1 }) },
          game_events: { create: vi.fn().mockResolvedValue({ id: 1 }) },
        }
        return callback(tx)
      })

      const result = await ConsumableService.purchase(1, 'bail_bond')

      expect(result.success).toBe(true)
      expect(result.consumableName).toBe('Bail Bond')
      expect(result.quantityNow).toBe(1)
      expect(result.buffApplied).toBe(false)
    })

    it('increments quantity when user already has item', async () => {
      const bailBond = sampleConsumables[1]
      mockConsumableTypesFindUnique.mockResolvedValue(bailBond)
      mockUsersFindUnique.mockResolvedValue({ wealth: BigInt(50000) })
      mockUserConsumablesFindUnique.mockResolvedValue({ id: 1, quantity: 2 })

      mockTransaction.mockImplementation(async (callback) => {
        const tx = {
          users: { update: vi.fn().mockResolvedValue({ wealth: BigInt(35000) }) },
          user_consumables: {
            findUnique: vi.fn().mockResolvedValue({ id: 1, quantity: 2 }),
            update: vi.fn().mockResolvedValue({ id: 1, quantity: 3 }),
          },
          consumable_purchases: { create: vi.fn().mockResolvedValue({ id: 1 }) },
          game_events: { create: vi.fn().mockResolvedValue({ id: 1 }) },
        }
        return callback(tx)
      })

      const result = await ConsumableService.purchase(1, 'bail_bond')

      expect(result.success).toBe(true)
      expect(result.quantityNow).toBe(3)
    })
  })

  // ==========================================================================
  // useConsumable Tests
  // ==========================================================================
  describe('useConsumable', () => {
    it('decrements quantity when using consumable', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[1]) // bail_bond
      mockUserConsumablesFindUnique.mockResolvedValue({
        id: 1,
        user_id: 1,
        consumable_id: 'bail_bond',
        quantity: 3,
      })
      mockUserConsumablesUpdate.mockResolvedValue({
        id: 1,
        quantity: 2,
      })
      mockGameEventsCreate.mockResolvedValue({ id: 1 })

      const result = await ConsumableService.useConsumable(1, 'bail_bond')

      expect(result.success).toBe(true)
      expect(result.consumableName).toBe('Bail Bond')
      expect(result.quantityRemaining).toBe(2)
    })

    it('fails when user does not own consumable', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[1])
      mockUserConsumablesFindUnique.mockResolvedValue(null)

      const result = await ConsumableService.useConsumable(1, 'bail_bond')

      expect(result.success).toBe(false)
      expect(result.reason).toContain("don't own")
    })

    it('fails when trying to use duration buff item', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[0]) // xp_25 is not single-use

      const result = await ConsumableService.useConsumable(1, 'xp_25')

      expect(result.success).toBe(false)
      expect(result.reason).toContain('not a single-use item')
    })

    it('fails when user has 0 quantity', async () => {
      mockConsumableTypesFindUnique.mockResolvedValue(sampleConsumables[1])
      mockUserConsumablesFindUnique.mockResolvedValue({
        id: 1,
        user_id: 1,
        consumable_id: 'bail_bond',
        quantity: 0,
      })

      const result = await ConsumableService.useConsumable(1, 'bail_bond')

      expect(result.success).toBe(false)
      expect(result.reason).toContain("don't own")
    })
  })

  // ==========================================================================
  // getTotalSpent Tests
  // ==========================================================================
  describe('getTotalSpent', () => {
    it('returns sum of all purchases', async () => {
      mockConsumablePurchasesAggregate.mockResolvedValue({
        _sum: { cost: 100000 },
      })

      const result = await ConsumableService.getTotalSpent(1)

      expect(result).toBe(100000)
    })

    it('returns 0 when no purchases', async () => {
      mockConsumablePurchasesAggregate.mockResolvedValue({
        _sum: { cost: null },
      })

      const result = await ConsumableService.getTotalSpent(1)

      expect(result).toBe(0)
    })
  })

  // ==========================================================================
  // Helper Method Tests
  // ==========================================================================
  describe('mapCategoryToBuffCategory', () => {
    it('maps xp category to xp', () => {
      expect(ConsumableService.mapCategoryToBuffCategory('xp')).toBe('xp')
    })

    it('maps combat category to rob_attack', () => {
      expect(ConsumableService.mapCategoryToBuffCategory('combat')).toBe('rob_attack')
    })

    it('maps economy category to business', () => {
      expect(ConsumableService.mapCategoryToBuffCategory('economy')).toBe('business')
    })

    it('maps unknown category to xp as fallback', () => {
      expect(ConsumableService.mapCategoryToBuffCategory('unknown')).toBe('xp')
    })
  })

  describe('getBuffCategoryFromKey', () => {
    it('maps xp_multiplier to xp', () => {
      expect(ConsumableService.getBuffCategoryFromKey('xp_multiplier')).toBe('xp')
    })

    it('maps rob_attack to rob_attack', () => {
      expect(ConsumableService.getBuffCategoryFromKey('rob_attack')).toBe('rob_attack')
    })

    it('maps business_revenue to business', () => {
      expect(ConsumableService.getBuffCategoryFromKey('business_revenue')).toBe('business')
    })

    it('maps unknown key to xp as fallback', () => {
      expect(ConsumableService.getBuffCategoryFromKey('unknown_key')).toBe('xp')
    })
  })
})
