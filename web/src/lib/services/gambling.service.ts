// =============================================================================
// GAMBLING SERVICE (Phase 11)
// Handles slots, blackjack, coinflip, and lottery
// =============================================================================

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import {
  GAMBLING_TYPES,
  GAMBLING_CONFIG,
  GAMBLING_NOTIFICATION_TYPES,
  ACHIEVEMENT_REQUIREMENT_TYPES,
} from '@/lib/game/constants'
import {
  getTierFromLevel,
  spinSlotReels,
  calculateSlotsPayout,
  rollJackpotChance,
  createDeck,
  calculateBlackjackHand,
  isBlackjack,
  flipCoin,
  generateLotteryNumbers,
  checkLotteryMatch,
  calculateLotteryPayout,
  updateGamblingStreak,
  getMaxBet,
  BlackjackCard,
} from '@/lib/game/formulas'

// =============================================================================
// TYPES
// =============================================================================

// CRIT-05 fix: Proper type for blackjack session details (replaces `as any`)
interface BlackjackSessionDetails {
  playerCards: BlackjackCard[]
  dealerCards: BlackjackCard[]
  dealerHidden: BlackjackCard
  deck: BlackjackCard[]
  status: 'playing' | 'busted' | 'blackjack' | 'standing' | 'resolved'
  doubled?: boolean
  finalPlayerValue?: number
  finalDealerValue?: number
}

// Type guard to safely parse blackjack session details
function parseBlackjackDetails(details: unknown): BlackjackSessionDetails {
  if (!details || typeof details !== 'object') {
    throw new Error('Invalid blackjack session details')
  }
  const d = details as Record<string, unknown>
  if (!Array.isArray(d.playerCards) || !Array.isArray(d.dealerCards) || !Array.isArray(d.deck)) {
    throw new Error('Invalid blackjack session details: missing card arrays')
  }
  if (!d.dealerHidden || typeof d.dealerHidden !== 'object') {
    throw new Error('Invalid blackjack session details: missing dealer hidden card')
  }
  if (!d.status || typeof d.status !== 'string') {
    throw new Error('Invalid blackjack session details: missing status')
  }
  return {
    playerCards: d.playerCards as BlackjackCard[],
    dealerCards: d.dealerCards as BlackjackCard[],
    dealerHidden: d.dealerHidden as BlackjackCard,
    deck: d.deck as BlackjackCard[],
    status: d.status as BlackjackSessionDetails['status'],
    doubled: d.doubled as boolean | undefined,
    finalPlayerValue: d.finalPlayerValue as number | undefined,
    finalDealerValue: d.finalDealerValue as number | undefined,
  }
}

export interface GamblingPreCheck {
  canGamble: boolean
  reason?: string
  wealth: bigint
  maxBet: number
  tier: string
}

export interface SlotsResult {
  success: boolean
  reels: string[]
  matchCount: number
  multiplier: number
  isJackpot: boolean
  wager: bigint
  payout: bigint
  jackpotAmount?: bigint
  newBalance: bigint
  xpGained: number
}

export interface BlackjackState {
  sessionId: number
  playerCards: BlackjackCard[]
  dealerCards: BlackjackCard[]
  dealerHidden?: BlackjackCard
  playerValue: number
  wager: bigint
  status: 'playing' | 'standing' | 'busted' | 'blackjack' | 'resolved'
  canDouble: boolean
  canSplit: boolean
  result?: 'win' | 'loss' | 'push' | 'blackjack'
  dealerValue?: number
  payout?: bigint
  newBalance?: bigint
}

export interface CoinFlipResult {
  success: boolean
  challengeId?: number
  result?: 'heads' | 'tails'
  winnerId?: number
  winnerName?: string
  payout?: bigint
  message: string
}

export interface LotteryTicketResult {
  ticketId: number
  drawId: number
  numbers: number[]
  cost: bigint
}

// =============================================================================
// GAMBLING SERVICE
// =============================================================================

