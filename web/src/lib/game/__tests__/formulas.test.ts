/**
 * Kingpin Formula Tests
 * Tests critical economy calculations to prevent exploits
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import only the functions we need to test
import {
  xpForLevel,
  totalXpForLevel,
  levelFromXp,
  xpProgressInLevel,
  getTierFromLevel,
  getTierMultiplier,
  meetsMinTierLevel,
  calculateRobSuccessRate,
  calculateInsuranceProtection,
  calculateBailCost,
  calculateCheckinRewards,
  getStreakMilestoneReward,
  shouldItemBreak,
  calculateMissionRewards,
  calculateBlackjackHand,
  isBlackjack,
  flipCoin,
  checkLotteryMatch,
  calculateLotteryPayout,
  calculateSlotsPayout,
  formatWealth,
  formatNumber,
} from '../formulas'

// Import only tier constants (small)
import { TIERS } from '../constants'

// =============================================================================
// XP & LEVELING TESTS - Critical for progression balance
// =============================================================================
describe('XP & Leveling', () => {
  describe('xpForLevel', () => {
    it('returns 0 for level < 1', () => {
      expect(xpForLevel(0)).toBe(0)
      expect(xpForLevel(-1)).toBe(0)
    })

    it('returns 100 XP for level 1', () => {
      expect(xpForLevel(1)).toBe(100)
    })

    it('returns 125 XP for level 2 (100 * 1.25^1)', () => {
      expect(xpForLevel(2)).toBe(125)
    })

    it('follows exponential formula: 100 * 1.25^(N-1)', () => {
      expect(xpForLevel(5)).toBe(Math.floor(100 * Math.pow(1.25, 4)))
      expect(xpForLevel(10)).toBe(Math.floor(100 * Math.pow(1.25, 9)))
    })

    it('handles high levels correctly', () => {
      const level100 = xpForLevel(100)
      expect(level100).toBe(Math.floor(100 * Math.pow(1.25, 99)))
      expect(level100).toBeGreaterThan(0)
    })
  })

  describe('totalXpForLevel', () => {
    it('returns 0 for level 0', () => {
      expect(totalXpForLevel(0)).toBe(0)
    })

    it('cumulates XP correctly', () => {
      expect(totalXpForLevel(1)).toBe(100)
      expect(totalXpForLevel(2)).toBe(100 + 125)
      expect(totalXpForLevel(3)).toBe(100 + 125 + Math.floor(100 * Math.pow(1.25, 2)))
    })
  })

  describe('levelFromXp', () => {
    it('returns level 1 for 0 XP', () => {
      expect(levelFromXp(0)).toBe(1)
    })

    it('returns level 1 for 99 XP (not enough for level 2)', () => {
      expect(levelFromXp(99)).toBe(1)
    })

    it('returns level 2 at exactly 100 XP', () => {
      expect(levelFromXp(100)).toBe(2)
    })

    it('caps at level 200 to prevent infinite loops', () => {
      // MAX_SAFE_INTEGER reaches level ~138 due to exponential XP growth
      // The cap is at 200 for safety, but XP requirements exceed JS number limits before then
      const result = levelFromXp(Number.MAX_SAFE_INTEGER)
      expect(result).toBeGreaterThanOrEqual(100) // Should reach high level
      expect(result).toBeLessThanOrEqual(200) // Should be capped
    })
  })

  describe('xpProgressInLevel', () => {
    it('calculates progress correctly', () => {
      const progress = xpProgressInLevel(150)
      expect(progress.current).toBe(50)
      expect(progress.required).toBe(125)
      expect(progress.percentage).toBe(40)
    })
  })
})

// =============================================================================
// TIER SYSTEM TESTS - Critical for reward multipliers
// =============================================================================
describe('Tier System', () => {
  describe('getTierFromLevel', () => {
    it('returns Rookie for levels 1-19', () => {
      expect(getTierFromLevel(1)).toBe(TIERS.ROOKIE)
      expect(getTierFromLevel(19)).toBe(TIERS.ROOKIE)
    })

    it('returns Associate for levels 20-39', () => {
      expect(getTierFromLevel(20)).toBe(TIERS.ASSOCIATE)
      expect(getTierFromLevel(39)).toBe(TIERS.ASSOCIATE)
    })

    it('returns Soldier for levels 40-59', () => {
      expect(getTierFromLevel(40)).toBe(TIERS.SOLDIER)
      expect(getTierFromLevel(59)).toBe(TIERS.SOLDIER)
    })

    it('returns Captain for levels 60-79', () => {
      expect(getTierFromLevel(60)).toBe(TIERS.CAPTAIN)
      expect(getTierFromLevel(79)).toBe(TIERS.CAPTAIN)
    })

    it('returns Underboss for levels 80-99', () => {
      expect(getTierFromLevel(80)).toBe(TIERS.UNDERBOSS)
      expect(getTierFromLevel(99)).toBe(TIERS.UNDERBOSS)
    })

    it('returns Kingpin for levels 100+', () => {
      expect(getTierFromLevel(100)).toBe(TIERS.KINGPIN)
      expect(getTierFromLevel(200)).toBe(TIERS.KINGPIN)
    })
  })

  describe('getTierMultiplier', () => {
    it('returns correct multipliers for each tier', () => {
      expect(getTierMultiplier(TIERS.ROOKIE)).toBe(1.0)
      expect(getTierMultiplier(TIERS.ASSOCIATE)).toBe(1.1)
      expect(getTierMultiplier(TIERS.SOLDIER)).toBe(1.2)
      expect(getTierMultiplier(TIERS.CAPTAIN)).toBe(1.3)
      expect(getTierMultiplier(TIERS.UNDERBOSS)).toBe(1.4)
      expect(getTierMultiplier(TIERS.KINGPIN)).toBe(1.5)
    })
  })

  describe('meetsMinTierLevel', () => {
    it('correctly checks tier requirements', () => {
      expect(meetsMinTierLevel(1, TIERS.ROOKIE)).toBe(true)
      expect(meetsMinTierLevel(19, TIERS.ASSOCIATE)).toBe(false)
      expect(meetsMinTierLevel(20, TIERS.ASSOCIATE)).toBe(true)
      expect(meetsMinTierLevel(100, TIERS.KINGPIN)).toBe(true)
    })
  })
})

// =============================================================================
// ROBBERY CALCULATION TESTS - Critical for PvP economy
// =============================================================================
describe('Robbery Calculations', () => {
  describe('calculateRobSuccessRate', () => {
    it('returns base rate (60%) with no modifiers', () => {
      const rate = calculateRobSuccessRate({
        attackerLevel: 50,
        defenderLevel: 50,
        attackerWeaponBonus: 0,
        defenderArmorBonus: 0,
      })
      expect(rate).toBe(0.60)
    })

    it('adds weapon bonus correctly', () => {
      const rate = calculateRobSuccessRate({
        attackerLevel: 50,
        defenderLevel: 50,
        attackerWeaponBonus: 0.10,
        defenderArmorBonus: 0,
      })
      expect(rate).toBe(0.70)
    })

    it('caps weapon bonus at 15%', () => {
      const rate = calculateRobSuccessRate({
        attackerLevel: 50,
        defenderLevel: 50,
        attackerWeaponBonus: 0.25,
        defenderArmorBonus: 0,
      })
      expect(rate).toBe(0.75)
    })

    it('subtracts armor reduction correctly', () => {
      const rate = calculateRobSuccessRate({
        attackerLevel: 50,
        defenderLevel: 50,
        attackerWeaponBonus: 0,
        defenderArmorBonus: 0.10,
      })
      expect(rate).toBe(0.50)
    })

    it('applies level difference modifier (max ±10%)', () => {
      const higherRate = calculateRobSuccessRate({
        attackerLevel: 60,
        defenderLevel: 50,
        attackerWeaponBonus: 0,
        defenderArmorBonus: 0,
      })
      expect(higherRate).toBe(0.70)

      const lowerRate = calculateRobSuccessRate({
        attackerLevel: 40,
        defenderLevel: 50,
        attackerWeaponBonus: 0,
        defenderArmorBonus: 0,
      })
      expect(lowerRate).toBe(0.50)
    })

    it('clamps rate to min 45%', () => {
      const rate = calculateRobSuccessRate({
        attackerLevel: 1,
        defenderLevel: 100,
        attackerWeaponBonus: 0,
        defenderArmorBonus: 0.15,
      })
      expect(rate).toBe(0.45)
    })

    it('clamps rate to max 85%', () => {
      const rate = calculateRobSuccessRate({
        attackerLevel: 100,
        defenderLevel: 1,
        attackerWeaponBonus: 0.15,
        defenderArmorBonus: 0,
      })
      expect(rate).toBe(0.85)
    })
  })

  describe('calculateInsuranceProtection', () => {
    it('calculates insurance correctly', () => {
      expect(calculateInsuranceProtection(1000, 0.20)).toBe(200)
      expect(calculateInsuranceProtection(1000, 0.40)).toBe(400)
      expect(calculateInsuranceProtection(5000, 0.15)).toBe(750)
    })
  })
})

// =============================================================================
// BAIL CALCULATION TESTS - Critical for jail economy
// =============================================================================
describe('Bail Calculations', () => {
  describe('calculateBailCost', () => {
    it('returns minimum bail (100) for low wealth', () => {
      expect(calculateBailCost(100)).toBe(100)
      expect(calculateBailCost(500)).toBe(100)
    })

    it('calculates 10% of wealth for higher amounts', () => {
      expect(calculateBailCost(10000)).toBe(1000)
      expect(calculateBailCost(50000)).toBe(5000)
    })
  })
})

// =============================================================================
// CHECK-IN SYSTEM TESTS - Critical for daily engagement
// =============================================================================
describe('Check-in System', () => {
  describe('calculateCheckinRewards', () => {
    it('returns base rewards for streak 0', () => {
      const rewards = calculateCheckinRewards(0)
      expect(rewards.wealth).toBeGreaterThan(0)
      expect(rewards.xp).toBeGreaterThan(0)
    })

    it('increases rewards with streak', () => {
      const streak0 = calculateCheckinRewards(0)
      const streak7 = calculateCheckinRewards(7)
      expect(streak7.wealth).toBeGreaterThan(streak0.wealth)
      expect(streak7.xp).toBeGreaterThan(streak0.xp)
    })
  })

  describe('getStreakMilestoneReward (CRIT-06 perpetual cycle)', () => {
    it('returns null for non-milestone days', () => {
      expect(getStreakMilestoneReward(1)).toBeNull()
      expect(getStreakMilestoneReward(5)).toBeNull()
      expect(getStreakMilestoneReward(13)).toBeNull()
    })

    it('returns uncommon crate at day 7', () => {
      expect(getStreakMilestoneReward(7)).toBe('uncommon')
    })

    it('returns uncommon crate at day 14, 21', () => {
      expect(getStreakMilestoneReward(14)).toBe('uncommon')
      expect(getStreakMilestoneReward(21)).toBe('uncommon')
    })

    it('returns legendary crate at day 28 (monthly priority)', () => {
      expect(getStreakMilestoneReward(28)).toBe('legendary')
    })

    it('continues cycle perpetually', () => {
      expect(getStreakMilestoneReward(35)).toBe('uncommon')
      expect(getStreakMilestoneReward(56)).toBe('legendary')
      expect(getStreakMilestoneReward(84)).toBe('legendary')
      expect(getStreakMilestoneReward(100)).toBeNull()
    })
  })
})

// =============================================================================
// DURABILITY TESTS - Critical for item economy
// =============================================================================
describe('Durability System', () => {
  describe('shouldItemBreak', () => {
    it('returns true when durability goes to 0 or below', () => {
      expect(shouldItemBreak(5, 5)).toBe(true)
      expect(shouldItemBreak(3, 5)).toBe(true)
    })

    it('returns false when durability stays above 0', () => {
      expect(shouldItemBreak(10, 5)).toBe(false)
      expect(shouldItemBreak(100, 3)).toBe(false)
    })
  })
})

// =============================================================================
// MISSION REWARDS TESTS
// =============================================================================
describe('Mission Rewards', () => {
  describe('calculateMissionRewards', () => {
    it('applies tier multiplier to rewards', () => {
      const rookieRewards = calculateMissionRewards(1000, 100, TIERS.ROOKIE)
      expect(rookieRewards.wealth).toBe(1000)
      expect(rookieRewards.xp).toBe(100)

      const kingpinRewards = calculateMissionRewards(1000, 100, TIERS.KINGPIN)
      expect(kingpinRewards.wealth).toBe(1500)
      expect(kingpinRewards.xp).toBe(150)
    })
  })
})

// =============================================================================
// BLACKJACK TESTS - Critical for gambling fairness
// =============================================================================
describe('Blackjack', () => {
  describe('calculateBlackjackHand', () => {
    it('calculates basic hand values', () => {
      const hand = calculateBlackjackHand([
        { rank: '5', suit: '♠' },
        { rank: '7', suit: '♥' },
      ])
      expect(hand.value).toBe(12)
      expect(hand.isSoft).toBe(false)
    })

    it('calculates face cards as 10', () => {
      const hand = calculateBlackjackHand([
        { rank: 'K', suit: '♠' },
        { rank: 'Q', suit: '♥' },
      ])
      expect(hand.value).toBe(20)
    })

    it('handles soft aces (11)', () => {
      const hand = calculateBlackjackHand([
        { rank: 'A', suit: '♠' },
        { rank: '6', suit: '♥' },
      ])
      expect(hand.value).toBe(17)
      expect(hand.isSoft).toBe(true)
    })

    it('converts aces from 11 to 1 when busting', () => {
      const hand = calculateBlackjackHand([
        { rank: 'A', suit: '♠' },
        { rank: '8', suit: '♥' },
        { rank: '5', suit: '♦' },
      ])
      expect(hand.value).toBe(14)
      expect(hand.isSoft).toBe(false)
    })

    it('handles multiple aces correctly', () => {
      const hand = calculateBlackjackHand([
        { rank: 'A', suit: '♠' },
        { rank: 'A', suit: '♥' },
        { rank: '9', suit: '♦' },
      ])
      expect(hand.value).toBe(21)
    })
  })

  describe('isBlackjack', () => {
    it('returns true for natural blackjack', () => {
      expect(isBlackjack([
        { rank: 'A', suit: '♠' },
        { rank: 'K', suit: '♥' },
      ])).toBe(true)
    })

    it('returns false for 21 with more than 2 cards', () => {
      expect(isBlackjack([
        { rank: '7', suit: '♠' },
        { rank: '7', suit: '♥' },
        { rank: '7', suit: '♦' },
      ])).toBe(false)
    })
  })
})

// =============================================================================
// COIN FLIP TESTS
// =============================================================================
describe('Coin Flip', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns heads when random < 0.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3)
    expect(flipCoin()).toBe('heads')
  })

  it('returns tails when random >= 0.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7)
    expect(flipCoin()).toBe('tails')
  })
})

// =============================================================================
// LOTTERY TESTS - Critical for jackpot payouts
// =============================================================================
describe('Lottery', () => {
  describe('checkLotteryMatch', () => {
    it('counts matching numbers', () => {
      expect(checkLotteryMatch([1, 2, 3], [1, 2, 3])).toBe(3)
      expect(checkLotteryMatch([1, 2, 3], [1, 2, 4])).toBe(2)
      expect(checkLotteryMatch([1, 2, 3], [4, 5, 6])).toBe(0)
    })
  })

  describe('calculateLotteryPayout', () => {
    it('returns full pool for 3 matches (jackpot)', () => {
      expect(calculateLotteryPayout(3, BigInt(100), BigInt(10000))).toBe(BigInt(10000))
    })

    it('returns 10x ticket cost for 2 matches', () => {
      expect(calculateLotteryPayout(2, BigInt(100), BigInt(10000))).toBe(BigInt(1000))
    })

    it('returns 2x ticket cost for 1 match', () => {
      expect(calculateLotteryPayout(1, BigInt(100), BigInt(10000))).toBe(BigInt(200))
    })

    it('returns 0 for no matches', () => {
      expect(calculateLotteryPayout(0, BigInt(100), BigInt(10000))).toBe(BigInt(0))
    })
  })
})

// =============================================================================
// SLOTS TESTS - Critical for gambling odds
// =============================================================================
describe('Slots', () => {
  describe('calculateSlotsPayout', () => {
    it('identifies three of a kind wins', () => {
      const result = calculateSlotsPayout(['💎', '💎', '💎'])
      expect(result.matchCount).toBe(3)
      expect(result.multiplier).toBeGreaterThan(0)
    })

    it('identifies two of a kind', () => {
      const result = calculateSlotsPayout(['💎', '💎', '🍒'])
      expect(result.matchCount).toBe(2)
    })

    it('identifies no match', () => {
      const result = calculateSlotsPayout(['💎', '🍒', '7️⃣'])
      expect(result.matchCount).toBe(0)
      expect(result.multiplier).toBe(0)
    })

    it('identifies jackpot symbol', () => {
      const result = calculateSlotsPayout(['🎰', '🎰', '🎰'])
      expect(result.isJackpot).toBe(true)
    })
  })
})

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================
describe('Utility Functions', () => {
  describe('formatWealth', () => {
    it('formats numbers as currency', () => {
      expect(formatWealth(1000)).toBe('$1,000')
      expect(formatWealth(1500000)).toBe('$1,500,000')
    })

    it('handles BigInt', () => {
      expect(formatWealth(BigInt(1000000))).toBe('$1,000,000')
    })
  })

  describe('formatNumber', () => {
    it('formats with K for thousands', () => {
      expect(formatNumber(1500)).toBe('1.5K')
    })

    it('formats with M for millions', () => {
      expect(formatNumber(2500000)).toBe('2.5M')
    })

    it('formats with B for billions', () => {
      expect(formatNumber(1500000000)).toBe('1.5B')
    })

    it('handles small numbers without suffix', () => {
      expect(formatNumber(500)).toBe('500')
    })
  })
})
