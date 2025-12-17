// =============================================================================
// LUMIA STREAM SERVICE
// Triggers overlay animations and audio for stream production
// Also handles Stream Action commands (lights, fog, TTS, sounds)
// =============================================================================

export interface LumiaEventPayload {
  event: string
  data: Record<string, unknown>
}

export interface LumiaHealthStatus {
  online: boolean
  latency?: number
  lastChecked: Date
  error?: string
}

export interface LumiaStreamActionPayload {
  command: string
  category: string
  payload: {
    text?: string
    color?: string
    duration?: number
  }
}

export interface LumiaCommandResult {
  success: boolean
  error?: string
  queuePosition?: number
}

// Cache health status for 30 seconds
let cachedHealthStatus: LumiaHealthStatus | null = null
let lastHealthCheck: number = 0
const HEALTH_CACHE_MS = 30000

export interface LumiaContributor {
  name: string
  totalUsd: number
}

// =============================================================================
// LUMIA SERVICE
// =============================================================================

export const LumiaService = {
  /**
   * Get webhook URL by event type
   */
  getWebhookUrl(event_type: string): string | null {
    const webhookMap: Record<string, string | undefined> = {
      session_start: process.env.LUMIA_WEBHOOK_SESSION_START,
      session_end: process.env.LUMIA_WEBHOOK_SESSION_END,
      crown_change: process.env.LUMIA_WEBHOOK_CROWN_CHANGE,
      leaderboard: process.env.LUMIA_WEBHOOK_LEADERBOARD,
    }

    return webhookMap[event_type] ?? null
  },

  /**
   * Send a webhook to Lumia Stream
   */
  async sendWebhook(event_type: string, payload: LumiaEventPayload): Promise<boolean> {
    const webhookUrl = this.getWebhookUrl(event_type)

    if (!webhookUrl) {
      console.warn(`LUMIA_WEBHOOK_${event_type.toUpperCase()} not configured`)
      return false
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error(`Lumia webhook failed: ${response.status} ${response.statusText}`)
        return false
      }

      return true
    } catch (error) {
      console.error('Lumia webhook error:', error)
      return false
    }
  },

  // =============================================================================
  // EVENT TRIGGERS
  // =============================================================================

  /**
   * Trigger session start alert
   */
  async triggerSessionStart(
    session_id: number,
    platform: string,
    title?: string
  ): Promise<boolean> {
    return this.sendWebhook('session_start', {
      event: 'session_start',
      data: {
        session_id: session_id,
        platform,
        title: title ?? 'Kingpin Session Started',
        timestamp: new Date().toISOString(),
      },
    })
  },

  /**
   * Trigger session end alert with stats
   */
  async triggerSessionEnd(
    session_id: number,
    stats: {
      total_contributions_usd: number
      totalContributors: number
      winnerName?: string
      winnerContributionUsd?: number
      durationMinutes: number
    }
  ): Promise<boolean> {
    return this.sendWebhook('session_end', {
      event: 'session_end',
      data: {
        session_id: session_id,
        total_usd: stats.total_contributions_usd,
        total_contributors: stats.totalContributors,
        winner: stats.winnerName ?? null,
        winner_usd: stats.winnerContributionUsd ?? 0,
        duration_minutes: stats.durationMinutes,
        timestamp: new Date().toISOString(),
      },
    })
  },

  /**
   * Trigger crown change alert (high priority - real-time competition)
   */
  async triggerCrownChange(
    newHolderName: string,
    previousHolderName: string | null,
    totalUsd: number
  ): Promise<boolean> {
    return this.sendWebhook('crown_change', {
      event: 'crown_change',
      data: {
        new_juicernaut: newHolderName,
        old_juicernaut: previousHolderName,
        total_usd: totalUsd,
        timestamp: new Date().toISOString(),
      },
    })
  },

  /**
   * Trigger periodic leaderboard update (every 30 minutes)
   */
  async triggerLeaderboardUpdate(
    session_id: number,
    top3: LumiaContributor[],
    totalContributions: number
  ): Promise<boolean> {
    return this.sendWebhook('leaderboard', {
      event: 'leaderboard_update',
      data: {
        session_id: session_id,
        top_contributors: top3.map((c, index) => ({
          rank: index + 1,
          name: c.name,
          total_usd: c.totalUsd,
        })),
        total_contributions_usd: totalContributions,
        timestamp: new Date().toISOString(),
      },
    })
  },

  // =============================================================================
  // STREAM ACTION HEALTH CHECK
  // =============================================================================

  /**
   * Check if Lumia Stream is online and responsive
   * Returns cached result if checked within last 30 seconds
   */
  async checkStreamActionHealth(forceRefresh = false): Promise<LumiaHealthStatus> {
    const now = Date.now()

    // Return cached result if still valid
    if (!forceRefresh && cachedHealthStatus && (now - lastHealthCheck) < HEALTH_CACHE_MS) {
      return cachedHealthStatus
    }

    const healthUrl = process.env.LUMIA_HEALTH_URL

    // If no health URL configured, assume online (for development)
    if (!healthUrl) {
      cachedHealthStatus = {
        online: true,
        lastChecked: new Date(),
      }
      lastHealthCheck = now
      return cachedHealthStatus
    }

    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const latency = Date.now() - start
      cachedHealthStatus = {
        online: response.ok,
        latency,
        lastChecked: new Date(),
        error: response.ok ? undefined : `HTTP ${response.status}`,
      }
    } catch (error) {
      cachedHealthStatus = {
        online: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }

    lastHealthCheck = now
    return cachedHealthStatus
  },

  /**
   * Quick check if Lumia Stream Actions are online (uses cache)
   */
  async isStreamActionOnline(): Promise<boolean> {
    const status = await this.checkStreamActionHealth()
    return status.online
  },

  // =============================================================================
  // STREAM ACTION COMMANDS
  // =============================================================================

  /**
   * Send a stream action command to Lumia
   */
  async sendStreamActionCommand(payload: LumiaStreamActionPayload): Promise<LumiaCommandResult> {
    const webhookUrl = process.env.LUMIA_WEBHOOK_STREAM_ACTION

    if (!webhookUrl) {
      console.warn('LUMIA_WEBHOOK_STREAM_ACTION not configured')
      // Return success in dev mode to not block actions
      return { success: true }
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.LUMIA_API_TOKEN && {
            Authorization: `Bearer ${process.env.LUMIA_API_TOKEN}`,
          }),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return {
          success: false,
          error: `Lumia responded with ${response.status}: ${errorText}`,
        }
      }

      // Parse response for queue position if available
      try {
        const data = await response.json()
        return {
          success: true,
          queuePosition: data.queuePosition,
        }
      } catch {
        return { success: true }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  },

  /**
   * Send a TTS command
   */
  async sendTTS(command: string, text: string): Promise<LumiaCommandResult> {
    return this.sendStreamActionCommand({
      command,
      category: 'tts',
      payload: { text },
    })
  },

  /**
   * Send a lights command
   */
  async sendLights(command: string, color?: string, duration?: number): Promise<LumiaCommandResult> {
    return this.sendStreamActionCommand({
      command,
      category: 'lights',
      payload: { color, duration },
    })
  },

  /**
   * Send a fog command
   */
  async sendFog(command: string, duration?: number): Promise<LumiaCommandResult> {
    return this.sendStreamActionCommand({
      command,
      category: 'fog',
      payload: { duration },
    })
  },

  /**
   * Send a sound alert command
   */
  async sendSound(command: string): Promise<LumiaCommandResult> {
    return this.sendStreamActionCommand({
      command,
      category: 'sound',
      payload: {},
    })
  },

  /**
   * Clear the health check cache (for testing or manual refresh)
   */
  clearHealthCache(): void {
    cachedHealthStatus = null
    lastHealthCheck = 0
  },

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Check if Lumia integration is configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.LUMIA_WEBHOOK_SESSION_START ||
      process.env.LUMIA_WEBHOOK_SESSION_END ||
      process.env.LUMIA_WEBHOOK_CROWN_CHANGE ||
      process.env.LUMIA_WEBHOOK_LEADERBOARD
    )
  },

  /**
   * Get configured webhook events
   */
  getConfiguredEvents(): string[] {
    const events: string[] = []

    if (process.env.LUMIA_WEBHOOK_SESSION_START) events.push('session_start')
    if (process.env.LUMIA_WEBHOOK_SESSION_END) events.push('session_end')
    if (process.env.LUMIA_WEBHOOK_CROWN_CHANGE) events.push('crown_change')
    if (process.env.LUMIA_WEBHOOK_LEADERBOARD) events.push('leaderboard')

    return events
  },
}

export default LumiaService