export const GamblingService = {
  // ===========================================================================
  // PRE-CHECKS
  // ===========================================================================

  async canGamble(userId: number): Promise<GamblingPreCheck> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { wealth: true, level: true },
    })

    if (!user) {
      return { canGamble: false, reason: 'User not found', wealth: BigInt(0), maxBet: 0, tier: 'Rookie' }
    }

    // Check if jailed
    const cooldown = await prisma.cooldown.findFirst({
      where: {
        userId,
        commandType: 'jail',
        expiresAt: { gt: new Date() },
      },
    })

    if (cooldown) {
      return { canGamble: false, reason: 'Cannot gamble while in jail', wealth: user.wealth, maxBet: 0, tier: getTierFromLevel(user.level) }
    }

    const tier = getTierFromLevel(user.level)
    const maxBet = getMaxBet(tier)

    if (user.wealth < BigInt(GAMBLING_CONFIG.MIN_BET)) {
      return { canGamble: false, reason: `Minimum bet is $${GAMBLING_CONFIG.MIN_BET}`, wealth: user.wealth, maxBet, tier }
    }

    return { canGamble: true, wealth: user.wealth, maxBet, tier }
  },

  // ===========================================================================
  // SLOTS
  // ===========================================================================

  async playSlots(userId: number, wagerAmount: bigint): Promise<SlotsResult> {
    const preCheck = await this.canGamble(userId)
    if (!preCheck.canGamble) {
      throw new Error(preCheck.reason)
    }

    if (wagerAmount < BigInt(GAMBLING_CONFIG.MIN_BET)) {
      throw new Error(`Minimum bet is $${GAMBLING_CONFIG.MIN_BET}`)
    }

    if (wagerAmount > BigInt(preCheck.maxBet)) {
      throw new Error(`Maximum bet for ${preCheck.tier} is $${preCheck.maxBet}`)
    }

    if (wagerAmount > preCheck.wealth) {
      throw new Error('Insufficient funds')
    }

    // Spin the reels
    const reels = spinSlotReels()
    const { multiplier, isJackpot, matchCount } = calculateSlotsPayout(reels)

    // Check for random jackpot trigger
    const randomJackpot = !isJackpot && rollJackpotChance(preCheck.tier)

    let payout = BigInt(0)
    let jackpotAmount: bigint | undefined
    let xpGained = 10

    // Get current jackpot
    let jackpot = await prisma.slotJackpot.findFirst()
    if (!jackpot) {
      jackpot = await prisma.slotJackpot.create({
        data: { currentPool: BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL) },
      })
    }
    const jackpotPool = jackpot.currentPool

    if (isJackpot || randomJackpot) {
      // JACKPOT!
      jackpotAmount = jackpotPool
      payout = jackpotPool
      xpGained = 500
    } else if (multiplier > 0) {
      // Regular win
      payout = BigInt(Math.floor(Number(wagerAmount) * multiplier))
      xpGained = matchCount === 3 ? 50 : 25
    }

    const netChange = payout - wagerAmount
    const isWin = payout > BigInt(0)

    // Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user wealth
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          wealth: { increment: netChange },
          xp: { increment: BigInt(xpGained) },
        },
      })

      // Record gambling session
      await tx.gamblingSession.create({
        data: {
          userId,
          gameType: GAMBLING_TYPES.SLOTS,
          wagerAmount,
          result: isJackpot || randomJackpot ? 'jackpot' : (isWin ? 'win' : 'loss'),
          payout,
          multiplier: isJackpot || randomJackpot ? null : multiplier,
          details: { reels, matchCount, isJackpot: isJackpot || randomJackpot } as unknown as Prisma.InputJsonValue,
          resolvedAt: new Date(),
        },
      })

      // Update gambling stats
      const existingStats = await tx.playerGamblingStats.findUnique({ where: { userId } })

      if (existingStats) {
        const streakUpdate = updateGamblingStreak(
          existingStats.currentWinStreak,
          existingStats.currentLossStreak,
          existingStats.bestWinStreak,
          existingStats.worstLossStreak,
          isWin
        )

        await tx.playerGamblingStats.update({
          where: { userId },
          data: {
            totalWagered: { increment: wagerAmount },
            totalWon: { increment: isWin ? payout : BigInt(0) },
            totalLost: { increment: isWin ? BigInt(0) : wagerAmount },
            netProfit: { increment: netChange },
            slotsPlayed: { increment: 1 },
            slotsWon: { increment: isWin ? 1 : 0 },
            currentWinStreak: streakUpdate.winStreak,
            currentLossStreak: streakUpdate.lossStreak,
            bestWinStreak: streakUpdate.bestWin,
            worstLossStreak: streakUpdate.worstLoss,
            biggestWin: payout > existingStats.biggestWin ? payout : undefined,
            biggestLoss: !isWin && wagerAmount > existingStats.biggestLoss ? wagerAmount : undefined,
            jackpotsHit: { increment: isJackpot || randomJackpot ? 1 : 0 },
            jackpotTotal: { increment: jackpotAmount ?? BigInt(0) },
          },
        })
      } else {
        await tx.playerGamblingStats.create({
          data: {
            userId,
            totalWagered: wagerAmount,
            totalWon: isWin ? payout : BigInt(0),
            totalLost: isWin ? BigInt(0) : wagerAmount,
            netProfit: netChange,
            slotsPlayed: 1,
            slotsWon: isWin ? 1 : 0,
            currentWinStreak: isWin ? 1 : 0,
            currentLossStreak: isWin ? 0 : 1,
            bestWinStreak: isWin ? 1 : 0,
            worstLossStreak: isWin ? 0 : 1,
            biggestWin: isWin ? payout : BigInt(0),
            biggestLoss: isWin ? BigInt(0) : wagerAmount,
            jackpotsHit: isJackpot || randomJackpot ? 1 : 0,
            jackpotTotal: jackpotAmount ?? BigInt(0),
          },
        })
      }

      // Update jackpot pool
      if (isJackpot || randomJackpot) {
        await tx.slotJackpot.update({
          where: { id: jackpot!.id },
          data: {
            currentPool: BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL),
            lastWinnerId: userId,
            lastWinAmount: jackpotPool,
            lastWonAt: new Date(),
          },
        })
      } else {
        const contribution = BigInt(Math.floor(Number(wagerAmount) * GAMBLING_CONFIG.JACKPOT_CONTRIBUTION_RATE))
        await tx.slotJackpot.update({
          where: { id: jackpot!.id },
          data: { currentPool: { increment: contribution } },
        })
      }

      return updatedUser
    })

    return {
      success: true,
      reels,
      matchCount,
      multiplier,
      isJackpot: isJackpot || randomJackpot,
      wager: wagerAmount,
      payout,
      jackpotAmount,
      newBalance: result.wealth,
      xpGained,
    }
  },

  // ===========================================================================
  // BLACKJACK
  // ===========================================================================

  async startBlackjack(userId: number, wagerAmount: bigint): Promise<BlackjackState> {
    const preCheck = await this.canGamble(userId)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)
    if (wagerAmount > preCheck.wealth) throw new Error('Insufficient funds')
    if (wagerAmount > BigInt(preCheck.maxBet)) throw new Error(`Max bet is $${preCheck.maxBet}`)
    if (wagerAmount < BigInt(GAMBLING_CONFIG.MIN_BET)) throw new Error(`Min bet is $${GAMBLING_CONFIG.MIN_BET}`)

    // Check for existing active blackjack session
    const existing = await prisma.gamblingSession.findFirst({
      where: { userId, gameType: GAMBLING_TYPES.BLACKJACK, resolvedAt: null },
    })
    if (existing) throw new Error('You have an active blackjack hand. Use hit, stand, or double.')

    const deck = createDeck()
    const playerCards = [deck.pop()!, deck.pop()!]
    const dealerVisible = deck.pop()!
    const dealerHidden = deck.pop()!

    const playerValue = calculateBlackjackHand(playerCards).value
    const playerBlackjack = isBlackjack(playerCards)

    // CRIT-04 fix: Deduct wager AND create session atomically in transaction
    const session = await prisma.$transaction(async (tx) => {
      // Deduct wager
      await tx.user.update({
        where: { id: userId },
        data: { wealth: { decrement: wagerAmount } },
      })

      // Create session
      return tx.gamblingSession.create({
        data: {
          userId,
          gameType: GAMBLING_TYPES.BLACKJACK,
          wagerAmount,
          details: {
            playerCards,
            dealerCards: [dealerVisible],
            dealerHidden,
            deck,
            status: playerBlackjack ? 'blackjack' : 'playing',
          } as unknown as Prisma.InputJsonValue,
        },
      })
    })

    // If player has blackjack, resolve immediately
    if (playerBlackjack) {
      return this.resolveBlackjack(session.id)
    }

    return {
      sessionId: session.id,
      playerCards,
      dealerCards: [dealerVisible],
      dealerHidden,
      playerValue,
      wager: wagerAmount,
      status: 'playing',
      canDouble: preCheck.wealth >= wagerAmount * BigInt(2),
      canSplit: playerCards[0].rank === playerCards[1].rank && preCheck.wealth >= wagerAmount * BigInt(2),
    }
  },

  async blackjackHit(userId: number): Promise<BlackjackState> {
    const session = await prisma.gamblingSession.findFirst({
      where: { userId, gameType: GAMBLING_TYPES.BLACKJACK, resolvedAt: null },
    })
    if (!session) throw new Error('No active blackjack hand')

    // CRIT-05 fix: Use type-safe parser instead of `as any`
    const details = parseBlackjackDetails(session.details)
    if (details.status !== 'playing') throw new Error('Cannot hit in current state')

    const deck = details.deck
    const playerCards = [...details.playerCards, deck.pop()!]
    const { value } = calculateBlackjackHand(playerCards)

    const newStatus = value > 21 ? 'busted' : 'playing'

    await prisma.gamblingSession.update({
      where: { id: session.id },
      data: {
        details: { ...details, playerCards, deck, status: newStatus } as unknown as Prisma.InputJsonValue,
      },
    })

    if (newStatus === 'busted') {
      return this.resolveBlackjack(session.id)
    }

    return {
      sessionId: session.id,
      playerCards,
      dealerCards: details.dealerCards,
      dealerHidden: details.dealerHidden,
      playerValue: value,
      wager: session.wagerAmount,
      status: 'playing',
      canDouble: false,
      canSplit: false,
    }
  },

  async blackjackStand(userId: number): Promise<BlackjackState> {
    const session = await prisma.gamblingSession.findFirst({
      where: { userId, gameType: GAMBLING_TYPES.BLACKJACK, resolvedAt: null },
    })
    if (!session) throw new Error('No active blackjack hand')

    return this.resolveBlackjack(session.id)
  },

  async blackjackDouble(userId: number): Promise<BlackjackState> {
    const session = await prisma.gamblingSession.findFirst({
      where: { userId, gameType: GAMBLING_TYPES.BLACKJACK, resolvedAt: null },
    })
    if (!session) throw new Error('No active blackjack hand')

    // CRIT-05 fix: Use type-safe parser instead of `as any`
    const details = parseBlackjackDetails(session.details)
    if (details.playerCards.length !== 2) throw new Error('Can only double on first two cards')

    // Check funds for double
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.wealth < session.wagerAmount) throw new Error('Insufficient funds to double')

    // Deduct additional wager
    await prisma.user.update({
      where: { id: userId },
      data: { wealth: { decrement: session.wagerAmount } },
    })

    // Double the wager, draw one card, then resolve
    const deck = details.deck
    const playerCards = [...details.playerCards, deck.pop()!]

    await prisma.gamblingSession.update({
      where: { id: session.id },
      data: {
        wagerAmount: session.wagerAmount * BigInt(2),
        details: { ...details, playerCards, deck, doubled: true } as unknown as Prisma.InputJsonValue,
      },
    })

    return this.resolveBlackjack(session.id)
  },

  async resolveBlackjack(sessionId: number): Promise<BlackjackState> {
    const session = await prisma.gamblingSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Session not found')

    // CRIT-05 fix: Use type-safe parser instead of `as any`
    const details = parseBlackjackDetails(session.details)
    const playerCards = details.playerCards
    const { value: playerValue } = calculateBlackjackHand(playerCards)

    // Reveal dealer's hidden card and play out dealer's hand
    let dealerCards: BlackjackCard[] = [...details.dealerCards, details.dealerHidden]
    let deck = details.deck
    let dealerHand = calculateBlackjackHand(dealerCards)

    // CRIT-01 fix: Dealer hits on soft 17 (Ace counting as 11)
    // Standard casino rules require dealer to HIT on soft 17
    while (
      (dealerHand.value < 17 || (dealerHand.value === 17 && dealerHand.isSoft)) &&
      playerValue <= 21
    ) {
      dealerCards.push(deck.pop()!)
      dealerHand = calculateBlackjackHand(dealerCards)
    }
    const dealerValue = dealerHand.value

    // Determine result
    let result: 'win' | 'loss' | 'push' | 'blackjack'
    let payout = BigInt(0)

    const playerBlackjack = isBlackjack(playerCards)
    const dealerBlackjack = isBlackjack([details.dealerCards[0], details.dealerHidden])

    if (playerBlackjack && !dealerBlackjack) {
      result = 'blackjack'
      payout = BigInt(Math.floor(Number(session.wagerAmount) * 2.5))
    } else if (playerValue > 21) {
      result = 'loss'
    } else if (dealerValue > 21) {
      result = 'win'
      payout = session.wagerAmount * BigInt(2)
    } else if (playerValue > dealerValue) {
      result = 'win'
      payout = session.wagerAmount * BigInt(2)
    } else if (playerValue < dealerValue) {
      result = 'loss'
    } else {
      result = 'push'
      payout = session.wagerAmount
    }

    const isWin = result === 'win' || result === 'blackjack'
    const xpGained = isWin ? 30 : 10

    // Update session and user
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.gamblingSession.update({
        where: { id: sessionId },
        data: {
          result,
          payout,
          details: { ...details, dealerCards, finalPlayerValue: playerValue, finalDealerValue: dealerValue, status: 'resolved' } as unknown as Prisma.InputJsonValue,
          resolvedAt: new Date(),
        },
      })

      const user = await tx.user.update({
        where: { id: session.userId },
        data: {
          wealth: { increment: payout },
          xp: { increment: BigInt(xpGained) },
        },
      })

      // Update stats
      const existingStats = await tx.playerGamblingStats.findUnique({ where: { userId: session.userId } })

      if (existingStats) {
        const streakUpdate = updateGamblingStreak(
          existingStats.currentWinStreak,
          existingStats.currentLossStreak,
          existingStats.bestWinStreak,
          existingStats.worstLossStreak,
          isWin
        )

        await tx.playerGamblingStats.update({
          where: { userId: session.userId },
          data: {
            totalWagered: { increment: session.wagerAmount },
            totalWon: { increment: payout },
            totalLost: { increment: result === 'loss' ? session.wagerAmount : BigInt(0) },
            netProfit: { increment: payout - session.wagerAmount },
            blackjackPlayed: { increment: 1 },
            blackjackWon: { increment: isWin ? 1 : 0 },
            currentWinStreak: streakUpdate.winStreak,
            currentLossStreak: streakUpdate.lossStreak,
            bestWinStreak: streakUpdate.bestWin,
            worstLossStreak: streakUpdate.worstLoss,
          },
        })
      } else {
        await tx.playerGamblingStats.create({
          data: {
            userId: session.userId,
            totalWagered: session.wagerAmount,
            totalWon: payout,
            totalLost: result === 'loss' ? session.wagerAmount : BigInt(0),
            netProfit: payout - session.wagerAmount,
            blackjackPlayed: 1,
            blackjackWon: isWin ? 1 : 0,
            currentWinStreak: isWin ? 1 : 0,
            currentLossStreak: isWin ? 0 : 1,
            bestWinStreak: isWin ? 1 : 0,
            worstLossStreak: isWin ? 0 : 1,
          },
        })
      }

      return user
    })

    return {
      sessionId,
      playerCards,
      dealerCards,
      playerValue,
      dealerValue,
      wager: session.wagerAmount,
      status: 'resolved',
      result,
      payout,
      newBalance: updatedUser.wealth,
      canDouble: false,
      canSplit: false,
    }
  },

  // ===========================================================================
  // COINFLIP (PvP)
  // ===========================================================================

  async createCoinFlipChallenge(userId: number, wagerAmount: bigint, call: 'heads' | 'tails'): Promise<CoinFlipResult> {
    const preCheck = await this.canGamble(userId)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)
    if (wagerAmount < BigInt(GAMBLING_CONFIG.COINFLIP_MIN_BET)) {
      throw new Error(`Minimum coinflip bet is $${GAMBLING_CONFIG.COINFLIP_MIN_BET}`)
    }
    if (wagerAmount > preCheck.wealth) throw new Error('Insufficient funds')

    // Check for existing open challenge
    const existing = await prisma.coinFlipChallenge.findFirst({
      where: { challengerId: userId, status: 'open' },
    })
    if (existing) throw new Error('You already have an open coinflip challenge')

    const expiresAt = new Date(Date.now() + GAMBLING_CONFIG.COINFLIP_EXPIRY_MINUTES * 60 * 1000)

    // HIGH-02 fix: Wrap wager deduction and challenge creation in transaction
    const challenge = await prisma.$transaction(async (tx) => {
      // Hold funds in escrow (deduct from user)
      await tx.user.update({
        where: { id: userId },
        data: { wealth: { decrement: wagerAmount } },
      })

      // Create challenge
      return tx.coinFlipChallenge.create({
        data: {
          challengerId: userId,
          wagerAmount,
          challengerCall: call,
          expiresAt,
        },
      })
    })

    return {
      success: true,
      challengeId: challenge.id,
      message: `Coinflip challenge created! Wager: $${wagerAmount.toLocaleString()}, Call: ${call}. Expires in ${GAMBLING_CONFIG.COINFLIP_EXPIRY_MINUTES} minutes.`,
    }
  },

  async acceptCoinFlipChallenge(userId: number, challengeId: number): Promise<CoinFlipResult> {
    const challenge = await prisma.coinFlipChallenge.findUnique({
      where: { id: challengeId },
      include: { challenger: true },
    })

    if (!challenge) throw new Error('Challenge not found')
    if (challenge.status !== 'open') throw new Error('Challenge is no longer open')
    if (challenge.challengerId === userId) throw new Error('Cannot accept your own challenge')
    if (challenge.expiresAt < new Date()) throw new Error('Challenge has expired')

    const preCheck = await this.canGamble(userId)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)
    if (challenge.wagerAmount > preCheck.wealth) throw new Error('Insufficient funds to match wager')

    // Flip the coin
    const result = flipCoin()
    const challengerWins = result === challenge.challengerCall
    const winnerId = challengerWins ? challenge.challengerId : userId
    const loserId = challengerWins ? userId : challenge.challengerId
    const totalPot = challenge.wagerAmount * BigInt(2)

    // Execute transaction
    await prisma.$transaction(async (tx) => {
      // Deduct from acceptor
      await tx.user.update({
        where: { id: userId },
        data: { wealth: { decrement: challenge.wagerAmount } },
      })

      // Pay winner
      await tx.user.update({
        where: { id: winnerId },
        data: { wealth: { increment: totalPot } },
      })

      // Update challenge
      await tx.coinFlipChallenge.update({
        where: { id: challengeId },
        data: {
          acceptorId: userId,
          result,
          winnerId,
          status: 'resolved',
          resolvedAt: new Date(),
        },
      })

      // Update stats for both players
      for (const playerId of [challenge.challengerId, userId]) {
        const isWinner = playerId === winnerId
        const existingStats = await tx.playerGamblingStats.findUnique({ where: { userId: playerId } })

        if (existingStats) {
          await tx.playerGamblingStats.update({
            where: { userId: playerId },
            data: {
              totalWagered: { increment: challenge.wagerAmount },
              totalWon: { increment: isWinner ? totalPot : BigInt(0) },
              totalLost: { increment: isWinner ? BigInt(0) : challenge.wagerAmount },
              netProfit: { increment: isWinner ? challenge.wagerAmount : -challenge.wagerAmount },
              coinflipsPlayed: { increment: 1 },
              coinflipsWon: { increment: isWinner ? 1 : 0 },
            },
          })
        } else {
          await tx.playerGamblingStats.create({
            data: {
              userId: playerId,
              totalWagered: challenge.wagerAmount,
              totalWon: isWinner ? totalPot : BigInt(0),
              totalLost: isWinner ? BigInt(0) : challenge.wagerAmount,
              netProfit: isWinner ? challenge.wagerAmount : -challenge.wagerAmount,
              coinflipsPlayed: 1,
              coinflipsWon: isWinner ? 1 : 0,
            },
          })
        }
      }
    })

    const winner = await prisma.user.findUnique({ where: { id: winnerId } })

    return {
      success: true,
      challengeId,
      result,
      winnerId,
      winnerName: winner?.displayName ?? winner?.username ?? 'Unknown',
      payout: totalPot,
      message: `🪙 ${result.toUpperCase()}! ${winner?.displayName ?? winner?.username} wins $${totalPot.toLocaleString()}!`,
    }
  },

  async cancelCoinFlipChallenge(userId: number): Promise<CoinFlipResult> {
    const challenge = await prisma.coinFlipChallenge.findFirst({
      where: { challengerId: userId, status: 'open' },
    })

    if (!challenge) throw new Error('No open challenge to cancel')

    // Refund the wager
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { wealth: { increment: challenge.wagerAmount } },
      })

      await tx.coinFlipChallenge.update({
        where: { id: challenge.id },
        data: { status: 'cancelled' },
      })
    })

    return {
      success: true,
      message: `Challenge cancelled. $${challenge.wagerAmount.toLocaleString()} refunded.`,
    }
  },

  async getOpenCoinFlips(limit: number = 10) {
    return prisma.coinFlipChallenge.findMany({
      where: { status: 'open', expiresAt: { gt: new Date() } },
      include: { challenger: { select: { id: true, displayName: true, username: true, level: true } } },
      orderBy: { wagerAmount: 'desc' },
      take: limit,
    })
  },

  // ===========================================================================
  // LOTTERY
  // ===========================================================================

  async buyLotteryTicket(userId: number, numbers: number[]): Promise<LotteryTicketResult> {
    // Validate numbers
    if (numbers.length !== GAMBLING_CONFIG.LOTTERY_NUMBERS_COUNT) {
      throw new Error(`Pick exactly ${GAMBLING_CONFIG.LOTTERY_NUMBERS_COUNT} numbers`)
    }
    if (new Set(numbers).size !== numbers.length) {
      throw new Error('Numbers must be unique')
    }
    if (numbers.some(n => n < 1 || n > GAMBLING_CONFIG.LOTTERY_NUMBER_MAX)) {
      throw new Error(`Numbers must be between 1 and ${GAMBLING_CONFIG.LOTTERY_NUMBER_MAX}`)
    }

    const preCheck = await this.canGamble(userId)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)

    const cost = BigInt(GAMBLING_CONFIG.LOTTERY_TICKET_COST)
    if (cost > preCheck.wealth) throw new Error('Insufficient funds for lottery ticket')

    // Get or create current draw
    let draw = await prisma.lotteryDraw.findFirst({
      where: { status: 'open', drawType: 'daily' },
    })

    if (!draw) {
      // Create new daily draw (draws at midnight UTC)
      const tomorrow = new Date()
      tomorrow.setUTCHours(24, 0, 0, 0)

      draw = await prisma.lotteryDraw.create({
        data: {
          drawType: 'daily',
          drawAt: tomorrow,
          prizePool: BigInt(0),
        },
      })
    }

    // Check ticket limit
    const existingTickets = await prisma.lotteryTicket.count({
      where: { userId, drawId: draw.id },
    })
    if (existingTickets >= GAMBLING_CONFIG.LOTTERY_MAX_TICKETS_PER_DRAW) {
      throw new Error(`Maximum ${GAMBLING_CONFIG.LOTTERY_MAX_TICKETS_PER_DRAW} tickets per draw`)
    }

    const sortedNumbers = numbers.sort((a, b) => a - b)
    const numbersStr = sortedNumbers.join(',')

    // Check for duplicate numbers
    const duplicate = await prisma.lotteryTicket.findFirst({
      where: { userId, drawId: draw.id, numbers: numbersStr },
    })
    if (duplicate) throw new Error('You already have a ticket with these numbers')

    // Purchase ticket
    const poolContribution = BigInt(Math.floor(Number(cost) * (1 - GAMBLING_CONFIG.LOTTERY_HOUSE_CUT)))

    const ticket = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { wealth: { decrement: cost } },
      })

      await tx.lotteryDraw.update({
        where: { id: draw!.id },
        data: { prizePool: { increment: poolContribution } },
      })

      // Update stats
      const existingStats = await tx.playerGamblingStats.findUnique({ where: { userId } })
      if (existingStats) {
        await tx.playerGamblingStats.update({
          where: { userId },
          data: {
            lotteryTickets: { increment: 1 },
            totalWagered: { increment: cost },
          },
        })
      } else {
        await tx.playerGamblingStats.create({
          data: {
            userId,
            lotteryTickets: 1,
            totalWagered: cost,
          },
        })
      }

      return tx.lotteryTicket.create({
        data: {
          userId,
          drawId: draw!.id,
          numbers: numbersStr,
          cost,
        },
      })
    })

    return {
      ticketId: ticket.id,
      drawId: draw.id,
      numbers: sortedNumbers,
      cost,
    }
  },

  async getCurrentLottery() {
    const draw = await prisma.lotteryDraw.findFirst({
      where: { status: 'open', drawType: 'daily' },
      include: { _count: { select: { tickets: true } } },
    })

    return draw ? {
      id: draw.id,
      prizePool: draw.prizePool,
      ticketCount: draw._count.tickets,
      drawAt: draw.drawAt,
    } : null
  },

  async getUserLotteryTickets(userId: number, drawId?: number) {
    return prisma.lotteryTicket.findMany({
      where: { userId, ...(drawId && { drawId }) },
      include: { draw: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  async executeLotteryDraw(drawId: number) {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: drawId },
      include: { tickets: { include: { user: true } } },
    })

    if (!draw || draw.status !== 'open') throw new Error('Draw not found or already completed')

    const winningNumbers = generateLotteryNumbers()
    const winningStr = winningNumbers.join(',')

    // Find winners
    let jackpotWinner: { userId: number; ticketId: number } | null = null
    const partialWinners: { userId: number; matches: number; payout: bigint }[] = []

    for (const ticket of draw.tickets) {
      const ticketNumbers = ticket.numbers.split(',').map(Number)
      const matches = checkLotteryMatch(ticketNumbers, winningNumbers)

      if (matches === 3) {
        jackpotWinner = { userId: ticket.userId, ticketId: ticket.id }
      } else if (matches > 0) {
        const payout = calculateLotteryPayout(matches, ticket.cost, draw.prizePool)
        partialWinners.push({ userId: ticket.userId, matches, payout })
      }
    }

    // Distribute winnings
    await prisma.$transaction(async (tx) => {
      if (jackpotWinner) {
        await tx.user.update({
          where: { id: jackpotWinner.userId },
          data: { wealth: { increment: draw.prizePool } },
        })

        await tx.playerGamblingStats.upsert({
          where: { userId: jackpotWinner.userId },
          create: {
            userId: jackpotWinner.userId,
            lotteryWins: 1,
            totalWon: draw.prizePool,
            netProfit: draw.prizePool,
          },
          update: {
            lotteryWins: { increment: 1 },
            totalWon: { increment: draw.prizePool },
            netProfit: { increment: draw.prizePool },
          },
        })
      }

      for (const winner of partialWinners) {
        await tx.user.update({
          where: { id: winner.userId },
          data: { wealth: { increment: winner.payout } },
        })
      }

      await tx.lotteryDraw.update({
        where: { id: drawId },
        data: {
          status: 'completed',
          winningNumbers: winningStr,
          winnerId: jackpotWinner?.userId,
          winnerPayout: jackpotWinner ? draw.prizePool : null,
          completedAt: new Date(),
        },
      })
    })

    return {
      winningNumbers,
      jackpotWinner,
      partialWinners,
      prizePool: draw.prizePool,
    }
  },

  // ===========================================================================
  // STATS & HISTORY
  // ===========================================================================

  async getGamblingStats(userId: number) {
    return prisma.playerGamblingStats.findUnique({ where: { userId } })
  },

  async getGamblingHistory(userId: number, limit: number = 20) {
    return prisma.gamblingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  async getJackpotInfo() {
    let jackpot = await prisma.slotJackpot.findFirst()
    if (!jackpot) {
      jackpot = await prisma.slotJackpot.create({
        data: { currentPool: BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL) },
      })
    }

    return {
      currentPool: jackpot.currentPool,
      lastWinner: jackpot.lastWinnerId,
      lastWinAmount: jackpot.lastWinAmount,
      lastWonAt: jackpot.lastWonAt,
    }
  },

  async getGamblingLeaderboard(limit: number = 10) {
    return prisma.playerGamblingStats.findMany({
      where: { totalWon: { gt: 0 } },
      orderBy: { totalWon: 'desc' },
      take: limit,
      include: { user: { select: { id: true, displayName: true, username: true, level: true } } },
    })
  },

  // ===========================================================================
  // CLEANUP JOBS
  // ===========================================================================

  async expireCoinFlipChallenges() {
    const expired = await prisma.coinFlipChallenge.findMany({
      where: { status: 'open', expiresAt: { lt: new Date() } },
    })

    for (const challenge of expired) {
      await prisma.$transaction(async (tx) => {
        // Refund challenger
        await tx.user.update({
          where: { id: challenge.challengerId },
          data: { wealth: { increment: challenge.wagerAmount } },
        })

        await tx.coinFlipChallenge.update({
          where: { id: challenge.id },
          data: { status: 'expired' },
        })
      })
    }

    return expired.length
  },

  /**
   * Check for pending lottery draws and execute them
   * Called by cron job
   */
  async checkAndExecuteLotteryDraws() {
    // Find draws that are past their draw time and still pending
    const pendingDraws = await prisma.lotteryDraw.findMany({
      where: {
        status: 'open',
        drawAt: { lte: new Date() },
      },
    })

    const results = {
      checked: pendingDraws.length,
      executed: 0,
      winners: 0,
    }

    for (const draw of pendingDraws) {
      try {
        const result = await this.executeLotteryDraw(draw.id)
        results.executed++
        // Count partial winners and jackpot winner
        const winnerCount = result.partialWinners.length + (result.jackpotWinner ? 1 : 0)
        if (winnerCount > 0) {
          results.winners += winnerCount
        }
      } catch (error) {
        console.error(`Failed to execute lottery draw ${draw.id}:`, error)
      }
    }

    return results
  },
}

export default GamblingService
