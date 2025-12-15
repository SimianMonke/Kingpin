// =============================================================================
// BOT TYPES
// =============================================================================

export type Platform = 'kick' | 'twitch' | 'discord'

export interface ChatMessage {
  platform: Platform
  channelId: string
  userId: string
  username: string
  displayName: string
  message: string
  isMod: boolean
  isBroadcaster: boolean
  isSubscriber: boolean
  badges: string[]
  raw?: unknown
}

export interface ChannelPointRedemption {
  platform: Platform
  channelId: string
  rewardId: string
  rewardTitle: string
  userId: string
  username: string
  displayName: string
  userInput?: string
  redemptionId: string
  raw?: unknown
}

export interface CommandContext {
  message: ChatMessage
  args: string[]
  command: string
  reply: (text: string) => Promise<void>
}

export interface RedemptionContext {
  redemption: ChannelPointRedemption
  reply: (text: string) => Promise<void>
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>
export type RedemptionHandler = (ctx: RedemptionContext) => Promise<void>

export interface PlatformConnection {
  platform: Platform
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendMessage(channelId: string, message: string): Promise<void>
  isConnected(): boolean
}

// Event emitter types
export interface BotEvents {
  message: (message: ChatMessage) => void
  redemption: (redemption: ChannelPointRedemption) => void
  connected: (platform: Platform) => void
  disconnected: (platform: Platform) => void
  error: (platform: Platform, error: Error) => void
}
