// =============================================================================
// LUMIA STREAM SERVICE
// Triggers overlay animations and audio for stream production
// =============================================================================

export interface LumiaEventPayload {
  event: string
  data: Record<string, unknown>
}

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
