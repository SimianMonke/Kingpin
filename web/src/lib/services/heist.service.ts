import { prisma } from '../db'
import {
  HEIST_CONFIG,
  HEIST_EVENT_TYPES,
  HEIST_DIFFICULTIES,
  HEIST_QUICK_GRAB_PHRASES,
  HEIST_CODE_PATTERNS,
  HEIST_WORD_SCRAMBLES,
  HEIST_RIDDLES,
  CRATE_TIERS,
} from '../game'
import type { HeistEventType, HeistDifficulty, CrateTier } from '../game/constants'
import { CrateService } from './crate.service'
import { NotificationService } from './notification.service'
import { DiscordService } from './discord.service'

// =============================================================================
// HEIST SERVICE TYPES
// =============================================================================

export interface HeistEventInfo {
  id: number
  sessionId: number
  eventType: string
  difficulty: string
  prompt: string
  correctAnswer: string
  startedAt: Date
  timeLimitSeconds: number
  endedAt: Date | null
  isActive: boolean
  timeRemainingMs: number
  winner?: {
    id: number
    username: string
    platform: string
    responseTimeMs: number
    crateTier: string
  }
}

export interface HeistScheduleInfo {
  sessionId: number
  nextHeistAt: Date
  timeUntilMs: number
}

export interface TriggerHeistResult {
  success: boolean
  heist?: HeistEventInfo
  error?: string
}

export interface AnswerCheckResult {
  success: boolean
  correct: boolean
  winner?: boolean
  alreadyWon?: boolean
  expired?: boolean
  crateTier?: string
  responseTimeMs?: number
  error?: string
}

export interface HeistHistoryItem {
  id: number
  eventType: string
  difficulty: string
  prompt: string
  correctAnswer: string
  startedAt: Date
  endedAt: Date | null
  winner?: {
    id: number
    username: string
    platform: string
    responseTimeMs: number
  }
  crateTier: string | null
}

