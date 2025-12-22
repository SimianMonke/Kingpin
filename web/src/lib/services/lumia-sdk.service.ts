// =============================================================================
// LUMIA SDK SERVICE
// Direct WebSocket connection to Lumia Stream via official SDK
// Used for real-time game events and stream actions
// =============================================================================

import { prisma } from '../db'

// Types from @lumiastream/sdk (will be available after npm install)
export interface LumiaColor {
  r: number
  g: number
  b: number
}

export interface LumiaCommandOptions {
  color?: LumiaColor
  brightness?: number
  duration?: number
  transition?: number
  lights?: Array<{ type: string; id: string }>
  hold?: boolean
  extraSettings?: Record<string, string | number>
}

type QueuedCommand = () => Promise<void>

// =============================================================================
// LUMIA SDK SERVICE (Singleton)
// =============================================================================

class LumiaSdkService {
  private static instance: LumiaSdkService | null = null
  private sdk: any = null // Will be LumiaSdk type when SDK is installed
  private initialized = false
  private connected = false
  private commandQueue: QueuedCommand[] = []
  private processing = false
  private readonly RATE_LIMIT_MS = 100

  // State tracking to prevent API flooding
  private lastCommandValue: string | null = null

  private constructor() {
    // SDK will be initialized lazily
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LumiaSdkService {
    if (!LumiaSdkService.instance) {
      LumiaSdkService.instance = new LumiaSdkService()
    }
    return LumiaSdkService.instance
  }

  /**
   * Initialize connection to Lumia Stream
   * Call once at application startup
   */
  async init(): Promise<boolean> {
    if (this.initialized) {
      return this.connected
    }

    const token = process.env.LUMIA_API_TOKEN
    if (!token) {
      console.warn('[Lumia SDK] No API token configured (LUMIA_API_TOKEN)')
      this.initialized = true
      return false
    }

    try {
      // Dynamic import to handle missing package gracefully
      const { LumiaSdk } = await import('@lumiastream/sdk')
      this.sdk = new LumiaSdk()

      await this.sdk.init({
        appName: process.env.LUMIA_APP_NAME || 'kingpin',
        token,
      })

      this.setupEventListeners()
      this.initialized = true
      this.connected = true
      console.log('[Lumia SDK] Connected successfully')
      return true
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.warn('[Lumia SDK] Package not installed. Run: npm install @lumiastream/sdk')
      } else if (error.code === 'ECONNREFUSED') {
        console.warn('[Lumia SDK] Connection refused. Is Lumia Stream running?')
      } else {
        console.error('[Lumia SDK] Connection failed:', error.message)
      }
      this.initialized = true
      this.connected = false
      return false
    }
  }

  /**
   * Check if Lumia is available
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Setup event listeners for incoming Lumia events
   */
  private setupEventListeners(): void {
    if (!this.sdk) return

    this.sdk.on('event', (data: { type: string; origin?: string; data?: unknown }) => {
      // Handle incoming events if needed
      console.log('[Lumia SDK] Event received:', data.type)
    })
  }

