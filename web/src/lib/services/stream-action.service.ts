import { prisma } from '../db'
import { Prisma } from '@prisma/client'
import { TTSSanitizer, type SanitizeResult } from './tts-sanitizer'
import { LumiaService } from './lumia.service'

// =============================================================================
// STREAM ACTION SERVICE TYPES
// =============================================================================

export interface StreamActionType {
  id: string
  name: string
  description: string | null
  category: string
  cost: number
  cooldownSeconds: number
  limitPerStream: number | null
  queueBehavior: 'overwrite' | 'queue'
  maxCharacters: number | null
  sortOrder: number
}

export interface ActionAvailability {
  available: boolean
  reason?: 'cooldown' | 'limit_reached' | 'stream_offline' | 'lumia_offline' | 'insufficient_funds' | 'invalid_payload'
  cooldownRemaining?: number // seconds
  usedThisStream?: number
  limitPerStream?: number | null
}

export interface TriggerPayload {
  text?: string // For TTS actions
  color?: string // For color change actions
}

export interface TriggerResult {
  success: boolean
  reason?: string
  usageId?: number
  queuePosition?: number // For queued audio actions
  sanitizeResult?: SanitizeResult // For TTS validation feedback
}

export interface StreamActionUsageInfo {
  id: number
  actionId: string
  actionName: string
  cost: number
  payload: TriggerPayload | null
  status: string
  triggeredAt: Date
  completedAt: Date | null
}

// =============================================================================
// STREAM ACTION SERVICE
// =============================================================================