export interface GeneratedEvent {
  type: HeistEventType
  difficulty: HeistDifficulty
  prompt: string
  answer: string
  contentId: number // For no-repeat tracking
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleString(str: string): string {
  const arr = str.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

// Normalize string for matching
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Exact match (case-insensitive)
function exactMatch(input: string, answer: string): boolean {
  return normalize(input) === normalize(answer)
}

// Fuzzy match for trivia/riddles
function fuzzyMatch(input: string, answer: string): boolean {
  const normalInput = normalize(input)
  const normalAnswer = normalize(answer)

  // Direct match
  if (normalInput === normalAnswer) return true

  // Check if answer is contained in input
  if (normalInput.includes(normalAnswer)) return true

  // Accept common variations ("a map" matches "map", "the map" matches "map")
  const stripped = normalInput.replace(/^(a|an|the)\s+/, '')
  if (stripped === normalAnswer) return true

  // Check if input starts with answer (for things like "map!" or "map.")
  if (normalInput.replace(/[^a-z0-9\s]/g, '').trim() === normalAnswer) return true

  return false
}

// Numeric match for math problems
function numericMatch(input: string, answer: string): boolean {
  const numInput = parseFloat(input.replace(/[^0-9.-]/g, ''))
  const numAnswer = parseFloat(answer)
  return !isNaN(numInput) && numInput === numAnswer
}

// =============================================================================
// HEIST SERVICE
// =============================================================================

export const HeistService = {
  /**
   * Get active heist event for a session
   */
  async getActiveHeist(sessionId: number): Promise<HeistEventInfo | null> {
    const heist = await prisma.heistEvent.findFirst({
      where: {
        sessionId,
        endedAt: null,
      },
      include: {
        winner: true,
      },
    })

    if (!heist) return null

    const now = Date.now()
    const endTime = heist.startedAt.getTime() + heist.timeLimitSeconds * 1000
    const timeRemainingMs = Math.max(0, endTime - now)
    const isActive = timeRemainingMs > 0 && !heist.winnerUserId

    return {
      id: heist.id,
      sessionId: heist.sessionId,
      eventType: heist.eventType,
      difficulty: heist.difficulty,
      prompt: heist.prompt,
      correctAnswer: heist.correctAnswer,
      startedAt: heist.startedAt,
      timeLimitSeconds: heist.timeLimitSeconds,
      endedAt: heist.endedAt,
      isActive,
      timeRemainingMs,
      winner: heist.winner
        ? {
            id: heist.winner.id,
            username: heist.winner.username,
            platform: heist.winnerPlatform || 'unknown',
            responseTimeMs: heist.responseTimeMs || 0,
            crateTier: heist.crateTier || '',
          }
        : undefined,
    }
  },

  /**
   * Get any active heist (across all sessions)
   */
  async getAnyActiveHeist(): Promise<HeistEventInfo | null> {
    const session = await prisma.streamingSession.findFirst({
      where: { isActive: true },
    })

    if (!session) return null
    return this.getActiveHeist(session.id)
  },

  /**
   * Get heist schedule for a session
   */
  async getHeistSchedule(sessionId: number): Promise<HeistScheduleInfo | null> {
    const schedule = await prisma.heistSchedule.findFirst({
      where: { sessionId },
      orderBy: { nextHeistAt: 'desc' },
    })

    if (!schedule) return null

    return {
      sessionId: schedule.sessionId,
      nextHeistAt: schedule.nextHeistAt,
      timeUntilMs: Math.max(0, schedule.nextHeistAt.getTime() - Date.now()),
    }
  },

  /**
   * Schedule next heist for a session
   */
  async scheduleNextHeist(sessionId: number, isFirstHeist: boolean = false): Promise<HeistScheduleInfo> {
    // Random delay between MIN and MAX minutes
    const delayMinutes = isFirstHeist
      ? HEIST_CONFIG.MIN_AFTER_SESSION_START
      : randInt(HEIST_CONFIG.MIN_DELAY_MINUTES, HEIST_CONFIG.MAX_DELAY_MINUTES)

    const nextHeistAt = new Date(Date.now() + delayMinutes * 60 * 1000)

    // Clear any existing schedule for this session
    await prisma.heistSchedule.deleteMany({
      where: { sessionId },
    })

    // Create new schedule
    await prisma.heistSchedule.create({
      data: {
        sessionId,
        nextHeistAt,
      },
    })

    return {
      sessionId,
      nextHeistAt,
      timeUntilMs: delayMinutes * 60 * 1000,
    }
  },

  /**
   * Clear heist schedule (on session end)
   */
  async clearSchedule(sessionId: number): Promise<void> {
    await prisma.heistSchedule.deleteMany({
      where: { sessionId },
    })
  },

  /**
   * Select event type by weighted distribution
   */
  selectEventType(): HeistEventType {
    const eventTypes = HEIST_CONFIG.EVENT_TYPES
    const roll = Math.random()

    let cumulative = 0
    for (const [type, config] of Object.entries(eventTypes)) {
      cumulative += config.weight
      if (roll < cumulative) {
        return type as HeistEventType
      }
    }

    return HEIST_EVENT_TYPES.QUICK_GRAB // Fallback
  },

  /**
   * Get recently used event content IDs to avoid repeats
   */
  async getRecentEventIds(eventType: string, count: number = 10): Promise<number[]> {
    const recent = await prisma.heistRecentEvent.findMany({
      where: { eventType },
      orderBy: { usedAt: 'desc' },
      take: count,
    })

    return recent.map((r) => r.contentId)
  },

  /**
   * Record event usage for no-repeat logic
   */
  async recordEventUsage(eventType: string, contentId: number): Promise<void> {
    await prisma.heistRecentEvent.create({
      data: {
        eventType,
        contentId,
      },
    })

    // Clean up old entries (keep last N per type)
    const old = await prisma.heistRecentEvent.findMany({
      where: { eventType },
      orderBy: { usedAt: 'desc' },
      skip: HEIST_CONFIG.RECENT_EVENTS_TRACK,
    })

    if (old.length > 0) {
      await prisma.heistRecentEvent.deleteMany({
        where: {
          id: { in: old.map((o) => o.id) },
        },
      })
    }
  },

  /**
   * Generate a code for Code Crack events
   */
  generateCode(): { code: string; patternIndex: number } {
    const patternIndex = randInt(0, HEIST_CODE_PATTERNS.length - 1)
    const pattern = HEIST_CODE_PATTERNS[patternIndex].pattern
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // Exclude I and O to avoid confusion
    const numbers = '0123456789'

    let code = ''
    for (const char of pattern) {
      if (char === 'X') {
        code += letters[randInt(0, letters.length - 1)]
      } else if (char === '0') {
        code += numbers[randInt(0, numbers.length - 1)]
      } else {
        code += char
      }
    }

    return { code, patternIndex }
  },

  /**
   * Generate a math problem
   */
  generateMathProblem(): { expression: string; answer: number } {
    const opType = randInt(0, 3)

    switch (opType) {
      case 0: {
        // Simple multiplication
        const a = randInt(10, 50)
        const b = randInt(2, 12)
        return { expression: `${a} × ${b}`, answer: a * b }
      }
      case 1: {
        // Addition
        const a = randInt(50, 200)
        const b = randInt(10, 50)
        return { expression: `${a} + ${b}`, answer: a + b }
      }
      case 2: {
        // Division (ensure clean result)
        const answer = randInt(5, 20)
        const b = randInt(2, 12)
        const a = answer * b
        return { expression: `${a} ÷ ${b}`, answer }
      }
      case 3:
      default: {
        // Compound (multiply then add)
        const a = randInt(10, 20)
        const b = randInt(2, 5)
        const c = randInt(10, 30)
        return { expression: `(${a} × ${b}) + ${c}`, answer: a * b + c }
      }
    }
  },

  /**
   * Generate event content based on type
   */
  async generateEventContent(eventType: HeistEventType): Promise<GeneratedEvent> {
    const config = HEIST_CONFIG.EVENT_TYPES[eventType]
    const recentIds = await this.getRecentEventIds(eventType)

    let prompt: string
    let answer: string
    let contentId: number

    switch (eventType) {
      case HEIST_EVENT_TYPES.QUICK_GRAB: {
        // Find phrase not recently used
        const availablePhrases = HEIST_QUICK_GRAB_PHRASES
          .map((p, i) => ({ phrase: p, index: i }))
          .filter((p) => !recentIds.includes(p.index))

        const selected = availablePhrases.length > 0
          ? availablePhrases[randInt(0, availablePhrases.length - 1)]
          : { phrase: HEIST_QUICK_GRAB_PHRASES[randInt(0, HEIST_QUICK_GRAB_PHRASES.length - 1)], index: 0 }

        prompt = `Type "!grab ${selected.phrase}" to claim the prize!`
        answer = `!grab ${selected.phrase}`
        contentId = selected.index
        break
      }

      case HEIST_EVENT_TYPES.CODE_CRACK: {
        const { code, patternIndex } = this.generateCode()
        prompt = `Crack the code: ${code}`
        answer = code
        contentId = patternIndex * 1000 + randInt(0, 999) // Unique per generation
        break
      }

      case HEIST_EVENT_TYPES.TRIVIA: {
        // Pull from trivia pool
        const triviaQuestions = await prisma.heistTriviaPool.findMany({
          where: {
            id: { notIn: recentIds },
          },
          orderBy: { timesUsed: 'asc' },
          take: 10,
        })

        if (triviaQuestions.length === 0) {
          // Fallback: get any question
          const fallback = await prisma.heistTriviaPool.findFirst({
            orderBy: { timesUsed: 'asc' },
          })
          if (fallback) {
            prompt = fallback.question
            answer = fallback.answer
            contentId = fallback.id
          } else {
            // No trivia in DB, use hardcoded fallback
            prompt = 'What tier do you need to reach to join a faction?'
            answer = 'Associate'
            contentId = 0
          }
        } else {
          const selected = triviaQuestions[randInt(0, triviaQuestions.length - 1)]
          prompt = selected.question
          answer = selected.answer
          contentId = selected.id

          // Update usage count
          await prisma.heistTriviaPool.update({
            where: { id: selected.id },
            data: {
              timesUsed: { increment: 1 },
              lastUsedAt: new Date(),
            },
          })
        }
        break
      }

      case HEIST_EVENT_TYPES.WORD_SCRAMBLE: {
        const availableScrambles = HEIST_WORD_SCRAMBLES
          .map((s, i) => ({ ...s, index: i }))
          .filter((s) => !recentIds.includes(s.index))

        const selected = availableScrambles.length > 0
          ? availableScrambles[randInt(0, availableScrambles.length - 1)]
          : { ...HEIST_WORD_SCRAMBLES[randInt(0, HEIST_WORD_SCRAMBLES.length - 1)], index: 0 }

        prompt = `Unscramble: ${selected.scrambled}`
        answer = selected.answer
        contentId = selected.index
        break
      }

      case HEIST_EVENT_TYPES.RIDDLE: {
        const availableRiddles = HEIST_RIDDLES
          .map((r, i) => ({ ...r, index: i }))
          .filter((r) => !recentIds.includes(r.index))

        const selected = availableRiddles.length > 0
          ? availableRiddles[randInt(0, availableRiddles.length - 1)]
          : { ...HEIST_RIDDLES[randInt(0, HEIST_RIDDLES.length - 1)], index: 0 }

        prompt = selected.riddle
        answer = selected.answer
        contentId = selected.index
        break
      }

      case HEIST_EVENT_TYPES.MATH_HACK: {
        const math = this.generateMathProblem()
        prompt = `Decrypt: ${math.expression} = ?`
        answer = math.answer.toString()
        contentId = randInt(0, 99999) // Random ID for math
        break
      }

      default:
        prompt = 'Quick! Type "!grab WIN" to claim!'
        answer = '!grab WIN'
        contentId = 0
    }

    return {
      type: eventType,
      difficulty: config.difficulty as HeistDifficulty,
      prompt,
      answer,
      contentId,
    }
  },

  /**
   * Trigger a heist event
   */
  async triggerHeist(sessionId: number, eventType?: HeistEventType): Promise<TriggerHeistResult> {
    // Check session exists and is active
    const session = await prisma.streamingSession.findFirst({
      where: { id: sessionId, isActive: true },
    })

    if (!session) {
      return { success: false, error: 'No active session found' }
    }

    // Check no active heist already
    const activeHeist = await this.getActiveHeist(sessionId)
    if (activeHeist?.isActive) {
      return { success: false, error: 'A heist is already in progress' }
    }

    // Select event type if not specified
    const selectedType = eventType || this.selectEventType()

    // Generate event content
    const eventContent = await this.generateEventContent(selectedType)
    const config = HEIST_CONFIG.EVENT_TYPES[eventContent.type]

    // Create heist event
    const heist = await prisma.heistEvent.create({
      data: {
        sessionId,
        eventType: eventContent.type,
        difficulty: eventContent.difficulty,
        prompt: eventContent.prompt,
        correctAnswer: eventContent.answer,
        startedAt: new Date(),
        timeLimitSeconds: config.time,
      },
    })

    // Record usage for no-repeat
    await this.recordEventUsage(eventContent.type, eventContent.contentId)

    // Schedule next heist
    await this.scheduleNextHeist(sessionId)

    return {
      success: true,
      heist: {
        id: heist.id,
        sessionId: heist.sessionId,
        eventType: heist.eventType,
        difficulty: heist.difficulty,
        prompt: heist.prompt,
        correctAnswer: heist.correctAnswer,
        startedAt: heist.startedAt,
        timeLimitSeconds: heist.timeLimitSeconds,
        endedAt: null,
        isActive: true,
        timeRemainingMs: config.time * 1000,
      },
    }
  },

  /**
   * Check if an answer is correct for the active heist
   */
  checkAnswerFormat(eventType: string, userAnswer: string, correctAnswer: string): boolean {
    switch (eventType) {
      case HEIST_EVENT_TYPES.QUICK_GRAB:
        return exactMatch(userAnswer, correctAnswer)

      case HEIST_EVENT_TYPES.CODE_CRACK:
        // Case-sensitive for letters
        return userAnswer.trim() === correctAnswer

      case HEIST_EVENT_TYPES.TRIVIA:
      case HEIST_EVENT_TYPES.WORD_SCRAMBLE:
      case HEIST_EVENT_TYPES.RIDDLE:
        return fuzzyMatch(userAnswer, correctAnswer)

      case HEIST_EVENT_TYPES.MATH_HACK:
        return numericMatch(userAnswer, correctAnswer)

      default:
        return exactMatch(userAnswer, correctAnswer)
    }
  },

  /**
   * Submit an answer for an active heist
   */
  async submitAnswer(
    userId: number,
    answer: string,
    platform: string
  ): Promise<AnswerCheckResult> {
    // Find active session
    const session = await prisma.streamingSession.findFirst({
      where: { isActive: true },
    })

    if (!session) {
      return { success: false, correct: false, error: 'No active session' }
    }

    // Find active heist
    const heist = await prisma.heistEvent.findFirst({
      where: {
        sessionId: session.id,
        endedAt: null,
      },
    })

    if (!heist) {
      return { success: false, correct: false, error: 'No active heist' }
    }

    // Check if already won
    if (heist.winnerUserId) {
      return { success: true, correct: false, alreadyWon: true }
    }

    // Check if expired
    const endTime = heist.startedAt.getTime() + heist.timeLimitSeconds * 1000
    if (Date.now() > endTime) {
      return { success: true, correct: false, expired: true }
    }

    // Check answer
    const isCorrect = this.checkAnswerFormat(heist.eventType, answer, heist.correctAnswer)

    if (!isCorrect) {
      return { success: true, correct: false }
    }

    // Winner! Roll crate tier
    const crateTier = this.rollCrateTier(heist.difficulty as HeistDifficulty)
    const responseTimeMs = Date.now() - heist.startedAt.getTime()

    // Update heist with winner
    await prisma.heistEvent.update({
      where: { id: heist.id },
      data: {
        winnerUserId: userId,
        winnerPlatform: platform,
        winningAnswer: answer,
        responseTimeMs,
        crateTier,
        endedAt: new Date(),
      },
    })

    // Award crate to winner
    await CrateService.awardCrate(userId, crateTier as CrateTier, 'heist' as any)

    // Notify winner
    await NotificationService.notifyHeistWon(userId, crateTier, responseTimeMs)

    // Get winner username for Discord (hard difficulty only)
    if (heist.difficulty === 'hard') {
      const winner = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, kingpinName: true },
      })
      if (winner) {
        await DiscordService.postHeistWinner(
          winner.kingpinName || winner.username,
          heist.eventType,
          heist.difficulty,
          crateTier,
          responseTimeMs
        )
      }
    }

