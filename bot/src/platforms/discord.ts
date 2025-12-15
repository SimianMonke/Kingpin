import {
  Client,
  GatewayIntentBits,
  Message,
  PartialMessage,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js'
import { EventEmitter } from 'events'
import { config } from '../config'
import { logger } from '../utils/logger'
import type { Platform, ChatMessage, PlatformConnection } from '../types'

// =============================================================================
// DISCORD PLATFORM CONNECTION
// =============================================================================

export class DiscordConnection extends EventEmitter implements PlatformConnection {
  public readonly platform: Platform = 'discord'
  private client: Client | null = null
  private connected: boolean = false

  constructor() {
    super()
  }

  async connect(): Promise<void> {
    if (!config.discord.enabled) {
      logger.info('Discord connection disabled')
      return
    }

    logger.info('Connecting to Discord...')

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
        ],
      })

      // Message handler
      this.client.on('messageCreate', (message) => {
        if (message.author.bot) return // Ignore bot messages

        // Only process messages in configured channels (if set)
        if (config.discord.commandChannelId && message.channelId !== config.discord.commandChannelId) {
          // Skip messages not in command channel
          // But still allow DMs
          if (message.guild) return
        }

        this.handleMessage(message)
      })

      // Ready event
      this.client.on('ready', () => {
        this.connected = true
        logger.info(`Logged in to Discord as ${this.client?.user?.tag}`)
        this.emit('connected', this.platform)
      })

      // Disconnect event
      this.client.on('disconnect', () => {
        this.connected = false
        logger.warn('Disconnected from Discord')
        this.emit('disconnected', this.platform)
      })

      // Error handler
      this.client.on('error', (error) => {
        logger.error('Discord error:', error)
        this.emit('error', this.platform, error)
      })

      await this.client.login(config.discord.botToken)

    } catch (error) {
      logger.error('Failed to connect to Discord:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy()
      this.client = null
      this.connected = false
      logger.info('Disconnected from Discord')
    }
  }

  async sendMessage(channelId: string, message: string): Promise<void> {
    if (!this.client || !this.connected) {
      logger.warn('Cannot send Discord message: not connected')
      return
    }

    try {
      const channel = await this.client.channels.fetch(channelId)
      if (channel && channel.isTextBased() && 'send' in channel) {
        await (channel as TextChannel).send(message)
      }
    } catch (error) {
      logger.error('Failed to send Discord message:', error)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  /**
   * Reply to a specific message
   */
  async replyToMessage(message: Message | PartialMessage, content: string): Promise<void> {
    try {
      await message.reply(content)
    } catch (error) {
      logger.error('Failed to reply to Discord message:', error)
      // Fallback to regular message in channel
      if (message.channel.isTextBased() && 'send' in message.channel) {
        await (message.channel as TextChannel).send(content)
      }
    }
  }

  private handleMessage(message: Message): void {
    const member = message.member
    const badges: string[] = []

    // Check for roles/permissions
    if (member) {
      if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        badges.push('admin')
      }
      if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        badges.push('moderator')
      }
      // Check for subscriber role (by name or other criteria)
      const subRole = member.roles.cache.find(
        (role) =>
          role.name.toLowerCase().includes('sub') ||
          role.name.toLowerCase().includes('member') ||
          role.name.toLowerCase().includes('supporter')
      )
      if (subRole) {
        badges.push('subscriber')
      }
    }

    // Check if user is server owner
    const isOwner = message.guild?.ownerId === message.author.id

    const chatMessage: ChatMessage = {
      platform: this.platform,
      channelId: message.channelId,
      userId: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.displayName || message.author.username,
      message: message.content,
      isMod: badges.includes('moderator') || badges.includes('admin'),
      isBroadcaster: isOwner,
      isSubscriber: badges.includes('subscriber'),
      badges,
      raw: message,
    }

    this.emit('message', chatMessage)
  }

  /**
   * Get Discord client for advanced usage
   */
  getClient(): Client | null {
    return this.client
  }
}

export default DiscordConnection
