import Pusher from 'pusher-js'
import { EventEmitter } from 'events'
import { config } from '../config'
import { logger } from '../utils/logger'
import type { Platform, ChatMessage, ChannelPointRedemption, PlatformConnection } from '../types'

// =============================================================================
// KICK PLATFORM CONNECTION
// =============================================================================

interface KickChatMessage {
  id: string
  chatroom_id: number
  content: string
  type: string
  created_at: string
  sender: {
    id: number
    username: string
    slug: string
    identity: {
      color: string
      badges: Array<{ type: string; text: string }>
    }
  }
}

interface KickChannelPointRedemption {
  id: string
  reward: {
    id: string
    title: string
    cost: number
  }
  user: {
    id: number
    username: string
  }
  user_input?: string
  status: string
}

export class KickConnection extends EventEmitter implements PlatformConnection {
  public readonly platform: Platform = 'kick'
  private pusher: Pusher | null = null
  private connected: boolean = false
  private channelId: string
  private channelSlug: string

  constructor() {
    super()
    this.channelId = config.kick.channelId
    this.channelSlug = config.kick.channelSlug
  }

  async connect(): Promise<void> {
    if (!config.kick.enabled) {
      logger.info('Kick connection disabled')
      return
    }

    logger.info('Connecting to Kick...')

    try {
      // Initialize Pusher client for Kick's WebSocket
      this.pusher = new Pusher(config.kick.pusherKey, {
        cluster: config.kick.pusherCluster,
        wsHost: 'ws-us2.pusher.com',
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
      })

      // Subscribe to chatroom channel
      const chatroomChannel = this.pusher.subscribe(`chatrooms.${this.channelId}.v2`)

      chatroomChannel.bind('App\\Events\\ChatMessageEvent', (data: KickChatMessage) => {
        this.handleChatMessage(data)
      })

      // Subscribe to channel events (for channel points when available)
      const channelChannel = this.pusher.subscribe(`channel.${this.channelId}`)

      channelChannel.bind('App\\Events\\ChannelPointRedemption', (data: KickChannelPointRedemption) => {
        this.handleRedemption(data)
      })

      // Connection events
      this.pusher.connection.bind('connected', () => {
        this.connected = true
        logger.info('Connected to Kick')
        this.emit('connected', this.platform)
      })

      this.pusher.connection.bind('disconnected', () => {
        this.connected = false
        logger.warn('Disconnected from Kick')
        this.emit('disconnected', this.platform)
      })

      this.pusher.connection.bind('error', (error: Error) => {
        logger.error('Kick connection error:', error)
        this.emit('error', this.platform, error)
      })

    } catch (error) {
      logger.error('Failed to connect to Kick:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.pusher) {
      this.pusher.disconnect()
      this.pusher = null
      this.connected = false
      logger.info('Disconnected from Kick')
    }
  }

  async sendMessage(channelId: string, message: string): Promise<void> {
    // Kick doesn't support sending messages via Pusher
    // Messages need to be sent via Kick's API (requires authenticated session)
    logger.warn('Kick message sending requires API integration:', { channelId, message })

    // For now, log the message - actual implementation requires Kick API auth
    // This would typically be done via a headless browser or official API when available
  }

  isConnected(): boolean {
    return this.connected
  }

  private handleChatMessage(data: KickChatMessage): void {
    const badges = data.sender.identity.badges.map((b) => b.type)
    const isMod = badges.includes('moderator')
    const isBroadcaster = badges.includes('broadcaster')
    const isSubscriber = badges.includes('subscriber') || badges.includes('founder')

    const message: ChatMessage = {
      platform: this.platform,
      channelId: this.channelId,
      userId: data.sender.id.toString(),
      username: data.sender.username,
      displayName: data.sender.username,
      message: data.content,
      isMod,
      isBroadcaster,
      isSubscriber,
      badges,
      raw: data,
    }

    this.emit('message', message)
  }

  private handleRedemption(data: KickChannelPointRedemption): void {
    const redemption: ChannelPointRedemption = {
      platform: this.platform,
      channelId: this.channelId,
      rewardId: data.reward.id,
      rewardTitle: data.reward.title,
      userId: data.user.id.toString(),
      username: data.user.username,
      displayName: data.user.username,
      userInput: data.user_input,
      redemptionId: data.id,
      raw: data,
    }

    this.emit('redemption', redemption)
  }
}

export default KickConnection
