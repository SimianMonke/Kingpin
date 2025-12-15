import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function optionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue
}

function boolEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

function intEnv(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

export const config = {
  // API Configuration
  api: {
    baseUrl: requireEnv('API_BASE_URL'),
    botApiKey: requireEnv('BOT_API_KEY'),
    adminApiKey: optionalEnv('ADMIN_API_KEY'),
  },

  // Kick Configuration
  kick: {
    enabled: boolEnv('KICK_ENABLED', false),
    channelId: optionalEnv('KICK_CHANNEL_ID'),
    channelSlug: optionalEnv('KICK_CHANNEL_SLUG'),
    pusherKey: optionalEnv('KICK_PUSHER_KEY', 'eb1d5f283081a78b932c'),
    pusherCluster: optionalEnv('KICK_PUSHER_CLUSTER', 'us2'),
    rewards: {
      play: optionalEnv('KICK_REWARD_PLAY'),
      rob: optionalEnv('KICK_REWARD_ROB'),
      bail: optionalEnv('KICK_REWARD_BAIL'),
      reroll: optionalEnv('KICK_REWARD_REROLL'),
    },
  },

  // Twitch Configuration
  twitch: {
    enabled: boolEnv('TWITCH_ENABLED', false),
    channel: optionalEnv('TWITCH_CHANNEL'),
    botUsername: optionalEnv('TWITCH_BOT_USERNAME'),
    botOauth: optionalEnv('TWITCH_BOT_OAUTH'),
    clientId: optionalEnv('TWITCH_CLIENT_ID'),
    rewards: {
      play: optionalEnv('TWITCH_REWARD_PLAY'),
      rob: optionalEnv('TWITCH_REWARD_ROB'),
      bail: optionalEnv('TWITCH_REWARD_BAIL'),
      reroll: optionalEnv('TWITCH_REWARD_REROLL'),
    },
  },

  // Discord Configuration
  discord: {
    enabled: boolEnv('DISCORD_ENABLED', false),
    botToken: optionalEnv('DISCORD_BOT_TOKEN'),
    guildId: optionalEnv('DISCORD_GUILD_ID'),
    commandChannelId: optionalEnv('DISCORD_COMMAND_CHANNEL_ID'),
    feedChannelId: optionalEnv('DISCORD_FEED_CHANNEL_ID'),
  },

  // Bot Settings
  bot: {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
    commandPrefix: optionalEnv('COMMAND_PREFIX', '!'),
    commandCooldownMs: intEnv('COMMAND_COOLDOWN_MS', 3000),
  },
}

export type Config = typeof config

// Validation
export function validateConfig(): void {
  const errors: string[] = []

  // Check API config
  if (!config.api.baseUrl) {
    errors.push('API_BASE_URL is required')
  }
  if (!config.api.botApiKey) {
    errors.push('BOT_API_KEY is required')
  }

  // Check at least one platform is enabled
  if (!config.kick.enabled && !config.twitch.enabled && !config.discord.enabled) {
    errors.push('At least one platform must be enabled (KICK_ENABLED, TWITCH_ENABLED, or DISCORD_ENABLED)')
  }

  // Validate Kick config if enabled
  if (config.kick.enabled) {
    if (!config.kick.channelId) errors.push('KICK_CHANNEL_ID is required when Kick is enabled')
    if (!config.kick.channelSlug) errors.push('KICK_CHANNEL_SLUG is required when Kick is enabled')
  }

  // Validate Twitch config if enabled
  if (config.twitch.enabled) {
    if (!config.twitch.channel) errors.push('TWITCH_CHANNEL is required when Twitch is enabled')
    if (!config.twitch.botUsername) errors.push('TWITCH_BOT_USERNAME is required when Twitch is enabled')
    if (!config.twitch.botOauth) errors.push('TWITCH_BOT_OAUTH is required when Twitch is enabled')
  }

  // Validate Discord config if enabled
  if (config.discord.enabled) {
    if (!config.discord.botToken) errors.push('DISCORD_BOT_TOKEN is required when Discord is enabled')
  }

  if (errors.length > 0) {
    console.error('Configuration errors:')
    errors.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }
}

export default config