  /**
   * Process command queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) {
      return
    }

    this.processing = true

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()
      if (command) {
        try {
          await command()
        } catch (error) {
          console.error('[Lumia SDK] Command failed:', error)
        }
        await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_MS))
      }
    }

    this.processing = false
  }

  /**
   * Queue a command for execution
   */
  private queueCommand(command: QueuedCommand): void {
    if (!this.connected || !this.sdk) {
      return // Silently skip if not connected
    }
    this.commandQueue.push(command)
    this.processQueue()
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Send a predefined command by name
   * Commands are configured in Lumia Stream
   */
  async sendCommand(
    commandName: string,
    options?: { hold?: boolean; extraSettings?: Record<string, string | number> }
  ): Promise<void> {
    // Skip duplicate commands unless variables have changed
    if (this.lastCommandValue === commandName && !options?.extraSettings) {
      return
    }

    this.queueCommand(async () => {
      await this.sdk.sendCommand({
        command: commandName,
        hold: options?.hold,
        extraSettings: options?.extraSettings,
      })
      this.lastCommandValue = commandName
    })
  }

  /**
   * Set lights to a specific color
   */
  async sendColor(options: LumiaCommandOptions): Promise<void> {
    if (!options.color) return

    const colorKey = `rgb-${options.color.r}-${options.color.g}-${options.color.b}`

    if (this.lastCommandValue === colorKey && !options.hold) {
      return
    }

    this.queueCommand(async () => {
      await this.sdk.sendColor({
        color: options.color!,
        brightness: options.brightness ?? 100,
        duration: options.duration ?? 1000,
        transition: options.transition,
        lights: options.lights,
      })
      this.lastCommandValue = colorKey
    })
  }

  /**
   * Set brightness without changing color
   */
  async sendBrightness(brightness: number): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendBrightness({ brightness })
    })
  }

  /**
   * Send text-to-speech message
   */
  async sendTts(text: string): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendTts({ text })
    })
  }

  /**
   * Send message via Lumia chatbot
   */
  async sendChatbot(platform: 'twitch' | 'youtube', text: string): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendChatbot({ platform, text })
    })
  }

  /**
   * Get current Lumia Stream info
   */
  async getInfo(): Promise<unknown> {
    if (!this.connected || !this.sdk) return null
    return this.sdk.getInfo()
  }

  /**
   * Reset state tracking
   */
  resetStateTracking(): void {
    this.lastCommandValue = null
  }

  // ─────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Flash a color briefly
   */
  async flash(color: LumiaColor, duration = 500): Promise<void> {
    await this.sendColor({ color, duration, brightness: 100 })
  }

  /**
   * Pulse a color (fade effect)
   */
  async pulse(color: LumiaColor, duration = 1000): Promise<void> {
    await this.sendColor({ color, duration, brightness: 100, transition: duration / 2 })
  }

  // Preset colors
  static readonly COLORS = {
    RED: { r: 255, g: 0, b: 0 },
    GREEN: { r: 0, g: 255, b: 0 },
    BLUE: { r: 0, g: 0, b: 255 },
    GOLD: { r: 255, g: 215, b: 0 },
    PURPLE: { r: 128, g: 0, b: 128 },
    CYAN: { r: 0, g: 255, b: 255 },
    ORANGE: { r: 255, g: 165, b: 0 },
    PINK: { r: 255, g: 105, b: 180 },
    WHITE: { r: 255, g: 255, b: 255 },
  } as const

  // ─────────────────────────────────────────────────────────────
  // SYSTEM EVENT TRIGGERS (Configurable via Admin)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a system Lumia command from admin settings
   */
  private async getSystemCommand(key: string): Promise<string | null> {
    try {
      const setting = await prisma.admin_settings.findUnique({
        where: { key: `lumia.${key}` },
      })
      if (setting?.value && typeof setting.value === 'object' && 'command' in setting.value) {
        return (setting.value as { command: string }).command
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Trigger crown change effect (Juicernaut lead change)
   */
  async triggerCrownChange(
    newHolderName: string,
    previousHolderName: string | null,
    totalUsd: number
  ): Promise<boolean> {
    const command = await this.getSystemCommand('crown_change_command')
    if (!command) {
      console.log('[Lumia SDK] No crown_change_command configured')
      return false
    }

    try {
      await this.sendCommand(command, {
        extraSettings: {
          new_juicernaut: newHolderName,
          old_juicernaut: previousHolderName || '',
          total_usd: totalUsd,
        },
      })
      return true
    } catch (error) {
      console.error('[Lumia SDK] Crown change trigger failed:', error)
      return false
    }
  }

  /**
   * Trigger leaderboard announcement effect
   */
  async triggerLeaderboardAnnounce(
    top3: Array<{ name: string; totalUsd: number }>,
    totalContributions: number
  ): Promise<boolean> {
    const command = await this.getSystemCommand('leaderboard_command')
    if (!command) {
      console.log('[Lumia SDK] No leaderboard_command configured')
      return false
    }

    try {
      await this.sendCommand(command, {
        extraSettings: {
          leader_1: top3[0]?.name || '',
          leader_1_usd: top3[0]?.totalUsd || 0,
          leader_2: top3[1]?.name || '',
          leader_2_usd: top3[1]?.totalUsd || 0,
          leader_3: top3[2]?.name || '',
          leader_3_usd: top3[2]?.totalUsd || 0,
          total_contributions: totalContributions,
        },
      })
      return true
    } catch (error) {
      console.error('[Lumia SDK] Leaderboard trigger failed:', error)
      return false
    }
  }

  /**
   * Trigger a stream action command (from shop purchase)
   */
  async triggerStreamAction(
    lumiaCommandId: string,
    category: string,
    payload?: { text?: string; color?: string; duration?: number }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected || !this.sdk) {
      return { success: false, error: 'Lumia not connected' }
    }

    try {
      if (category === 'tts' && payload?.text) {
        await this.sendTts(payload.text)
      } else {
        await this.sendCommand(lumiaCommandId, {
          extraSettings: payload as Record<string, string | number> | undefined,
        })
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

// Export singleton getter
export const getLumiaSdkService = (): LumiaSdkService => LumiaSdkService.getInstance()
export { LumiaSdkService }
