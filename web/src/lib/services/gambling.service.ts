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
import { UserService } from './user.service'

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
  session_id: number
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
  winner_id?: number
  winnerName?: string
  payout?: bigint
  message: string
}

export interface LotteryTicketResult {
  ticketId: number
  draw_id: number
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

  async canGamble(user_id: number): Promise<GamblingPreCheck> {
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { wealth: true, level: true },
    })

    if (!user) {
      return { canGamble: false, reason: 'User not found', wealth: BigInt(0), maxBet: 0, tier: 'Punk' }
    }

    // Check if jailed
    const cooldown = await prisma.cooldowns.findFirst({
      where: {
        user_id,
        command_type: 'jail',
        expires_at: { gt: new Date() },
      },
    })

    if (cooldown) {
      return { canGamble: false, reason: 'Cannot gamble while in jail', wealth: user.wealth ?? BigInt(0), maxBet: 0, tier: getTierFromLevel(user.level ?? 1) }
    }

    const tier = getTierFromLevel(user.level ?? 1)
    const maxBet = getMaxBet(tier)

    if ((user.wealth ?? BigInt(0)) < BigInt(GAMBLING_CONFIG.MIN_BET)) {
      return { canGamble: false, reason: `Minimum bet is $${GAMBLING_CONFIG.MIN_BET}`, wealth: user.wealth ?? BigInt(0), maxBet, tier }
    }

    return { canGamble: true, wealth: user.wealth ?? BigInt(0), maxBet, tier }
  },

  // ===========================================================================
  // SLOTS
  // ===========================================================================

  async playSlots(user_id: number, wager_amount: bigint): Promise<SlotsResult> {
    const preCheck = await this.canGamble(user_id)
    if (!preCheck.canGamble) {
      throw new Error(preCheck.reason)
    }

    if (wager_amount < BigInt(GAMBLING_CONFIG.MIN_BET)) {
      throw new Error(`Minimum bet is $${GAMBLING_CONFIG.MIN_BET}`)
    }

    if (wager_amount > BigInt(preCheck.maxBet)) {
      throw new Error(`Maximum bet for ${preCheck.tier} is $${preCheck.maxBet}`)
    }

    if (wager_amount > preCheck.wealth) {
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
    let jackpot = await prisma.slot_jackpots.findFirst()
    if (!jackpot) {
      jackpot = await prisma.slot_jackpots.create({
        data: { current_pool: BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL) },
      })
    }
    const jackpotPool = jackpot.current_pool ?? BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL)

    if (isJackpot || randomJackpot) {
      // JACKPOT!
      jackpotAmount = jackpotPool
      payout = jackpotPool
      xpGained = 500
    } else if (multiplier > 0) {
      // Regular win
      payout = BigInt(Math.floor(Number(wager_amount) * multiplier))
      xpGained = matchCount === 3 ? 50 : 25
    }

    const netChange = payout - wager_amount
    const isWin = payout > BigInt(0)

    // Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user wealth
      const updatedUser = await tx.users.update({
        where: { id: user_id },
        data: {
          wealth: { increment: netChange },
        },
      })

      // Add XP with level recalculation
      if (xpGained > 0) {
        await UserService.addXpInTransaction(user_id, xpGained, tx)
      }

      // Record gambling session
      await tx.gambling_sessions.create({
        data: {
          user_id,
          game_type: GAMBLING_TYPES.SLOTS,
          wager_amount,
          result: isJackpot || randomJackpot ? 'jackpot' : (isWin ? 'win' : 'loss'),
          payout,
          multiplier: isJackpot || randomJackpot ? null : multiplier,
          details: { reels, matchCount, isJackpot: isJackpot || randomJackpot } as unknown as Prisma.InputJsonValue,
          resolved_at: new Date(),
        },
      })

      // Update gambling stats
      const existingStats = await tx.player_gambling_stats.findUnique({ where: { user_id } })

      if (existingStats) {
        const streakUpdate = updateGamblingStreak(
          existingStats.current_win_streak ?? 0,
          existingStats.current_loss_streak ?? 0,
          existingStats.best_win_streak ?? 0,
          existingStats.worst_loss_streak ?? 0,
          isWin
        )

        await tx.player_gambling_stats.update({
          where: { user_id },
          data: {
            total_wagered: { increment: wager_amount },
            total_won: { increment: isWin ? payout : BigInt(0) },
            total_lost: { increment: isWin ? BigInt(0) : wager_amount },
            net_profit: { increment: netChange },
            slots_played: { increment: 1 },
            slots_won: { increment: isWin ? 1 : 0 },
            current_win_streak: streakUpdate.winStreak,
            current_loss_streak: streakUpdate.lossStreak,
            best_win_streak: streakUpdate.bestWin,
            worst_loss_streak: streakUpdate.worstLoss,
            biggest_win: payout > (existingStats.biggest_win ?? BigInt(0)) ? payout : undefined,
            biggest_loss: !isWin && wager_amount > (existingStats.biggest_loss ?? BigInt(0)) ? wager_amount : undefined,
            jackpots_hit: { increment: isJackpot || randomJackpot ? 1 : 0 },
            jackpot_total: { increment: jackpotAmount ?? BigInt(0) },
          },
        })
      } else {
        await tx.player_gambling_stats.create({
          data: {
            user_id,
            total_wagered: wager_amount,
            total_won: isWin ? payout : BigInt(0),
            total_lost: isWin ? BigInt(0) : wager_amount,
            net_profit: netChange,
            slots_played: 1,
            slots_won: isWin ? 1 : 0,
            current_win_streak: isWin ? 1 : 0,
            current_loss_streak: isWin ? 0 : 1,
            best_win_streak: isWin ? 1 : 0,
            worst_loss_streak: isWin ? 0 : 1,
            biggest_win: isWin ? payout : BigInt(0),
            biggest_loss: isWin ? BigInt(0) : wager_amount,
            jackpots_hit: isJackpot || randomJackpot ? 1 : 0,
            jackpot_total: jackpotAmount ?? BigInt(0),
          },
        })
      }

      // Update jackpot pool
      if (isJackpot || randomJackpot) {
        await tx.slot_jackpots.update({
          where: { jackpot_id: jackpot!.jackpot_id },
          data: {
            current_pool: BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL),
            last_winner_id: user_id,
            last_win_amount: jackpotPool,
            last_won_at: new Date(),
          },
        })
      } else {
        const contribution = BigInt(Math.floor(Number(wager_amount) * GAMBLING_CONFIG.JACKPOT_CONTRIBUTION_RATE))
        await tx.slot_jackpots.update({
          where: { jackpot_id: jackpot!.jackpot_id },
          data: { current_pool: { increment: contribution } },
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
      wager: wager_amount,
      payout,
      jackpotAmount,
      newBalance: result.wealth ?? BigInt(0),
      xpGained,
    }
  },

  // ===========================================================================
  // BLACKJACK
  // ===========================================================================

  async startBlackjack(user_id: number, wager_amount: bigint): Promise<BlackjackState> {
    const preCheck = await this.canGamble(user_id)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)
    if (wager_amount > preCheck.wealth) throw new Error('Insufficient funds')
    if (wager_amount > BigInt(preCheck.maxBet)) throw new Error(`Max bet is $${preCheck.maxBet}`)
    if (wager_amount < BigInt(GAMBLING_CONFIG.MIN_BET)) throw new Error(`Min bet is $${GAMBLING_CONFIG.MIN_BET}`)

    // Check for existing active blackjack session
    const existing = await prisma.gambling_sessions.findFirst({
      where: { user_id, game_type: GAMBLING_TYPES.BLACKJACK, resolved_at: null },
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
      await tx.users.update({
        where: { id: user_id },
        data: { wealth: { decrement: wager_amount } },
      })

      // Create session
      return tx.gambling_sessions.create({
        data: {
          user_id,
          game_type: GAMBLING_TYPES.BLACKJACK,
          wager_amount,
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
      return this.resolveBlackjack(session.session_id)
    }

    return {
      session_id: session.session_id,
      playerCards,
      dealerCards: [dealerVisible],
      dealerHidden,
      playerValue,
      wager: wager_amount,
      status: 'playing',
      canDouble: preCheck.wealth >= wager_amount * BigInt(2),
      canSplit: playerCards[0].rank === playerCards[1].rank && preCheck.wealth >= wager_amount * BigInt(2),
    }
  },

  async blackjackHit(user_id: number): Promise<BlackjackState> {
    const session = await prisma.gambling_sessions.findFirst({
      where: { user_id, game_type: GAMBLING_TYPES.BLACKJACK, resolved_at: null },
    })
    if (!session) throw new Error('No active blackjack hand')

    // CRIT-05 fix: Use type-safe parser instead of `as any`
    const details = parseBlackjackDetails(session.details)
    if (details.status !== 'playing') throw new Error('Cannot hit in current state')

    const deck = details.deck
    const playerCards = [...details.playerCards, deck.pop()!]
    const { value } = calculateBlackjackHand(playerCards)

    const newStatus = value > 21 ? 'busted' : 'playing'

    await prisma.gambling_sessions.update({
      where: { session_id: session.session_id },
      data: {
        details: { ...details, playerCards, deck, status: newStatus } as unknown as Prisma.InputJsonValue,
      },
    })

    if (newStatus === 'busted') {
      return this.resolveBlackjack(session.session_id)
    }

    return {
      session_id: session.session_id,
      playerCards,
      dealerCards: details.dealerCards,
      dealerHidden: details.dealerHidden,
      playerValue: value,
      wager: session.wager_amount,
      status: 'playing',
      canDouble: false,
      canSplit: false,
    }
  },

  async blackjackStand(user_id: number): Promise<BlackjackState> {
    const session = await prisma.gambling_sessions.findFirst({
      where: { user_id, game_type: GAMBLING_TYPES.BLACKJACK, resolved_at: null },
    })
    if (!session) throw new Error('No active blackjack hand')

    return this.resolveBlackjack(session.session_id)
  },

  async blackjackDouble(user_id: number): Promise<BlackjackState> {
    const session = await prisma.gambling_sessions.findFirst({
      where: { user_id, game_type: GAMBLING_TYPES.BLACKJACK, resolved_at: null },
    })
    if (!session) throw new Error('No active blackjack hand')

    // CRIT-05 fix: Use type-safe parser instead of `as any`
    const details = parseBlackjackDetails(session.details)
    if (details.playerCards.length !== 2) throw new Error('Can only double on first two cards')

    // Check funds for double
    const user = await prisma.users.findUnique({ where: { id: user_id } })
    if (!user || (user.wealth ?? BigInt(0)) < session.wager_amount) throw new Error('Insufficient funds to double')

    // Deduct additional wager
    await prisma.users.update({
      where: { id: user_id },
      data: { wealth: { decrement: session.wager_amount } },
    })

    // Double the wager, draw one card, then resolve
    const deck = details.deck
    const playerCards = [...details.playerCards, deck.pop()!]

    await prisma.gambling_sessions.update({
      where: { session_id: session.session_id },
      data: {
        wager_amount: session.wager_amount * BigInt(2),
        details: { ...details, playerCards, deck, doubled: true } as unknown as Prisma.InputJsonValue,
      },
    })

    return this.resolveBlackjack(session.session_id)
  },

  async resolveBlackjack(session_id: number): Promise<BlackjackState> {
    const session = await prisma.gambling_sessions.findUnique({ where: { session_id } })
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
      payout = BigInt(Math.floor(Number(session.wager_amount) * 2.5))
    } else if (playerValue > 21) {
      result = 'loss'
    } else if (dealerValue > 21) {
      result = 'win'
      payout = session.wager_amount * BigInt(2)
    } else if (playerValue > dealerValue) {
      result = 'win'
      payout = session.wager_amount * BigInt(2)
    } else if (playerValue < dealerValue) {
      result = 'loss'
    } else {
      result = 'push'
      payout = session.wager_amount
    }

    const isWin = result === 'win' || result === 'blackjack'
    const xpGained = isWin ? 30 : 10

    // Update session and user
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.gambling_sessions.update({
        where: { session_id },
        data: {
          result,
          payout,
          details: { ...details, dealerCards, finalPlayerValue: playerValue, finalDealerValue: dealerValue, status: 'resolved' } as unknown as Prisma.InputJsonValue,
          resolved_at: new Date(),
        },
      })

      const user = await tx.users.update({
        where: { id: session.user_id },
        data: {
          wealth: { increment: payout },
        },
      })

      // Add XP with level recalculation
      if (xpGained > 0) {
        await UserService.addXpInTransaction(session.user_id, xpGained, tx)
      }

      // Update stats
      const existingStats = await tx.player_gambling_stats.findUnique({ where: { user_id: session.user_id } })

      if (existingStats) {
        const streakUpdate = updateGamblingStreak(
          existingStats.current_win_streak ?? 0,
          existingStats.current_loss_streak ?? 0,
          existingStats.best_win_streak ?? 0,
          existingStats.worst_loss_streak ?? 0,
          isWin
        )

        await tx.player_gambling_stats.update({
          where: { user_id: session.user_id },
          data: {
            total_wagered: { increment: session.wager_amount },
            total_won: { increment: payout },
            total_lost: { increment: result === 'loss' ? session.wager_amount : BigInt(0) },
            net_profit: { increment: payout - session.wager_amount },
            blackjack_played: { increment: 1 },
            blackjack_won: { increment: isWin ? 1 : 0 },
            current_win_streak: streakUpdate.winStreak,
            current_loss_streak: streakUpdate.lossStreak,
            best_win_streak: streakUpdate.bestWin,
            worst_loss_streak: streakUpdate.worstLoss,
          },
        })
      } else {
        await tx.player_gambling_stats.create({
          data: {
            user_id: session.user_id,
            total_wagered: session.wager_amount,
            total_won: payout,
            total_lost: result === 'loss' ? session.wager_amount : BigInt(0),
            net_profit: payout - session.wager_amount,
            blackjack_played: 1,
            blackjack_won: isWin ? 1 : 0,
            current_win_streak: isWin ? 1 : 0,
            current_loss_streak: isWin ? 0 : 1,
            best_win_streak: isWin ? 1 : 0,
            worst_loss_streak: isWin ? 0 : 1,
          },
        })
      }

      return user
    })

    return {
      session_id,
      playerCards,
      dealerCards,
      playerValue,
      dealerValue,
      wager: session.wager_amount,
      status: 'resolved',
      result,
      payout,
      newBalance: updatedUser.wealth ?? BigInt(0),
      canDouble: false,
      canSplit: false,
    }
  },

  // ===========================================================================
  // COINFLIP (PvP)
  // ===========================================================================

  async createCoinFlipChallenge(user_id: number, wager_amount: bigint, call: 'heads' | 'tails'): Promise<CoinFlipResult> {
    const preCheck = await this.canGamble(user_id)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)
    if (wager_amount < BigInt(GAMBLING_CONFIG.COINFLIP_MIN_BET)) {
      throw new Error(`Minimum coinflip bet is $${GAMBLING_CONFIG.COINFLIP_MIN_BET}`)
    }
    if (wager_amount > preCheck.wealth) throw new Error('Insufficient funds')

    // Check for existing open challenge
    const existing = await prisma.coin_flip_challenges.findFirst({
      where: { challenger_id: user_id, status: 'open' },
    })
    if (existing) throw new Error('You already have an open coinflip challenge')

    const expires_at = new Date(Date.now() + GAMBLING_CONFIG.COINFLIP_EXPIRY_MINUTES * 60 * 1000)

    // HIGH-02 fix: Wrap wager deduction and challenge creation in transaction
    const challenge = await prisma.$transaction(async (tx) => {
      // Hold funds in escrow (deduct from user)
      await tx.users.update({
        where: { id: user_id },
        data: { wealth: { decrement: wager_amount } },
      })

      // Create challenge
      return tx.coin_flip_challenges.create({
        data: {
          challenger_id: user_id,
          wager_amount,
          challenger_call: call,
          expires_at,
        },
      })
    })

    return {
      success: true,
      challengeId: challenge.challenge_id,
      message: `Coinflip challenge created! Wager: $${wager_amount.toLocaleString()}, Call: ${call}. Expires in ${GAMBLING_CONFIG.COINFLIP_EXPIRY_MINUTES} minutes.`,
    }
  },

  async acceptCoinFlipChallenge(user_id: number, challengeId: number): Promise<CoinFlipResult> {
    const challenge = await prisma.coin_flip_challenges.findUnique({
      where: { challenge_id: challengeId },
      include: { users_coin_flip_challenges_challenger_idTousers: true },
    })

    if (!challenge) throw new Error('Challenge not found')
    if (challenge.status !== 'open') throw new Error('Challenge is no longer open')
    if (challenge.challenger_id === user_id) throw new Error('Cannot accept your own challenge')
    if (challenge.expires_at < new Date()) throw new Error('Challenge has expired')

    const preCheck = await this.canGamble(user_id)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)
    if (challenge.wager_amount > preCheck.wealth) throw new Error('Insufficient funds to match wager')

    // Flip the coin
    const result = flipCoin()
    const challengerWins = result === challenge.challenger_call
    const winner_id = challengerWins ? challenge.challenger_id : user_id
    const loserId = challengerWins ? user_id : challenge.challenger_id
    const totalPot = challenge.wager_amount * BigInt(2)

    // Execute transaction
    await prisma.$transaction(async (tx) => {
      // Deduct from acceptor
      await tx.users.update({
        where: { id: user_id },
        data: { wealth: { decrement: challenge.wager_amount } },
      })

      // Pay winner
      await tx.users.update({
        where: { id: winner_id },
        data: { wealth: { increment: totalPot } },
      })

      // Update challenge
      await tx.coin_flip_challenges.update({
        where: { challenge_id: challengeId },
        data: {
          acceptor_id: user_id,
          result,
          winner_id,
          status: 'resolved',
          resolved_at: new Date(),
        },
      })

      // Update stats for both players
      for (const playerId of [challenge.challenger_id, user_id]) {
        const isWinner = playerId === winner_id
        const existingStats = await tx.player_gambling_stats.findUnique({ where: { user_id: playerId } })

        if (existingStats) {
          await tx.player_gambling_stats.update({
            where: { user_id: playerId },
            data: {
              total_wagered: { increment: challenge.wager_amount },
              total_won: { increment: isWinner ? totalPot : BigInt(0) },
              total_lost: { increment: isWinner ? BigInt(0) : challenge.wager_amount },
              net_profit: { increment: isWinner ? challenge.wager_amount : -challenge.wager_amount },
              coinflips_played: { increment: 1 },
              coinflips_won: { increment: isWinner ? 1 : 0 },
            },
          })
        } else {
          await tx.player_gambling_stats.create({
            data: {
              user_id: playerId,
              total_wagered: challenge.wager_amount,
              total_won: isWinner ? totalPot : BigInt(0),
              total_lost: isWinner ? BigInt(0) : challenge.wager_amount,
              net_profit: isWinner ? challenge.wager_amount : -challenge.wager_amount,
              coinflips_played: 1,
              coinflips_won: isWinner ? 1 : 0,
            },
          })
        }
      }
    })

    const winner = await prisma.users.findUnique({ where: { id: winner_id } })

    return {
      success: true,
      challengeId,
      result,
      winner_id,
      winnerName: winner?.display_name ?? winner?.username ?? 'Unknown',
      payout: totalPot,
      message: `🪙 ${result.toUpperCase()}! ${winner?.display_name ?? winner?.username} wins $${totalPot.toLocaleString()}!`,
    }
  },

  async cancelCoinFlipChallenge(user_id: number): Promise<CoinFlipResult> {
    const challenge = await prisma.coin_flip_challenges.findFirst({
      where: { challenger_id: user_id, status: 'open' },
    })

    if (!challenge) throw new Error('No open challenge to cancel')

    // Refund the wager
    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user_id },
        data: { wealth: { increment: challenge.wager_amount } },
      })

      await tx.coin_flip_challenges.update({
        where: { challenge_id: challenge.challenge_id },
        data: { status: 'cancelled' },
      })
    })

    return {
      success: true,
      message: `Challenge cancelled. $${challenge.wager_amount.toLocaleString()} refunded.`,
    }
  },

  async getOpenCoinFlips(limit: number = 10) {
    return prisma.coin_flip_challenges.findMany({
      where: { status: 'open', expires_at: { gt: new Date() } },
      include: { users_coin_flip_challenges_challenger_idTousers: { select: { id: true, display_name: true, username: true, level: true } } },
      orderBy: { wager_amount: 'desc' },
      take: limit,
    })
  },

  // ===========================================================================
  // LOTTERY
  // ===========================================================================

  async buyLotteryTicket(user_id: number, numbers: number[]): Promise<LotteryTicketResult> {
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

    const preCheck = await this.canGamble(user_id)
    if (!preCheck.canGamble) throw new Error(preCheck.reason)

    const cost = BigInt(GAMBLING_CONFIG.LOTTERY_TICKET_COST)
    if (cost > preCheck.wealth) throw new Error('Insufficient funds for lottery ticket')

    // Get or create current draw
    let draw = await prisma.lottery_draws.findFirst({
      where: { status: 'open', draw_type: 'daily' },
    })

    if (!draw) {
      // Create new daily draw (draws at midnight UTC)
      const tomorrow = new Date()
      tomorrow.setUTCHours(24, 0, 0, 0)

      draw = await prisma.lottery_draws.create({
        data: {
          draw_type: 'daily',
          draw_at: tomorrow,
          prize_pool: BigInt(0),
        },
      })
    }

    // Check ticket limit
    const existingTickets = await prisma.lottery_tickets.count({
      where: { user_id, draw_id: draw.draw_id },
    })
    if (existingTickets >= GAMBLING_CONFIG.LOTTERY_MAX_TICKETS_PER_DRAW) {
      throw new Error(`Maximum ${GAMBLING_CONFIG.LOTTERY_MAX_TICKETS_PER_DRAW} tickets per draw`)
    }

    const sortedNumbers = numbers.sort((a, b) => a - b)
    const numbersStr = sortedNumbers.join(',')

    // Check for duplicate numbers
    const duplicate = await prisma.lottery_tickets.findFirst({
      where: { user_id, draw_id: draw.draw_id, numbers: numbersStr },
    })
    if (duplicate) throw new Error('You already have a ticket with these numbers')

    // Purchase ticket
    const poolContribution = BigInt(Math.floor(Number(cost) * (1 - GAMBLING_CONFIG.LOTTERY_HOUSE_CUT)))

    const ticket = await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user_id },
        data: { wealth: { decrement: cost } },
      })

      await tx.lottery_draws.update({
        where: { draw_id: draw!.draw_id },
        data: { prize_pool: { increment: poolContribution } },
      })

      // Update stats
      const existingStats = await tx.player_gambling_stats.findUnique({ where: { user_id } })
      if (existingStats) {
        await tx.player_gambling_stats.update({
          where: { user_id },
          data: {
            lottery_tickets: { increment: 1 },
            total_wagered: { increment: cost },
          },
        })
      } else {
        await tx.player_gambling_stats.create({
          data: {
            user_id,
            lottery_tickets: 1,
            total_wagered: cost,
          },
        })
      }

      return tx.lottery_tickets.create({
        data: {
          user_id,
          draw_id: draw!.draw_id,
          numbers: numbersStr,
          cost,
        },
      })
    })

    return {
      ticketId: ticket.ticket_id,
      draw_id: draw.draw_id,
      numbers: sortedNumbers,
      cost,
    }
  },

  async getCurrentLottery() {
    const draw = await prisma.lottery_draws.findFirst({
      where: { status: 'open', draw_type: 'daily' },
      include: { _count: { select: { lottery_tickets: true } } },
    })

    return draw ? {
      id: draw.draw_id,
      prize_pool: draw.prize_pool,
      ticketCount: draw._count.lottery_tickets,
      draw_at: draw.draw_at,
    } : null
  },

  async getUserLotteryTickets(user_id: number, draw_id?: number) {
    return prisma.lottery_tickets.findMany({
      where: { user_id, ...(draw_id && { draw_id }) },
      include: { lottery_draws: true },
      orderBy: { created_at: 'desc' },
    })
  },

  async executeLotteryDraw(draw_id: number) {
    const draw = await prisma.lottery_draws.findUnique({
      where: { draw_id },
      include: { lottery_tickets: { include: { users: true } } },
    })

    if (!draw || draw.status !== 'open') throw new Error('Draw not found or already completed')

    const winning_numbers = generateLotteryNumbers()
    const winningStr = winning_numbers.join(',')

    // Find winners
    let jackpotWinner: { user_id: number; ticketId: number } | null = null
    const partialWinners: { user_id: number; matches: number; payout: bigint }[] = []

    for (const ticket of draw.lottery_tickets) {
      const ticketNumbers = ticket.numbers.split(',').map(Number)
      const matches = checkLotteryMatch(ticketNumbers, winning_numbers)

      if (matches === 3) {
        jackpotWinner = { user_id: ticket.user_id, ticketId: ticket.ticket_id }
      } else if (matches > 0) {
        const payout = calculateLotteryPayout(matches, ticket.cost, draw.prize_pool ?? BigInt(0))
        partialWinners.push({ user_id: ticket.user_id, matches, payout })
      }
    }

    const prizePool = draw.prize_pool ?? BigInt(0)

    // Distribute winnings
    await prisma.$transaction(async (tx) => {
      if (jackpotWinner) {
        await tx.users.update({
          where: { id: jackpotWinner.user_id },
          data: { wealth: { increment: prizePool } },
        })

        await tx.player_gambling_stats.upsert({
          where: { user_id: jackpotWinner.user_id },
          create: {
            user_id: jackpotWinner.user_id,
            lottery_wins: 1,
            total_won: prizePool,
            net_profit: prizePool,
          },
          update: {
            lottery_wins: { increment: 1 },
            total_won: { increment: prizePool },
            net_profit: { increment: prizePool },
          },
        })
      }

      for (const winner of partialWinners) {
        await tx.users.update({
          where: { id: winner.user_id },
          data: { wealth: { increment: winner.payout } },
        })
      }

      await tx.lottery_draws.update({
        where: { draw_id },
        data: {
          status: 'completed',
          winning_numbers: winningStr,
          winner_id: jackpotWinner?.user_id,
          winner_payout: jackpotWinner ? draw.prize_pool : null,
          completed_at: new Date(),
        },
      })
    })

    return {
      winning_numbers,
      jackpotWinner,
      partialWinners,
      prize_pool: draw.prize_pool,
    }
  },

  // ===========================================================================
  // STATS & HISTORY
  // ===========================================================================

  async getGamblingStats(user_id: number) {
    return prisma.player_gambling_stats.findUnique({ where: { user_id } })
  },

  async getGamblingHistory(user_id: number, limit: number = 20) {
    return prisma.gambling_sessions.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
      take: limit,
    })
  },

  async getJackpotInfo() {
    let jackpot = await prisma.slot_jackpots.findFirst()
    if (!jackpot) {
      jackpot = await prisma.slot_jackpots.create({
        data: { current_pool: BigInt(GAMBLING_CONFIG.JACKPOT_BASE_POOL) },
      })
    }

    return {
      current_pool: jackpot.current_pool,
      lastWinner: jackpot.last_winner_id,
      last_win_amount: jackpot.last_win_amount,
      last_won_at: jackpot.last_won_at,
    }
  },

  async getGamblingLeaderboard(limit: number = 10) {
    return prisma.player_gambling_stats.findMany({
      where: { total_won: { gt: 0 } },
      orderBy: { total_won: 'desc' },
      take: limit,
      include: { users: { select: { id: true, display_name: true, username: true, level: true } } },
    })
  },

  // ===========================================================================
  // CLEANUP JOBS
  // ===========================================================================

  async expireCoinFlipChallenges() {
    const expired = await prisma.coin_flip_challenges.findMany({
      where: { status: 'open', expires_at: { lt: new Date() } },
    })

    for (const challenge of expired) {
      await prisma.$transaction(async (tx) => {
        // Refund challenger
        await tx.users.update({
          where: { id: challenge.challenger_id },
          data: { wealth: { increment: challenge.wager_amount } },
        })

        await tx.coin_flip_challenges.update({
          where: { challenge_id: challenge.challenge_id },
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
    const pendingDraws = await prisma.lottery_draws.findMany({
      where: {
        status: 'open',
        draw_at: { lte: new Date() },
      },
    })

    const results = {
      checked: pendingDraws.length,
      executed: 0,
      winners: 0,
    }

    for (const draw of pendingDraws) {
      try {
        const result = await this.executeLotteryDraw(draw.draw_id)
        results.executed++
        // Count partial winners and jackpot winner
        const winnerCount = result.partialWinners.length + (result.jackpotWinner ? 1 : 0)
        if (winnerCount > 0) {
          results.winners += winnerCount
        }
      } catch (error) {
        console.error(`Failed to execute lottery draw ${draw.draw_id}:`, error)
      }
    }

    return results
  },
}

export default GamblingService
