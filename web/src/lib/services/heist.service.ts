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
  session_id: number
  event_type: string
  difficulty: string
  prompt: string
  correct_answer: string
  started_at: Date
  time_limit_seconds: number
  ended_at: Date | null
  is_active: boolean
  timeRemainingMs: number
  winner?: {
    id: number
    username: string
    platform: string
    response_time_ms: number
    crate_tier: string
  }
}

export interface HeistScheduleInfo {
  session_id: number
  next_heist_at: Date
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
  crate_tier?: string
  response_time_ms?: number
  error?: string
}

export interface HeistHistoryItem {
  id: number
  event_type: string
  difficulty: string
  prompt: string
  correct_answer: string
  started_at: Date
  ended_at: Date | null
  winner?: {
    id: number
    username: string
    platform: string
    response_time_ms: number
  }
  crate_tier: string | null
}

export interface GeneratedEvent {
  type: HeistEventType
  difficulty: HeistDifficulty
  prompt: string
  answer: string
  content_id: number // For no-repeat tracking
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
  async getActiveHeist(session_id: number): Promise<HeistEventInfo | null> {
    const heist = await prisma.heist_events.findFirst({
      where: {
        session_id,
        ended_at: null,
      },
      include: {
        users: true,
      },
    })

    if (!heist) return null

    const now = Date.now()
    const endTime = heist.started_at.getTime() + heist.time_limit_seconds * 1000
    const timeRemainingMs = Math.max(0, endTime - now)
    const is_active = timeRemainingMs > 0 && !heist.winner_user_id

    return {
      id: heist.heist_id,
      session_id: heist.session_id ?? 0,
      event_type: heist.event_type,
      difficulty: heist.difficulty,
      prompt: heist.prompt,
      correct_answer: heist.correct_answer,
      started_at: heist.started_at,
      time_limit_seconds: heist.time_limit_seconds,
      ended_at: heist.ended_at,
      is_active,
      timeRemainingMs,
      winner: heist.users
        ? {
            id: heist.users.id,
            username: heist.users.username,
            platform: heist.winner_platform || 'unknown',
            response_time_ms: heist.response_time_ms || 0,
            crate_tier: heist.crate_tier || '',
          }
        : undefined,
    }
  },

