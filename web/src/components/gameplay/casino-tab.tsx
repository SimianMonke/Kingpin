'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GameActionPanel, ActionResult } from './game-action-panel'
import { CurrencyDisplay } from '@/components/ui/kinetic-number'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

type CasinoGame = 'blackjack' | 'slots' | 'coinflip' | 'lottery'

const CASINO_GAMES: { id: CasinoGame; label: string; icon: React.ReactNode; description: string; minBet: number }[] = [
  {
    id: 'blackjack',
    label: 'BLACKJACK',
    icon: <CardsIcon className="w-5 h-5" />,
    description: 'Beat the dealer to 21 without going bust',
    minBet: 100,
  },
  {
    id: 'slots',
    label: 'SLOTS',
    icon: <SlotsIcon className="w-5 h-5" />,
    description: 'Spin for matching symbols and jackpots',
    minBet: 50,
  },
  {
    id: 'coinflip',
    label: 'COINFLIP',
    icon: <CoinIcon className="w-5 h-5" />,
    description: 'Double or nothing on heads or tails',
    minBet: 100,
  },
  {
    id: 'lottery',
    label: 'LOTTERY',
    icon: <TicketIcon className="w-5 h-5" />,
    description: 'Pick numbers for a chance at the jackpot',
    minBet: 500,
  },
]

// =============================================================================
// CASINO TAB
// =============================================================================

export function CasinoTab() {
  const [selectedGame, setSelectedGame] = useState<CasinoGame>('blackjack')

  return (
    <div className="space-y-6">
      {/* Game Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CASINO_GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => setSelectedGame(game.id)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border-2 transition-all',
              selectedGame === game.id
                ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-warning)]/50 text-[var(--color-muted)]'
            )}
          >
            {game.icon}
            <span className="font-display text-xs uppercase tracking-wider">
              {game.label}
            </span>
          </button>
        ))}
      </div>

      {/* Game Panel */}
      {selectedGame === 'blackjack' && <BlackjackGame />}
      {selectedGame === 'slots' && <SlotsGame />}
      {selectedGame === 'coinflip' && <CoinflipGame />}
      {selectedGame === 'lottery' && <LotteryGame />}
    </div>
  )
}

// =============================================================================
// BLACKJACK GAME
// =============================================================================

