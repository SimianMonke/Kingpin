import { prisma } from '../db'

// =============================================================================
// ECONOMY MODE SERVICE
// =============================================================================
// Determines whether economy actions (play, rob, bail, reroll) are free
// based on stream status:
// - LIVE (active session): Requires channel points via chat/bot
// - OFFLINE (no session): Free via webapp and Discord

export interface EconomyModeStatus {
  isLive: boolean
  canExecuteFree: boolean
  activeSessionId: number | null
  platform: string | null
}

export const ECONOMY_MODE_ERROR = {
  code: 'STREAM_LIVE_CHANNEL_POINTS_REQUIRED',
  message: 'Stream is live! Use channel points in chat to play.',
} as const

export const EconomyModeService = {
  /**
   * Check if economy actions can be executed for free (offline mode)
   * Returns true if NO active streaming session exists
   * Returns false if a streaming session is currently active
   */
  async canExecuteFree(): Promise<boolean> {
    const activeSession = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
      select: { id: true },
    })

    return !activeSession
  },

  /**
   * Get full economy mode status with session details
   */
  async getStatus(): Promise<EconomyModeStatus> {
    const activeSession = await prisma.streaming_sessions.findFirst({
      where: { is_active: true },
      select: { id: true, platform: true },
    })

    return {
      isLive: !!activeSession,
      canExecuteFree: !activeSession,
      activeSessionId: activeSession?.id ?? null,
      platform: activeSession?.platform ?? null,
    }
  },

  /**
   * Helper to check if a request is from the bot (bypass economy mode check)
   * Bot requests already come from channel point redemptions
   */
  isBotRequest(apiKey: string | null, botKey: string | undefined): boolean {
    return !!(apiKey && botKey && apiKey === botKey)
  },
}

export default EconomyModeService