  /**
   * Get any active heist (across all sessions)
   */
  async getAnyActiveHeist(): Promise<HeistEventInfo | null> {
    const session = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
    })

    if (!session) return null
    return this.getActiveHeist(session.id)
  },

  /**
   * Get heist schedule for a session
   */
  async getHeistSchedule(session_id: number): Promise<HeistScheduleInfo | null> {
    const schedule = await prisma.heist_schedule.findFirst({
      where: { session_id },
      orderBy: { next_heist_at: 'desc' },
    })

    if (!schedule) return null

    return {
      session_id: schedule.session_id ?? 0,
      next_heist_at: schedule.next_heist_at,
      timeUntilMs: Math.max(0, schedule.next_heist_at.getTime() - Date.now()),
    }
  },

  /**
   * Schedule next heist for a session
   */
  async scheduleNextHeist(session_id: number, isFirstHeist: boolean = false): Promise<HeistScheduleInfo> {
    // Random delay between MIN and MAX minutes
    const delayMinutes = isFirstHeist
      ? HEIST_CONFIG.MIN_AFTER_SESSION_START
      : randInt(HEIST_CONFIG.MIN_DELAY_MINUTES, HEIST_CONFIG.MAX_DELAY_MINUTES)

    const next_heist_at = new Date(Date.now() + delayMinutes * 60 * 1000)

    // Clear any existing schedule for this session
    await prisma.heist_schedule.deleteMany({
      where: { session_id },
    })

    // Create new schedule
    await prisma.heist_schedule.create({
      data: {
        session_id,
        next_heist_at,
      },
    })

    return {
      session_id,
      next_heist_at,
      timeUntilMs: delayMinutes * 60 * 1000,
    }
  },

  /**
   * Clear heist schedule (on session end)
   */
  async clearSchedule(session_id: number): Promise<void> {
    await prisma.heist_schedule.deleteMany({
      where: { session_id },
    })
  },

  /**
   * Select event type by weighted distribution
   */
  selectEventType(): HeistEventType {
    const event_types = HEIST_CONFIG.EVENT_TYPES
    const roll = Math.random()

    let cumulative = 0
    for (const [type, config] of Object.entries(event_types)) {
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
  async getRecentEventIds(event_type: string, count: number = 10): Promise<number[]> {
    const recent = await prisma.heist_recent_events.findMany({
      where: { event_type },
      orderBy: { used_at: 'desc' },
      take: count,
    })

    return recent.map((r) => r.content_id)
  },

  /**
   * Record event usage for no-repeat logic
   */
  async recordEventUsage(event_type: string, content_id: number): Promise<void> {
    await prisma.heist_recent_events.create({
      data: {
        event_type,
        content_id,
      },
    })

    // Clean up old entries (keep last N per type)
    const old = await prisma.heist_recent_events.findMany({
      where: { event_type },
      orderBy: { used_at: 'desc' },
      skip: HEIST_CONFIG.RECENT_EVENTS_TRACK,
    })

    if (old.length > 0) {
      await prisma.heist_recent_events.deleteMany({
        where: {
          recent_id: { in: old.map((o) => o.recent_id) },
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
  async generateEventContent(event_type: HeistEventType): Promise<GeneratedEvent> {
    const config = HEIST_CONFIG.EVENT_TYPES[event_type]
    const recentIds = await this.getRecentEventIds(event_type)

    let prompt: string
    let answer: string
    let content_id: number

    switch (event_type) {
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
        content_id = selected.index
        break
      }

      case HEIST_EVENT_TYPES.CODE_CRACK: {
        const { code, patternIndex } = this.generateCode()
        prompt = `Crack the code: ${code}`
        answer = code
        content_id = patternIndex * 1000 + randInt(0, 999) // Unique per generation
        break
      }

      case HEIST_EVENT_TYPES.TRIVIA: {
        // Pull from trivia pool
        const triviaQuestions = await prisma.heist_trivia_pool.findMany({
          where: {
            trivia_id: { notIn: recentIds },
          },
          orderBy: { times_used: 'asc' },
          take: 10,
        })

        if (triviaQuestions.length === 0) {
          // Fallback: get any question
          const fallback = await prisma.heist_trivia_pool.findFirst({
            orderBy: { times_used: 'asc' },
          })
          if (fallback) {
            prompt = fallback.question
            answer = fallback.answer
            content_id = fallback.trivia_id
          } else {
            // No trivia in DB, use hardcoded fallback
            prompt = 'What tier do you need to reach to join a faction?'
            answer = 'Associate'
            content_id = 0
          }
        } else {
          const selected = triviaQuestions[randInt(0, triviaQuestions.length - 1)]
          prompt = selected.question
          answer = selected.answer
          content_id = selected.trivia_id

          // Update usage count
          await prisma.heist_trivia_pool.update({
            where: { trivia_id: selected.trivia_id },
            data: {
              times_used: { increment: 1 },
              last_used_at: new Date(),
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
        content_id = selected.index
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
        content_id = selected.index
        break
      }

      case HEIST_EVENT_TYPES.MATH_HACK: {
        const math = this.generateMathProblem()
        prompt = `Decrypt: ${math.expression} = ?`
        answer = math.answer.toString()
        content_id = randInt(0, 99999) // Random ID for math
        break
      }

      default:
        prompt = 'Quick! Type "!grab WIN" to claim!'
        answer = '!grab WIN'
        content_id = 0
    }

    return {
      type: event_type,
      difficulty: config.difficulty as HeistDifficulty,
      prompt,
      answer,
      content_id,
    }
  },

  /**
   * Trigger a heist event
   */
  async triggerHeist(session_id: number, event_type?: HeistEventType): Promise<TriggerHeistResult> {
    // Check session exists and is active
    const session = await prisma.streaming_sessions.findFirst({
      where: { id: session_id, is_active: true },
    })

    if (!session) {
      return { success: false, error: 'No active session found' }
    }

    // Check no active heist already
    const activeHeist = await this.getActiveHeist(session_id)
    if (activeHeist?.is_active) {
      return { success: false, error: 'A heist is already in progress' }
    }

    // Select event type if not specified
    const selectedType = event_type || this.selectEventType()

    // Generate event content
    const eventContent = await this.generateEventContent(selectedType)
    const config = HEIST_CONFIG.EVENT_TYPES[eventContent.type]

    // Create heist event
    const heist = await prisma.heist_events.create({
      data: {
        session_id,
        event_type: eventContent.type,
        difficulty: eventContent.difficulty,
        prompt: eventContent.prompt,
        correct_answer: eventContent.answer,
        started_at: new Date(),
        time_limit_seconds: config.time,
      },
    })

    // Record usage for no-repeat
    await this.recordEventUsage(eventContent.type, eventContent.content_id)

    // Schedule next heist
    await this.scheduleNextHeist(session_id)

    return {
      success: true,
      heist: {
        id: heist.heist_id,
        session_id: heist.session_id ?? 0,
        event_type: heist.event_type,
        difficulty: heist.difficulty,
        prompt: heist.prompt,
        correct_answer: heist.correct_answer,
        started_at: heist.started_at,
        time_limit_seconds: heist.time_limit_seconds,
        ended_at: null,
        is_active: true,
        timeRemainingMs: config.time * 1000,
      },
    }
  },

  /**
   * Check if an answer is correct for the active heist
   */
  checkAnswerFormat(event_type: string, userAnswer: string, correct_answer: string): boolean {
    switch (event_type) {
      case HEIST_EVENT_TYPES.QUICK_GRAB:
        return exactMatch(userAnswer, correct_answer)

      case HEIST_EVENT_TYPES.CODE_CRACK:
        // Case-sensitive for letters
        return userAnswer.trim() === correct_answer

      case HEIST_EVENT_TYPES.TRIVIA:
      case HEIST_EVENT_TYPES.WORD_SCRAMBLE:
      case HEIST_EVENT_TYPES.RIDDLE:
        return fuzzyMatch(userAnswer, correct_answer)

      case HEIST_EVENT_TYPES.MATH_HACK:
        return numericMatch(userAnswer, correct_answer)

      default:
        return exactMatch(userAnswer, correct_answer)
    }
  },

  /**
   * Submit an answer for an active heist
   */
  async submitAnswer(
    user_id: number,
    answer: string,
    platform: string
  ): Promise<AnswerCheckResult> {
    // Find active session
    const session = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
    })

    if (!session) {
      return { success: false, correct: false, error: 'No active session' }
    }

    // Find active heist
    const heist = await prisma.heist_events.findFirst({
      where: {
        session_id: session.id,
        ended_at: null,
      },
    })

    if (!heist) {
      return { success: false, correct: false, error: 'No active heist' }
    }

    // Check if already won
    if (heist.winner_user_id) {
      return { success: true, correct: false, alreadyWon: true }
    }

    // Check if expired
    const endTime = heist.started_at.getTime() + heist.time_limit_seconds * 1000
    if (Date.now() > endTime) {
      return { success: true, correct: false, expired: true }
    }

    // Check answer
    const isCorrect = this.checkAnswerFormat(heist.event_type, answer, heist.correct_answer)

    if (!isCorrect) {
      return { success: true, correct: false }
    }

    // Winner! Roll crate tier
    const crate_tier = this.rollCrateTier(heist.difficulty as HeistDifficulty)
    const response_time_ms = Date.now() - heist.started_at.getTime()

    // Update heist with winner
    await prisma.heist_events.update({
      where: { heist_id: heist.heist_id },
      data: {
        winner_user_id: user_id,
        winner_platform: platform,
        winning_answer: answer,
        response_time_ms,
        crate_tier,
        ended_at: new Date(),
      },
    })

    // Award crate to winner
    await CrateService.awardCrate(user_id, crate_tier as CrateTier, 'heist' as any)

    // Notify winner
    await NotificationService.notifyHeistWon(user_id, crate_tier, response_time_ms)

    // Get winner username for Discord (hard difficulty only)
    if (heist.difficulty === 'hard') {
      const winner = await prisma.users.findUnique({
        where: { id: user_id },
        select: { username: true, kingpin_name: true },
      })
      if (winner) {
        await DiscordService.postHeistWinner(
          winner.kingpin_name || winner.username,
          heist.event_type,
          heist.difficulty,
          crate_tier,
          response_time_ms
        )
      }
    }

    return {
      success: true,
      correct: true,
      winner: true,
      crate_tier,
      response_time_ms,
    }
  },

  /**
   * Expire a heist (time ran out)
   */
  async expireHeist(heist_id: number): Promise<void> {
    await prisma.heist_events.update({
      where: { heist_id },
      data: { ended_at: new Date() },
    })
  },

  /**
   * Check and expire any overdue heists
   */
  async checkExpiredHeists(): Promise<number> {
    const now = new Date()

    // Find heists that should have expired
    const expiredHeists = await prisma.heist_events.findMany({
      where: {
        ended_at: null,
        winner_user_id: null,
      },
    })

    let expiredCount = 0

    for (const heist of expiredHeists) {
      const endTime = heist.started_at.getTime() + heist.time_limit_seconds * 1000
      if (now.getTime() > endTime) {
        await this.expireHeist(heist.heist_id)
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
  async getHeistHistory(session_id?: number, limit: number = 20): Promise<HeistHistoryItem[]> {
    const where = session_id ? { session_id } : {}

    const heists = await prisma.heist_events.findMany({
      where,
      include: {
        users: true,
      },
      orderBy: { started_at: 'desc' },
      take: limit,
    })

    return heists.map((h) => ({
      id: h.heist_id,
      event_type: h.event_type,
      difficulty: h.difficulty,
      prompt: h.prompt,
      correct_answer: h.correct_answer,
      started_at: h.started_at,
      ended_at: h.ended_at,
      winner: h.users
        ? {
            id: h.users.id,
            username: h.users.username,
            platform: h.winner_platform || 'unknown',
            response_time_ms: h.response_time_ms || 0,
          }
        : undefined,
      crate_tier: h.crate_tier,
    }))
  },

  /**
   * Get heist stats for a user
   */
  async getUserHeistStats(user_id: number): Promise<{
    totalWins: number
    avgResponseTimeMs: number
    cratesByTier: Record<string, number>
    fastestWinMs: number | null
  }> {
    const wins = await prisma.heist_events.findMany({
      where: { winner_user_id: user_id },
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
      if (win.crate_tier) {
        cratesByTier[win.crate_tier] = (cratesByTier[win.crate_tier] || 0) + 1
      }
      if (win.response_time_ms) {
        totalResponseTime += win.response_time_ms
        if (fastestWinMs === null || win.response_time_ms < fastestWinMs) {
          fastestWinMs = win.response_time_ms
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
  async checkAndTriggerScheduledHeist(session_id: number): Promise<TriggerHeistResult | null> {
    const schedule = await this.getHeistSchedule(session_id)

    if (!schedule) {
      // No schedule, create one
      await this.scheduleNextHeist(session_id, true)
      return null
    }

    if (schedule.timeUntilMs > 0) {
      // Not time yet
      return null
    }

    // Time to trigger!
    return this.triggerHeist(session_id)
  },

  /**
   * Get heist leaderboard (most wins)
   */
  async getHeistLeaderboard(limit: number = 10): Promise<
    Array<{
      user_id: number
      username: string
      wins: number
      avgResponseTimeMs: number
    }>
  > {
    const results = await prisma.heist_events.groupBy({
      by: ['winner_user_id'],
      where: {
        winner_user_id: { not: null },
      },
      _count: { heist_id: true },
      _avg: { response_time_ms: true },
      orderBy: { _count: { heist_id: 'desc' } },
      take: limit,
    })

    // Get usernames
    const user_ids = results.map((r) => r.winner_user_id).filter((id): id is number => id !== null)
    const users = await prisma.users.findMany({
      where: { id: { in: user_ids } },
      select: { id: true, username: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u.username]))

    return results
      .filter((r) => r.winner_user_id !== null)
      .map((r) => ({
        user_id: r.winner_user_id!,
        username: userMap.get(r.winner_user_id!) || 'Unknown',
        wins: r._count?.heist_id ?? 0,
        avgResponseTimeMs: Math.round(r._avg?.response_time_ms || 0),
      }))
  },
}

export default HeistService