function BlackjackGame() {
  const [bet, setBet] = useState<number>(100)
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'result'>('betting')
  const [playerHand, setPlayerHand] = useState<string[]>([])
  const [dealerHand, setDealerHand] = useState<string[]>([])
  const [result, setResult] = useState<ActionResult | null>(null)

  const handleDeal = useCallback(async (): Promise<ActionResult> => {
    const res = await fetch('/api/gambling/blackjack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet, action: 'deal' }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to start game')
    }

    setPlayerHand(data.data.playerHand || [])
    setDealerHand(data.data.dealerHand || [])
    setGameState('playing')

    // Check for immediate blackjack
    if (data.data.result) {
      setGameState('result')
      return {
        success: data.data.won,
        message: data.data.message,
        event: data.data.result,
        wealth: data.data.payout,
      }
    }

    return {
      success: true,
      message: 'Cards dealt! Hit or Stand?',
      event: 'CARDS DEALT',
    }
  }, [bet])

  const handleAction = useCallback(async (action: 'hit' | 'stand'): Promise<ActionResult> => {
    const res = await fetch('/api/gambling/blackjack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Action failed')
    }

    setPlayerHand(data.data.playerHand || playerHand)
    setDealerHand(data.data.dealerHand || dealerHand)

    if (data.data.result) {
      setGameState('result')
      return {
        success: data.data.won,
        message: data.data.message,
        event: data.data.result,
        wealth: data.data.payout,
      }
    }

    return {
      success: true,
      message: 'Card drawn',
    }
  }, [playerHand, dealerHand])

  const resetGame = () => {
    setGameState('betting')
    setPlayerHand([])
    setDealerHand([])
    setResult(null)
  }

  return (
    <Card variant="default" glow="warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CardsIcon className="w-5 h-5 text-[var(--color-warning)]" />
          BLACKJACK
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gameState === 'betting' && (
          <>
            <div className="flex items-center gap-4">
              <span className="font-display text-sm uppercase text-[var(--color-muted)]">
                BET AMOUNT
              </span>
              <Input
                type="number"
                min={100}
                step={100}
                value={bet}
                onChange={(e) => setBet(Math.max(100, parseInt(e.target.value) || 100))}
                className="w-32"
              />
              <div className="flex gap-2">
                {[100, 500, 1000, 5000].map((amount) => (
                  <Button
                    key={amount}
                    variant="ghost"
                    size="sm"
                    onClick={() => setBet(amount)}
                    className={cn(bet === amount && 'border-[var(--color-warning)]')}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
            </div>
            <GameActionPanel
              title="START GAME"
              description="Place your bet and deal the cards"
              icon={<CardsIcon className="w-6 h-6" />}
              actionLabel={`DEAL - $${bet.toLocaleString()}`}
              onAction={handleDeal}
              accentColor="warning"
            />
          </>
        )}

        {gameState === 'playing' && (
          <div className="space-y-4">
            {/* Dealer Hand */}
            <div className="p-4 bg-[var(--color-surface)]">
              <span className="font-display text-xs uppercase text-[var(--color-muted)]">
                DEALER
              </span>
              <div className="flex gap-2 mt-2">
                {dealerHand.map((card, i) => (
                  <CardDisplay key={i} card={card} />
                ))}
              </div>
            </div>

            {/* Player Hand */}
            <div className="p-4 bg-[var(--color-surface)] border-2 border-[var(--color-primary)]">
              <span className="font-display text-xs uppercase text-[var(--color-primary)]">
                YOUR HAND
              </span>
              <div className="flex gap-2 mt-2">
                {playerHand.map((card, i) => (
                  <CardDisplay key={i} card={card} />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => handleAction('hit')}
                variant="default"
                className="flex-1"
              >
                HIT
              </Button>
              <Button
                onClick={() => handleAction('stand')}
                variant="ghost"
                className="flex-1"
              >
                STAND
              </Button>
            </div>
          </div>
        )}

        {gameState === 'result' && (
          <div className="space-y-4">
            {/* Final Hands */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--color-surface)]">
                <span className="font-display text-xs uppercase text-[var(--color-muted)]">
                  DEALER
                </span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {dealerHand.map((card, i) => (
                    <CardDisplay key={i} card={card} small />
                  ))}
                </div>
              </div>
              <div className="p-4 bg-[var(--color-surface)]">
                <span className="font-display text-xs uppercase text-[var(--color-primary)]">
                  YOU
                </span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {playerHand.map((card, i) => (
                    <CardDisplay key={i} card={card} small />
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={resetGame} variant="default" className="w-full">
              PLAY AGAIN
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CardDisplay({ card, small }: { card: string; small?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-white text-black font-bold border-2 border-[var(--color-border)]',
        small ? 'w-8 h-10 text-xs' : 'w-12 h-16 text-lg'
      )}
    >
      {card}
    </div>
  )
}

// =============================================================================
// SLOTS GAME
// =============================================================================

function SlotsGame() {
  const [bet, setBet] = useState<number>(50)

  const handleSpin = useCallback(async (): Promise<ActionResult> => {
    const res = await fetch('/api/gambling/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Spin failed')
    }

    const symbols = data.data.symbols?.join(' | ') || '? | ? | ?'

    return {
      success: data.data.won,
      message: data.data.message || (data.data.won ? 'Winner!' : 'Better luck next time'),
      event: symbols,
      wealth: data.data.payout,
    }
  }, [bet])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GameActionPanel
        title="SLOT MACHINE"
        description="Match symbols to win big"
        icon={<SlotsIcon className="w-6 h-6" />}
        actionLabel={`SPIN - $${bet.toLocaleString()}`}
        onAction={handleSpin}
        accentColor="warning"
      >
        <div className="flex items-center gap-4">
          <span className="font-display text-sm uppercase text-[var(--color-muted)]">
            BET
          </span>
          <Input
            type="number"
            min={50}
            step={50}
            value={bet}
            onChange={(e) => setBet(Math.max(50, parseInt(e.target.value) || 50))}
            className="w-32"
          />
          <div className="flex gap-2">
            {[50, 100, 500, 1000].map((amount) => (
              <Button
                key={amount}
                variant="ghost"
                size="sm"
                onClick={() => setBet(amount)}
              >
                ${amount}
              </Button>
            ))}
          </div>
        </div>
      </GameActionPanel>

      <Card variant="solid">
        <CardHeader>
          <CardTitle className="text-sm">PAYOUT TABLE</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span>777</span>
              <span className="text-[var(--color-warning)]">100x</span>
            </div>
            <div className="flex justify-between">
              <span>Triple Match</span>
              <span className="text-[var(--color-success)]">10x</span>
            </div>
            <div className="flex justify-between">
              <span>Double Match</span>
              <span>2x</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// COINFLIP GAME
// =============================================================================

function CoinflipGame() {
  const [bet, setBet] = useState<number>(100)
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads')

  const handleFlip = useCallback(async (): Promise<ActionResult> => {
    const res = await fetch('/api/gambling/coinflip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet, choice }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Flip failed')
    }

    return {
      success: data.data.won,
      message: `The coin landed on ${data.data.result?.toUpperCase()}!`,
      event: data.data.won ? 'YOU WIN!' : 'YOU LOSE',
      wealth: data.data.won ? bet : -bet,
    }
  }, [bet, choice])

  return (
    <GameActionPanel
      title="COINFLIP"
      description="50/50 chance to double your money"
      icon={<CoinIcon className="w-6 h-6" />}
      actionLabel={`FLIP - $${bet.toLocaleString()}`}
      onAction={handleFlip}
      accentColor="warning"
    >
      <div className="space-y-4">
        {/* Bet Amount */}
        <div className="flex items-center gap-4">
          <span className="font-display text-sm uppercase text-[var(--color-muted)]">
            BET
          </span>
          <Input
            type="number"
            min={100}
            step={100}
            value={bet}
            onChange={(e) => setBet(Math.max(100, parseInt(e.target.value) || 100))}
            className="w-32"
          />
        </div>

        {/* Choice */}
        <div className="flex gap-3">
          <button
            onClick={() => setChoice('heads')}
            className={cn(
              'flex-1 p-4 border-2 font-display uppercase tracking-wider transition-all',
              choice === 'heads'
                ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-warning)]/50'
            )}
          >
            HEADS
          </button>
          <button
            onClick={() => setChoice('tails')}
            className={cn(
              'flex-1 p-4 border-2 font-display uppercase tracking-wider transition-all',
              choice === 'tails'
                ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-warning)]/50'
            )}
          >
            TAILS
          </button>
        </div>
      </div>
    </GameActionPanel>
  )
}

// =============================================================================
// LOTTERY GAME
// =============================================================================

function LotteryGame() {
  const [numbers, setNumbers] = useState<number[]>([])

  const handleBuyTicket = useCallback(async (): Promise<ActionResult> => {
    const res = await fetch('/api/gambling/lottery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers: numbers.length > 0 ? numbers : undefined }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to buy ticket')
    }

    return {
      success: true,
      message: `Ticket purchased! Your numbers: ${data.data.ticket?.join(', ')}`,
      event: 'LOTTERY TICKET',
      details: data.data,
    }
  }, [numbers])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GameActionPanel
        title="LOTTERY"
        description="Pick your lucky numbers for the next draw"
        icon={<TicketIcon className="w-6 h-6" />}
        actionLabel="BUY TICKET - $500"
        onAction={handleBuyTicket}
        accentColor="warning"
      >
        <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)]">
          <span className="font-mono text-xs text-[var(--color-muted)]">
            Numbers will be auto-generated if not selected
          </span>
        </div>
      </GameActionPanel>

      <Card variant="solid">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-[var(--color-warning)]" />
            JACKPOT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <span className="font-display text-3xl text-[var(--color-warning)]">
              <CurrencyDisplay value={1000000} />
            </span>
            <p className="font-mono text-xs text-[var(--color-muted)] mt-2">
              Next draw in 24:00:00
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function CardsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="4" width="14" height="16" rx="2" />
      <rect x="8" y="2" width="14" height="16" rx="2" />
    </svg>
  )
}

function SlotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M9 9l3-3 3 3M9 15l3 3 3-3" />
    </svg>
  )
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  )
}