export const StreamActionService = {
  // ===========================================================================
  // CATALOG & AVAILABILITY
  // ===========================================================================

  /**
   * Get all active stream actions (catalog)
   */
  async getAvailableActions(): Promise<StreamActionType[]> {
    const actions = await prisma.stream_action_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    })

    return actions.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      cost: a.cost,
      cooldownSeconds: a.cooldown_seconds,
      limitPerStream: a.limit_per_stream,
      queueBehavior: a.queue_behavior as 'overwrite' | 'queue',
      maxCharacters: a.max_characters,
      sortOrder: a.sort_order ?? 0,
    }))
  },

  /**
   * Get a single action by ID
   */
  async getAction(actionId: string): Promise<StreamActionType | null> {
    const action = await prisma.stream_action_types.findUnique({
      where: { id: actionId },
    })

    if (!action) return null

    return {
      id: action.id,
      name: action.name,
      description: action.description,
      category: action.category,
      cost: action.cost,
      cooldownSeconds: action.cooldown_seconds,
      limitPerStream: action.limit_per_stream,
      queueBehavior: action.queue_behavior as 'overwrite' | 'queue',
      maxCharacters: action.max_characters,
      sortOrder: action.sort_order ?? 0,
    }
  },

  /**
   * Check if stream is currently live
   */
  async isStreamLive(): Promise<boolean> {
    const activeSession = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
      select: { id: true },
    })

    return !!activeSession
  },

  /**
   * Get current active streaming session
   */
  async getCurrentSession(): Promise<{ id: number; platform: string } | null> {
    const session = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
      select: { id: true, platform: true },
    })

    return session
  },

  /**
   * Check cooldown status for an action
   */
  async getCooldownStatus(actionId: string): Promise<{ onCooldown: boolean; remainingSeconds: number }> {
    const cooldown = await prisma.stream_action_cooldowns.findUnique({
      where: { action_id: actionId },
    })

    if (!cooldown) {
      return { onCooldown: false, remainingSeconds: 0 }
    }

    const now = new Date()
    if (cooldown.expires_at <= now) {
      // Cooldown expired - clean it up
      await prisma.stream_action_cooldowns.delete({
        where: { action_id: actionId },
      })
      return { onCooldown: false, remainingSeconds: 0 }
    }

    const remainingMs = cooldown.expires_at.getTime() - now.getTime()
    return {
      onCooldown: true,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    }
  },

  /**
   * Get usage count for an action in the current stream
   */
  async getUsageThisStream(actionId: string, sessionId: number): Promise<number> {
    const count = await prisma.stream_action_usage.count({
      where: {
        action_id: actionId,
        session_id: sessionId,
        status: { in: ['completed', 'processing', 'pending'] },
      },
    })

    return count
  },

  /**
   * Check if action can be triggered (cooldowns, limits, stream status, Lumia health)
   */
  async canTrigger(
    actionId: string,
    userId: number,
    payload?: TriggerPayload
  ): Promise<ActionAvailability> {
    // Get action details
    const action = await this.getAction(actionId)
    if (!action) {
      return { available: false, reason: 'invalid_payload' }
    }

    // Check if stream is live
    const session = await this.getCurrentSession()
    if (!session) {
      return { available: false, reason: 'stream_offline' }
    }

    // Check Lumia health
    const lumiaOnline = await LumiaService.isStreamActionOnline()
    if (!lumiaOnline) {
      return { available: false, reason: 'lumia_offline' }
    }

    // Check cooldown
    const cooldownStatus = await this.getCooldownStatus(actionId)
    if (cooldownStatus.onCooldown) {
      return {
        available: false,
        reason: 'cooldown',
        cooldownRemaining: cooldownStatus.remainingSeconds,
      }
    }

    // Check per-stream limit
    if (action.limitPerStream !== null) {
      const usedThisStream = await this.getUsageThisStream(actionId, session.id)
      if (usedThisStream >= action.limitPerStream) {
        return {
          available: false,
          reason: 'limit_reached',
          usedThisStream,
          limitPerStream: action.limitPerStream,
        }
      }
    }

    // Check user's wealth
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { wealth: true },
    })

    if (!user || (user.wealth ?? BigInt(0)) < BigInt(action.cost)) {
      return { available: false, reason: 'insufficient_funds' }
    }

    // Validate TTS payload if applicable
    if (action.category === 'tts' && action.maxCharacters) {
      if (!payload?.text) {
        return { available: false, reason: 'invalid_payload' }
      }
      const sanitizeResult = TTSSanitizer.sanitize(payload.text, action.maxCharacters)
      if (!sanitizeResult.valid) {
        return { available: false, reason: 'invalid_payload' }
      }
    }

    // All checks passed
    const usedThisStream = action.limitPerStream !== null
      ? await this.getUsageThisStream(actionId, session.id)
      : undefined

    return {
      available: true,
      usedThisStream,
      limitPerStream: action.limitPerStream,
    }
  },

  // ===========================================================================
  // ACTION TRIGGERING
  // ===========================================================================

  /**
   * Trigger a stream action
   */
  async trigger(
    userId: number,
    actionId: string,
    payload?: TriggerPayload
  ): Promise<TriggerResult> {
    // Get action details
    const action = await this.getAction(actionId)
    if (!action) {
      return { success: false, reason: 'Action not found' }
    }

    // Validate availability
    const availability = await this.canTrigger(actionId, userId, payload)
    if (!availability.available) {
      let reason = 'Cannot trigger action'
      switch (availability.reason) {
        case 'stream_offline':
          reason = 'Stream is not live'
          break
        case 'cooldown':
          reason = `Action on cooldown (${availability.cooldownRemaining}s remaining)`
          break
        case 'limit_reached':
          reason = `Limit reached (${availability.usedThisStream}/${availability.limitPerStream} this stream)`
          break
        case 'insufficient_funds':
          reason = 'Insufficient wealth'
          break
        case 'invalid_payload':
          reason = 'Invalid or missing payload'
          break
      }
      return { success: false, reason }
    }

    // Sanitize TTS text if applicable
    let sanitizedPayload = payload
    let sanitizeResult: SanitizeResult | undefined
    if (action.category === 'tts' && action.maxCharacters && payload?.text) {
      sanitizeResult = TTSSanitizer.sanitize(payload.text, action.maxCharacters)
      if (!sanitizeResult.valid) {
        return {
          success: false,
          reason: sanitizeResult.rejectionReason ?? 'Invalid TTS text',
          sanitizeResult,
        }
      }
      sanitizedPayload = { ...payload, text: sanitizeResult.sanitized }
    }

    // Get current session
    const session = await this.getCurrentSession()
    if (!session) {
      return { success: false, reason: 'Stream is not live' }
    }

    // Execute in transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Deduct wealth
        await tx.users.update({
          where: { id: userId },
          data: {
            wealth: { decrement: action.cost },
          },
        })

        // 2. Handle overwrite logic for visual actions (lights/fog)
        // New visual actions cancel any pending visual actions for this session
        if (action.queueBehavior === 'overwrite') {
          await tx.stream_action_usage.updateMany({
            where: {
              session_id: session.id,
              status: { in: ['pending', 'processing'] },
              stream_action_types: { queue_behavior: 'overwrite' },
            },
            data: {
              status: 'overwritten',
              completed_at: new Date(),
            },
          })
        }

        // 3. Create usage record
        const usage = await tx.stream_action_usage.create({
          data: {
            user_id: userId,
            session_id: session.id,
            action_id: actionId,
            cost: action.cost,
            payload: sanitizedPayload as Prisma.InputJsonValue | undefined,
            status: 'pending',
          },
        })

        // 4. Set cooldown
        await tx.stream_action_cooldowns.upsert({
          where: { action_id: actionId },
          update: {
            expires_at: new Date(Date.now() + action.cooldownSeconds * 1000),
          },
          create: {
            action_id: actionId,
            expires_at: new Date(Date.now() + action.cooldownSeconds * 1000),
          },
        })

        return usage
      })

      // 5. Handle differently based on queue behavior
      let queuePosition: number | undefined

      if (action.queueBehavior === 'queue') {
        // Audio actions go to queue - processed by worker
        // Get queue position for user feedback
        const pendingCount = await prisma.stream_action_usage.count({
          where: {
            session_id: session.id,
            status: { in: ['pending', 'processing'] },
            stream_action_types: { queue_behavior: 'queue' },
          },
        })
        queuePosition = pendingCount
      } else {
        // Visual actions execute immediately via Lumia
        await prisma.stream_action_usage.update({
          where: { id: result.id },
          data: { status: 'processing' },
        })

        const lumiaResult = await this.triggerLumiaCommand(actionId, sanitizedPayload)

        if (lumiaResult.success) {
          await prisma.stream_action_usage.update({
            where: { id: result.id },
            data: { status: 'completed', completed_at: new Date() },
          })
        } else {
          // Mark as failed and refund
          await this.handleFailedAction(result.id, lumiaResult.error ?? 'Lumia command failed')
        }
      }

      return {
        success: true,
        usageId: result.id,
        queuePosition,
        sanitizeResult,
      }
    } catch (error) {
      console.error('Stream action trigger error:', error)
      return { success: false, reason: 'Failed to process action' }
    }
  },

  /**
   * Trigger Lumia Stream command via LumiaService
   */
  async triggerLumiaCommand(
    actionId: string,
    payload?: TriggerPayload
  ): Promise<{ success: boolean; error?: string }> {
    const action = await prisma.stream_action_types.findUnique({
      where: { id: actionId },
      select: { lumia_command_id: true, category: true },
    })

    if (!action?.lumia_command_id) {
      console.warn(`No Lumia command configured for action: ${actionId}`)
      return { success: false, error: 'No Lumia command configured' }
    }

    // Use LumiaService for the actual command
    const result = await LumiaService.sendStreamActionCommand({
      command: action.lumia_command_id,
      category: action.category,
      payload: {
        text: payload?.text,
        color: payload?.color,
      },
    })

    return result
  },

  /**
   * Handle failed action: mark as failed and refund user's wealth
   */
  async handleFailedAction(usageId: number, errorMessage: string): Promise<void> {
    const usage = await prisma.stream_action_usage.findUnique({
      where: { id: usageId },
      select: { user_id: true, cost: true, status: true },
    })

    if (!usage) {
      console.error(`Usage record not found: ${usageId}`)
      return
    }

    // Only refund if not already completed or refunded
    if (usage.status === 'completed' || usage.status === 'refunded') {
      return
    }

    await prisma.$transaction([
      // Mark as failed
      prisma.stream_action_usage.update({
        where: { id: usageId },
        data: {
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date(),
        },
      }),
      // Refund wealth
      prisma.users.update({
        where: { id: usage.user_id },
        data: { wealth: { increment: usage.cost } },
      }),
    ])

    console.log(`Refunded ${usage.cost} wealth to user ${usage.user_id} for failed action ${usageId}`)
  },

  // ===========================================================================
  // HISTORY & ANALYTICS
  // ===========================================================================

  /**
   * Get user's action history for current stream
   */
  async getUserHistory(
    userId: number,
    sessionId?: number,
    limit = 20
  ): Promise<StreamActionUsageInfo[]> {
    const whereClause: { user_id: number; session_id?: number } = { user_id: userId }

    // If no session specified, get current active session
    if (!sessionId) {
      const session = await this.getCurrentSession()
      if (session) {
        whereClause.session_id = session.id
      }
    } else {
      whereClause.session_id = sessionId
    }

    const usage = await prisma.stream_action_usage.findMany({
      where: whereClause,
      include: {
        stream_action_types: {
          select: { name: true },
        },
      },
      orderBy: { triggered_at: 'desc' },
      take: limit,
    })

    return usage.map((u) => ({
      id: u.id,
      actionId: u.action_id,
      actionName: u.stream_action_types.name,
      cost: u.cost,
      payload: u.payload as TriggerPayload | null,
      status: u.status,
      triggeredAt: u.triggered_at,
      completedAt: u.completed_at,
    }))
  },

  /**
   * Get all action availability status for display
   */
  async getAllActionStatus(userId: number): Promise<Record<string, ActionAvailability>> {
    const actions = await this.getAvailableActions()
    const status: Record<string, ActionAvailability> = {}

    for (const action of actions) {
      status[action.id] = await this.canTrigger(action.id, userId)
    }

    return status
  },

  // ===========================================================================
  // ADMIN & MAINTENANCE
  // ===========================================================================

  /**
   * Clean up expired cooldowns
   */
  async cleanupExpiredCooldowns(): Promise<number> {
    const result = await prisma.stream_action_cooldowns.deleteMany({
      where: {
        expires_at: { lte: new Date() },
      },
    })

    return result.count
  },

  /**
   * Get action analytics for a stream session
   */
  async getSessionAnalytics(sessionId: number): Promise<{
    totalActions: number
    totalRevenue: number
    actionBreakdown: Array<{ actionId: string; name: string; count: number; revenue: number }>
  }> {
    const usage = await prisma.stream_action_usage.groupBy({
      by: ['action_id'],
      where: {
        session_id: sessionId,
        status: 'completed',
      },
      _count: { id: true },
      _sum: { cost: true },
    })

    const actions = await prisma.stream_action_types.findMany({
      where: { id: { in: usage.map((u) => u.action_id) } },
      select: { id: true, name: true },
    })

    const actionMap = new Map(actions.map((a) => [a.id, a.name]))

    const breakdown = usage.map((u) => ({
      actionId: u.action_id,
      name: actionMap.get(u.action_id) ?? u.action_id,
      count: u._count.id,
      revenue: u._sum.cost ?? 0,
    }))

    return {
      totalActions: breakdown.reduce((sum, b) => sum + b.count, 0),
      totalRevenue: breakdown.reduce((sum, b) => sum + b.revenue, 0),
      actionBreakdown: breakdown,
    }
  },

  // ===========================================================================
  // AUDIO QUEUE PROCESSING
  // ===========================================================================

  /**
   * Check if there's currently an audio action being processed
   */
  async isAudioProcessing(): Promise<boolean> {
    const processing = await prisma.stream_action_usage.findFirst({
      where: {
        status: 'processing',
        stream_action_types: { queue_behavior: 'queue' },
      },
    })

    return !!processing
  },

  /**
   * Get next pending audio action from the queue
   */
  async getNextAudioInQueue(): Promise<{
    id: number
    actionId: string
    payload: TriggerPayload | null
    userId: number
    cost: number
  } | null> {
    const session = await this.getCurrentSession()
    if (!session) return null

    const nextAction = await prisma.stream_action_usage.findFirst({
      where: {
        session_id: session.id,
        status: 'pending',
        stream_action_types: { queue_behavior: 'queue' },
      },
      orderBy: { triggered_at: 'asc' },
      include: {
        stream_action_types: {
          select: { lumia_command_id: true },
        },
      },
    })

    if (!nextAction) return null

    return {
      id: nextAction.id,
      actionId: nextAction.action_id,
      payload: nextAction.payload as TriggerPayload | null,
      userId: nextAction.user_id,
      cost: nextAction.cost,
    }
  },

  /**
   * Get audio queue length
   */
  async getAudioQueueLength(): Promise<number> {
    const session = await this.getCurrentSession()
    if (!session) return 0

    return prisma.stream_action_usage.count({
      where: {
        session_id: session.id,
        status: { in: ['pending', 'processing'] },
        stream_action_types: { queue_behavior: 'queue' },
      },
    })
  },

  /**
   * Process the next audio action in the queue
   * Call this from a cron job or worker process
   * Returns true if an action was processed, false if queue is empty or busy
   */
  async processAudioQueue(): Promise<{
    processed: boolean
    usageId?: number
    success?: boolean
    error?: string
  }> {
    // Check if already processing something
    if (await this.isAudioProcessing()) {
      return { processed: false, error: 'Audio already processing' }
    }

    // Get next action
    const nextAction = await this.getNextAudioInQueue()
    if (!nextAction) {
      return { processed: false, error: 'Queue empty' }
    }

    // Mark as processing
    await prisma.stream_action_usage.update({
      where: { id: nextAction.id },
      data: { status: 'processing' },
    })

    // Send to Lumia
    const result = await this.triggerLumiaCommand(nextAction.actionId, nextAction.payload ?? undefined)

    if (result.success) {
      // Mark as completed
      await prisma.stream_action_usage.update({
        where: { id: nextAction.id },
        data: { status: 'completed', completed_at: new Date() },
      })

      return { processed: true, usageId: nextAction.id, success: true }
    } else {
      // Mark as failed and refund
      await this.handleFailedAction(nextAction.id, result.error ?? 'Unknown Lumia error')

      return { processed: true, usageId: nextAction.id, success: false, error: result.error }
    }
  },

  /**
   * Cancel all pending audio actions for a session (e.g., when stream ends)
   * Refunds wealth for all cancelled actions
   */
  async cancelPendingAudioQueue(sessionId: number): Promise<number> {
    const pending = await prisma.stream_action_usage.findMany({
      where: {
        session_id: sessionId,
        status: 'pending',
        stream_action_types: { queue_behavior: 'queue' },
      },
      select: { id: true, user_id: true, cost: true },
    })

    if (pending.length === 0) return 0

    // Refund all and mark as cancelled
    await prisma.$transaction([
      // Update all to cancelled
      prisma.stream_action_usage.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: { status: 'cancelled', error_message: 'Stream ended', completed_at: new Date() },
      }),
      // Refund each user (group by user for efficiency)
      ...Array.from(
        pending.reduce((acc, p) => {
          acc.set(p.user_id, (acc.get(p.user_id) ?? 0) + p.cost)
          return acc
        }, new Map<number, number>())
      ).map(([userId, totalRefund]) =>
        prisma.users.update({
          where: { id: userId },
          data: { wealth: { increment: totalRefund } },
        })
      ),
    ])

    return pending.length
  },

  /**
   * Get queue status for display
   */
  async getQueueStatus(): Promise<{
    queueLength: number
    isProcessing: boolean
    currentlyProcessing: StreamActionUsageInfo | null
    nextInQueue: StreamActionUsageInfo | null
  }> {
    const [queueLength, isProcessing] = await Promise.all([
      this.getAudioQueueLength(),
      this.isAudioProcessing(),
    ])

    let currentlyProcessing: StreamActionUsageInfo | null = null
    let nextInQueue: StreamActionUsageInfo | null = null

    if (isProcessing) {
      const processing = await prisma.stream_action_usage.findFirst({
        where: {
          status: 'processing',
          stream_action_types: { queue_behavior: 'queue' },
        },
        include: { stream_action_types: { select: { name: true } } },
      })
      if (processing) {
        currentlyProcessing = {
          id: processing.id,
          actionId: processing.action_id,
          actionName: processing.stream_action_types.name,
          cost: processing.cost,
          payload: processing.payload as TriggerPayload | null,
          status: processing.status,
          triggeredAt: processing.triggered_at,
          completedAt: processing.completed_at,
        }
      }
    }

    const next = await this.getNextAudioInQueue()
    if (next) {
      const nextDetails = await prisma.stream_action_usage.findUnique({
        where: { id: next.id },
        include: { stream_action_types: { select: { name: true } } },
      })
      if (nextDetails) {
        nextInQueue = {
          id: nextDetails.id,
          actionId: nextDetails.action_id,
          actionName: nextDetails.stream_action_types.name,
          cost: nextDetails.cost,
          payload: nextDetails.payload as TriggerPayload | null,
          status: nextDetails.status,
          triggeredAt: nextDetails.triggered_at,
          completedAt: nextDetails.completed_at,
        }
      }
    }

    return {
      queueLength,
      isProcessing,
      currentlyProcessing,
      nextInQueue,
    }
  },
}

export default StreamActionService
