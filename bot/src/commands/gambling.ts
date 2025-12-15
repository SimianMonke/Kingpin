import { apiClient } from '../api-client'
import { formatWealth } from '../utils/formatter'
import type { CommandContext } from '../types'

// =============================================================================
// GAMBLING COMMANDS (Phase 11)
// =============================================================================

export const gamblingCommands = {
  /**
   * !slots <amount> - Play the slot machine
   */
  async slots(ctx: CommandContext): Promise<void> {
    const amount = parseInt(ctx.args[0])
    if (!amount || amount < 100) {
      await ctx.reply('Usage: !slots <amount> (min $100)')
      return
    }

    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.playSlots(profileResponse.data.id, amount)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to play slots: ${response.error || 'Unknown error'}`)
      return
    }

    const { reels, payout, isJackpot, multiplier, newBalance } = response.data

    if (isJackpot) {
      await ctx.reply(`🎰 ${reels.join(' ')} 🎰 JACKPOT!!! You won ${formatWealth(payout)}! 💰💰💰`)
    } else if (payout > 0) {
      await ctx.reply(`🎰 ${reels.join(' ')} - ${multiplier}x WIN! +${formatWealth(payout)} (Balance: ${formatWealth(newBalance)})`)
    } else {
      await ctx.reply(`🎰 ${reels.join(' ')} - No match. -${formatWealth(amount)}`)
    }
  },

  /**
   * !jackpot - Check current jackpot pool
   */
  async jackpot(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getJackpotInfo()

    if (!response.success || !response.data) {
      await ctx.reply('Failed to get jackpot info')
      return
    }

    const { currentPool, lastWinAmount, lastWonAt } = response.data

    let lastWinStr = ''
    if (lastWinAmount && lastWonAt) {
      const date = new Date(lastWonAt)
      lastWinStr = ` | Last Win: ${formatWealth(lastWinAmount)} (${date.toLocaleDateString()})`
    }

    await ctx.reply(`🎰 Current Jackpot: ${formatWealth(currentPool)}${lastWinStr}`)
  },

  /**
   * !blackjack <amount> or !bj <amount> - Start a blackjack hand
   */
  async blackjack(ctx: CommandContext): Promise<void> {
    const amount = parseInt(ctx.args[0])
    if (!amount || amount < 100) {
      await ctx.reply('Usage: !blackjack <amount> (min $100)')
      return
    }

    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.blackjackAction(profileResponse.data.id, 'start', amount)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed to start blackjack: ${response.error || 'Unknown error'}`)
      return
    }

    const { playerCards, dealerCards, playerValue, status, result, payout } = response.data

    const playerHand = formatCards(playerCards)
    const dealerHand = formatCards(dealerCards)

    if (status === 'resolved' && result === 'blackjack') {
      await ctx.reply(`🃏 BLACKJACK! ${playerHand} (21) | Dealer: ${dealerHand} | You win ${formatWealth(payout)}!`)
    } else {
      await ctx.reply(`🃏 Your hand: ${playerHand} (${playerValue}) | Dealer shows: ${dealerHand} | !hit, !stand, or !double`)
    }
  },

  /**
   * !hit - Draw another card in blackjack
   */
  async hit(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.blackjackAction(profileResponse.data.id, 'hit')

    if (!response.success || !response.data) {
      await ctx.reply(`${response.error || 'No active blackjack hand'}`)
      return
    }

    const { playerCards, dealerCards, playerValue, status, result, payout, dealerValue, wager } = response.data

    if (status === 'resolved') {
      await ctx.reply(formatBlackjackResult(playerCards, dealerCards, playerValue, dealerValue, result, payout, wager))
    } else {
      await ctx.reply(`🃏 ${formatCards(playerCards)} (${playerValue}) | !hit or !stand`)
    }
  },

  /**
   * !stand - Keep current blackjack hand
   */
  async stand(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.blackjackAction(profileResponse.data.id, 'stand')

    if (!response.success || !response.data) {
      await ctx.reply(`${response.error || 'No active blackjack hand'}`)
      return
    }

    const { playerCards, dealerCards, playerValue, dealerValue, result, payout, wager } = response.data
    await ctx.reply(formatBlackjackResult(playerCards, dealerCards, playerValue, dealerValue, result, payout, wager))
  },

  /**
   * !double - Double down in blackjack
   */
  async double(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.blackjackAction(profileResponse.data.id, 'double')

    if (!response.success || !response.data) {
      await ctx.reply(`${response.error || 'Cannot double'}`)
      return
    }

    const { playerCards, dealerCards, playerValue, dealerValue, result, payout, wager } = response.data
    await ctx.reply(formatBlackjackResult(playerCards, dealerCards, playerValue, dealerValue, result, payout, wager))
  },

  /**
   * !flip <amount> <heads|tails> - Create a coinflip challenge
   */
  async flip(ctx: CommandContext): Promise<void> {
    const amount = parseInt(ctx.args[0])
    const call = ctx.args[1]?.toLowerCase()

    if (!amount || amount < 500 || !['heads', 'tails'].includes(call)) {
      await ctx.reply('Usage: !flip <amount> <heads|tails> (min $500)')
      return
    }

    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.coinflipAction(profileResponse.data.id, 'create', amount, call as 'heads' | 'tails')

    if (!response.success || !response.data) {
      await ctx.reply(`Failed: ${response.error || 'Unknown error'}`)
      return
    }

    await ctx.reply(`🪙 ${response.data.message} Others can use !accept ${response.data.challengeId} to accept.`)
  },

  /**
   * !accept <challengeId> - Accept a coinflip challenge
   */
  async accept(ctx: CommandContext): Promise<void> {
    const challengeId = parseInt(ctx.args[0])
    if (!challengeId) {
      await ctx.reply('Usage: !accept <challengeId>')
      return
    }

    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.coinflipAction(profileResponse.data.id, 'accept', undefined, undefined, challengeId)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed: ${response.error || 'Unknown error'}`)
      return
    }

    await ctx.reply(response.data.message)
  },

  /**
   * !flips - List open coinflip challenges
   */
  async flips(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getOpenCoinflips()

    if (!response.success || !response.data) {
      await ctx.reply('Failed to get coinflips')
      return
    }

    const { challenges } = response.data

    if (challenges.length === 0) {
      await ctx.reply('🪙 No open coinflip challenges. Create one with !flip <amount> <heads|tails>')
      return
    }

    const list = challenges.slice(0, 5).map((c: any) =>
      `#${c.id}: ${c.challenger.displayName || c.challenger.username} - ${formatWealth(c.wagerAmount)} (${c.challengerCall})`
    ).join(' | ')

    await ctx.reply(`🪙 Open flips: ${list}`)
  },

  /**
   * !cancelflip - Cancel your open coinflip challenge
   */
  async cancelflip(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.coinflipAction(profileResponse.data.id, 'cancel')

    if (!response.success || !response.data) {
      await ctx.reply(`Failed: ${response.error || 'No open challenge'}`)
      return
    }

    await ctx.reply(response.data.message)
  },

  /**
   * !lottery <num1> <num2> <num3> - Buy a lottery ticket
   */
  async lottery(ctx: CommandContext): Promise<void> {
    const numbers = ctx.args.slice(0, 3).map(n => parseInt(n))

    if (numbers.length !== 3 || numbers.some(n => isNaN(n) || n < 1 || n > 20)) {
      await ctx.reply('Usage: !lottery <num1> <num2> <num3> (numbers 1-20)')
      return
    }

    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.buyLotteryTicket(profileResponse.data.id, numbers)

    if (!response.success || !response.data) {
      await ctx.reply(`Failed: ${response.error || 'Unknown error'}`)
      return
    }

    await ctx.reply(`🎟️ Ticket purchased! Numbers: ${response.data.numbers.join(', ')} | Cost: ${formatWealth(response.data.cost)}`)
  },

  /**
   * !lotto - Check current lottery info
   */
  async lotto(ctx: CommandContext): Promise<void> {
    const response = await apiClient.getCurrentLottery()

    if (!response.success || !response.data) {
      await ctx.reply('Failed to get lottery info')
      return
    }

    const { lottery } = response.data

    if (!lottery) {
      await ctx.reply('🎰 No active lottery. Buy a ticket with !lottery <n1> <n2> <n3> to start one!')
      return
    }

    const timeLeft = Math.max(0, new Date(lottery.drawAt).getTime() - Date.now())
    const hours = Math.floor(timeLeft / (1000 * 60 * 60))
    const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))

    await ctx.reply(`🎰 Lottery Pool: ${formatWealth(lottery.prizePool)} | Tickets: ${lottery.ticketCount} | Draws in: ${hours}h ${mins}m`)
  },

  /**
   * !gamblestats - View your gambling statistics
   */
  async gamblestats(ctx: CommandContext): Promise<void> {
    const profileResponse = await apiClient.getProfileByUsername(ctx.message.username)
    if (!profileResponse.success || !profileResponse.data) {
      await ctx.reply('Could not find your profile')
      return
    }

    const response = await apiClient.getGamblingStats(profileResponse.data.id)

    if (!response.success || !response.data) {
      await ctx.reply('No gambling stats yet. Try !slots, !blackjack, or !flip!')
      return
    }

    const s = response.data.stats
    if (!s) {
      await ctx.reply('No gambling stats yet. Try !slots, !blackjack, or !flip!')
      return
    }

    await ctx.reply(`📊 Won: ${formatWealth(s.totalWon)} | Lost: ${formatWealth(s.totalLost)} | Net: ${formatWealth(s.netProfit)} | Best Streak: ${s.bestWinStreak} | Jackpots: ${s.jackpotsHit}`)
  },
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCards(cards: Array<{ rank: string; suit: string }>): string {
  return cards.map(c => `${c.rank}${c.suit}`).join(' ')
}

function formatBlackjackResult(
  playerCards: Array<{ rank: string; suit: string }>,
  dealerCards: Array<{ rank: string; suit: string }>,
  playerValue: number,
  dealerValue: number | undefined,
  result: string | undefined,
  payout: bigint | number | undefined,
  wager: bigint | number | undefined
): string {
  const playerHand = formatCards(playerCards)
  const dealerHand = formatCards(dealerCards)

  let outcome = ''
  switch (result) {
    case 'blackjack': outcome = `BLACKJACK! +${formatWealth(payout || 0)}`; break
    case 'win': outcome = `WIN! +${formatWealth(payout || 0)}`; break
    case 'loss': outcome = `LOSS. -${formatWealth(wager || 0)}`; break
    case 'push': outcome = `PUSH. Wager returned.`; break
    default: outcome = 'Unknown result'
  }

  return `🃏 You: ${playerHand} (${playerValue}) | Dealer: ${dealerHand} (${dealerValue}) | ${outcome}`
}

export default gamblingCommands
