import { EventEmitter } from 'events'
import { config } from '../config'
import { logger } from '../utils/logger'
import { KickConnection } from './kick'
import { TwitchConnection } from './twitch'
import { DiscordConnection } from './discord'
import type { Platform, ChatMessage, ChannelPointRedemption, PlatformConnection } from '../types'

// =============================================================================
// PLATFORM MANAGER
// =============================================================================

export class PlatformManager extends EventEmitter {
  private connections: Map<Platform, PlatformConnection> = new Map()
  private kick: KickConnection | null = null
  private twitch: TwitchConnection | null = null
  private discord: DiscordConnection | null = null

  constructor() {
    super()
  }

  /**
   * Initialize all enabled platform connections
   */
  async initialize(): Promise<void> {
    logger.info('Initializing platform connections...')

    // Initialize Kick
    if (config.kick.enabled) {
      this.kick = new KickConnection()
      this.setupEventForwarding(this.kick)
      this.connections.set('kick', this.kick)
    }

    // Initialize Twitch
    if (config.twitch.enabled) {
      this.twitch = new TwitchConnection()
      this.setupEventForwarding(this.twitch)
      this.connections.set('twitch', this.twitch)
    }

    // Initialize Discord
    if (config.discord.enabled) {
      this.discord = new DiscordConnection()
      this.setupEventForwarding(this.discord)
      this.connections.set('discord', this.discord)
    }

    // Connect all platforms
    const connectPromises: Promise<void>[] = []

    for (const [platform, connection] of this.connections) {
      connectPromises.push(
        connection.connect().catch((error) => {
          logger.error(`Failed to connect to ${platform}:`, error)
        })
      )
    }

    await Promise.all(connectPromises)

    logger.info(`Platform initialization complete. Connected: ${this.getConnectedPlatforms().join(', ') || 'none'}`)
  }

  /**
   * Forward events from platform connection to manager
   */
  private setupEventForwarding(connection: PlatformConnection): void {
    const emitter = connection as unknown as EventEmitter

    emitter.on('message', (message: ChatMessage) => {
      this.emit('message', message)
    })

    emitter.on('redemption', (redemption: ChannelPointRedemption) => {
      this.emit('redemption', redemption)
    })

    emitter.on('connected', (platform: Platform) => {
      this.emit('connected', platform)
    })

    emitter.on('disconnected', (platform: Platform) => {
      this.emit('disconnected', platform)
    })

    emitter.on('error', (platform: Platform, error: Error) => {
      this.emit('error', platform, error)
    })
  }

  /**
   * Send a message to a specific platform
   */
  async sendMessage(platform: Platform, channelId: string, message: string): Promise<void> {
    const connection = this.connections.get(platform)
    if (connection && connection.isConnected()) {
      await connection.sendMessage(channelId, message)
    } else {
      logger.warn(`Cannot send message to ${platform}: not connected`)
    }
  }

  /**
   * Get list of connected platforms
   */
  getConnectedPlatforms(): Platform[] {
    const connected: Platform[] = []
    for (const [platform, connection] of this.connections) {
      if (connection.isConnected()) {
        connected.push(platform)
      }
    }
    return connected
  }

  /**
   * Check if a specific platform is connected
   */
  isConnected(platform: Platform): boolean {
    const connection = this.connections.get(platform)
    return connection?.isConnected() ?? false
  }

  /**
   * Get the Discord connection for advanced usage
   */
  getDiscord(): DiscordConnection | null {
    return this.discord
  }

  /**
   * Disconnect all platforms
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down platform connections...')

    const disconnectPromises: Promise<void>[] = []

    for (const [platform, connection] of this.connections) {
      disconnectPromises.push(
        connection.disconnect().catch((error) => {
          logger.error(`Error disconnecting from ${platform}:`, error)
        })
      )
    }

    await Promise.all(disconnectPromises)
    this.connections.clear()

    logger.info('All platform connections closed')
  }
}

// Export singleton instance
export const platformManager = new PlatformManager()

export { KickConnection } from './kick'
export { TwitchConnection } from './twitch'
export { DiscordConnection } from './discord'
export default platformManager
