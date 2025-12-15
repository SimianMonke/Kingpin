import tmi from 'tmi.js'
import { EventEmitter } from 'events'
import { config } from '../config'
import { logger } from '../utils/logger'
import type { Platform, ChatMessage, ChannelPointRedemption, PlatformConnection } from '../types'

// =============================================================================
// TWITCH PLATFORM CONNECTION
// =============================================================================

export class TwitchConnection extends EventEmitter implements PlatformConnection {
  public readonly platform: Platform = 'twitch'
  private client: tmi.Client | null = null
  private connected: boolean = false
  private channel: string

  constructor() {
    super()
    this.channel = config.twitch.channel
  }

  async connect(): Promise<void> {
    if (!config.twitch.enabled) {
      logger.info('Twitch connection disabled')
      return
    }

    logger.info('Connecting to Twitch...')

    try {
      this.client = new tmi.Client({
        options: { debug: config.bot.logLevel === 'debug' },
        connection: {
          secure: true,
          reconnect: true,
        },
        identity: {
          username: config.twitch.botUsername,
          password: config.twitch.botOauth,
        },
        channels: [this.channel],
      })

      // Chat message handler
      this.client.on('message', (channel, tags, message, self) => {
        if (self) return // Ignore bot's own messages

        this.handleChatMessage(channel, tags, message)
      })

      // Channel point redemption handler
      this.client.on('redeem', (channel, username, rewardType, tags, message) => {
        this.handleRedemption(channel, username, rewardType, tags, message)
      })

      // Connection events
      this.client.on('connected', (address, port) => {
        this.connected = true
        logger.info(`Connected to Twitch at ${address}:${port}`)
        this.emit('connected', this.platform)
      })

      this.client.on('disconnected', (reason) => {
        this.connected = false
        logger.warn('Disconnected from Twitch:', reason)
        this.emit('disconnected', this.platform)
      })

      this.client.on('reconnect', () => {
        logger.info('Reconnecting to Twitch...')
      })

      await this.client.connect()

    } catch (error) {
      logger.error('Failed to connect to Twitch:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
      this.connected = false
      logger.info('Disconnected from Twitch')
    }
  }

  async sendMessage(channelId: string, message: string): Promise<void> {
    if (!this.client || !this.connected) {
      logger.warn('Cannot send Twitch message: not connected')
      return
    }

    try {
      // Ensure channel has # prefix
      const channel = channelId.startsWith('#') ? channelId : `#${channelId}`
      await this.client.say(channel, message)
    } catch (error) {
      logger.error('Failed to send Twitch message:', error)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  private handleChatMessage(channel: string, tags: tmi.ChatUserstate, message: string): void {
    const badges = Object.keys(tags.badges || {})

    const chatMessage: ChatMessage = {
      platform: this.platform,
      channelId: channel.replace('#', ''),
      userId: tags['user-id'] || '',
      username: tags.username || '',
      displayName: tags['display-name'] || tags.username || '',
      message,
      isMod: tags.mod || false,
      isBroadcaster: badges.includes('broadcaster'),
      isSubscriber: tags.subscriber || false,
      badges,
      raw: tags,
    }

    this.emit('message', chatMessage)
  }

  private handleRedemption(
    channel: string,
    username: string,
    rewardType: string,
    tags: tmi.ChatUserstate,
    message: string
  ): void {
    // Note: tmi.js has limited channel point support
    // Full support requires EventSub webhooks (already set up in web app)
    // This handler catches basic redemptions that come through chat

    const redemption: ChannelPointRedemption = {
      platform: this.platform,
      channelId: channel.replace('#', ''),
      rewardId: tags['custom-reward-id'] || rewardType,
      rewardTitle: rewardType,
      userId: tags['user-id'] || '',
      username,
      displayName: tags['display-name'] || username,
      userInput: message,
      redemptionId: tags.id || '',
      raw: tags,
    }

    this.emit('redemption', redemption)
  }
}

export default TwitchConnection