    return {
      success: true,
      correct: true,
      winner: true,
      crateTier,
      responseTimeMs,
    }
  },

  /**
   * Expire a heist (time ran out)
   */
  async expireHeist(heistId: number): Promise<void> {
    await prisma.heistEvent.update({
      where: { id: heistId },
      data: { endedAt: new Date() },
    })
  },

  /**
   * Check and expire any overdue heists
   */
  async checkExpiredHeists(): Promise<number> {
    const now = new Date()

    // Find heists that should have expired
    const expiredHeists = await prisma.heistEvent.findMany({
      where: {
        endedAt: null,
        winnerUserId: null,
      },
    })

    let expiredCount = 0

    for (const heist of expiredHeists) {
      const endTime = heist.startedAt.getTime() + heist.timeLimitSeconds * 1000
      if (now.getTime() > endTime) {
        await this.expireHeist(heist.id)
        expiredCount++
      }
    }

    return expiredCount
  },

  /**
   * Roll crate tier based on difficulty
   */
  rollCrateTier(difficulty: HeistDifficulty): CrateTier {
    const chances = HEIST_CONFIG.CRATE_CHANCES_BY_DIFFICULTY[difficulty]
    const roll = Math.random()

    let cumulative = 0

    cumulative += chances.common
    if (roll < cumulative) return CRATE_TIERS.COMMON

    cumulative += chances.uncommon
    if (roll < cumulative) return CRATE_TIERS.UNCOMMON

    cumulative += chances.rare
    if (roll < cumulative) return CRATE_TIERS.RARE

    return CRATE_TIERS.LEGENDARY
  },

  /**
   * Get heist history
   */
  async getHeistHistory(sessionId?: number, limit: number = 20): Promise<HeistHistoryItem[]> {
    const where = sessionId ? { sessionId } : {}

    const heists = await prisma.heistEvent.findMany({
      where,
      include: {
        winner: true,
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    })

    return heists.map((h) => ({
      id: h.id,
      eventType: h.eventType,
      difficulty: h.difficulty,
      prompt: h.prompt,
      correctAnswer: h.correctAnswer,
      startedAt: h.startedAt,
      endedAt: h.endedAt,
      winner: h.winner
        ? {
            id: h.winner.id,
            username: h.winner.username,
            platform: h.winnerPlatform || 'unknown',
            responseTimeMs: h.responseTimeMs || 0,
          }
        : undefined,
      crateTier: h.crateTier,
    }))
  },

  /**
   * Get heist stats for a user
   */
  async getUserHeistStats(userId: number): Promise<{
    totalWins: number
    avgResponseTimeMs: number
    cratesByTier: Record<string, number>
    fastestWinMs: number | null
  }> {
    const wins = await prisma.heistEvent.findMany({
      where: { winnerUserId: userId },
    })

    const cratesByTier: Record<string, number> = {
      [CRATE_TIERS.COMMON]: 0,
      [CRATE_TIERS.UNCOMMON]: 0,
      [CRATE_TIERS.RARE]: 0,
      [CRATE_TIERS.LEGENDARY]: 0,
    }

    let totalResponseTime = 0
    let fastestWinMs: number | null = null

    for (const win of wins) {
      if (win.crateTier) {
        cratesByTier[win.crateTier] = (cratesByTier[win.crateTier] || 0) + 1
      }
      if (win.responseTimeMs) {
        totalResponseTime += win.responseTimeMs
        if (fastestWinMs === null || win.responseTimeMs < fastestWinMs) {
          fastestWinMs = win.responseTimeMs
        }
      }
    }

    return {
      totalWins: wins.length,
      avgResponseTimeMs: wins.length > 0 ? Math.round(totalResponseTime / wins.length) : 0,
      cratesByTier,
      fastestWinMs,
    }
  },

  /**
   * Check if it's time to trigger a heist
   */
  async checkAndTriggerScheduledHeist(sessionId: number): Promise<TriggerHeistResult | null> {
    const schedule = await this.getHeistSchedule(sessionId)

    if (!schedule) {
      // No schedule, create one
      await this.scheduleNextHeist(sessionId, true)
      return null
    }

    if (schedule.timeUntilMs > 0) {
      // Not time yet
      return null
    }

    // Time to trigger!
    return this.triggerHeist(sessionId)
  },

  /**
   * Get heist leaderboard (most wins)
   */
  async getHeistLeaderboard(limit: number = 10): Promise<
    Array<{
      userId: number
      username: string
      wins: number
      avgResponseTimeMs: number
    }>
  > {
    const results = await prisma.heistEvent.groupBy({
      by: ['winnerUserId'],
      where: {
        winnerUserId: { not: null },
      },
      _count: { id: true },
      _avg: { responseTimeMs: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    })

    // Get usernames
    const userIds = results.map((r) => r.winnerUserId).filter((id): id is number => id !== null)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u.username]))

    return results
      .filter((r) => r.winnerUserId !== null)
      .map((r) => ({
        userId: r.winnerUserId!,
        username: userMap.get(r.winnerUserId!) || 'Unknown',
        wins: r._count.id,
        avgResponseTimeMs: Math.round(r._avg.responseTimeMs || 0),
      }))
  },
}

export default HeistService
