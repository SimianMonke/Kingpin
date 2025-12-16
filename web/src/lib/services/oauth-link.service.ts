/**
 * OAuth Link Service (SEC-01 Security Fix)
 *
 * Handles secure OAuth-based account linking to prevent identity theft.
 * Users must authenticate with each platform before linking.
 */

import { randomBytes } from 'crypto'
import { prisma } from '../db'

export type LinkPlatform = 'kick' | 'twitch' | 'discord'

const STATE_EXPIRY_MINUTES = 10

// OAuth configuration per platform
const OAUTH_CONFIG: Record<LinkPlatform, {
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  scopes: string[]
  clientIdEnv: string
  clientSecretEnv: string
}> = {
  kick: {
    authUrl: 'https://kick.com/oauth/authorize',
    tokenUrl: 'https://kick.com/oauth/token',
    userInfoUrl: 'https://kick.com/api/v1/user',
    scopes: ['user:read'],
    clientIdEnv: 'KICK_CLIENT_ID',
    clientSecretEnv: 'KICK_CLIENT_SECRET',
  },
  twitch: {
    authUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    userInfoUrl: 'https://api.twitch.tv/helix/users',
    scopes: ['user:read:email'],
    clientIdEnv: 'TWITCH_CLIENT_ID',
    clientSecretEnv: 'TWITCH_CLIENT_SECRET',
  },
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify'],
    clientIdEnv: 'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
  },
}

export class OAuthLinkService {
  /**
   * Generate a cryptographically secure state token
   */
  static generateState(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Store OAuth state for later verification
   */
  static async storeState(
    state: string,
    user_id: number,
    platform: LinkPlatform
  ): Promise<void> {
    const expires_at = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000)

    await prisma.oauth_link_states.create({
      data: {
        state,
        user_id,
        platform,
        expires_at,
      },
    })
  }

  /**
   * Verify and consume state token
   * Returns stored data if valid, null if invalid/expired
   */
  static async verifyState(state: string): Promise<{
    user_id: number
    platform: LinkPlatform
  } | null> {
    const record = await prisma.oauth_link_states.findUnique({
      where: { state },
    })

    if (!record) {
      return null
    }

    // Delete the state (one-time use)
    await prisma.oauth_link_states.delete({
      where: { state },
    })

    // Check expiry
    if (new Date() > record.expires_at) {
      return null
    }

    return {
      user_id: record.user_id,
      platform: record.platform as LinkPlatform,
    }
  }

  /**
   * Build OAuth authorization URL for a platform
   */
  static buildAuthUrl(platform: LinkPlatform, state: string): string {
    const config = OAUTH_CONFIG[platform]
    const clientId = process.env[config.clientIdEnv]
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const callbackUrl = `${baseUrl}/api/auth/link/${platform}/callback`

    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    })

    return `${config.authUrl}?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForTokens(
    platform: LinkPlatform,
    code: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const config = OAUTH_CONFIG[platform]
    const clientId = process.env[config.clientIdEnv]
    const clientSecret = process.env[config.clientSecretEnv]
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const callbackUrl = `${baseUrl}/api/auth/link/${platform}/callback`

    const body = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
    })

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Token exchange failed for ${platform}:`, error)
      throw new Error(`Failed to exchange code for tokens: ${response.status}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    }
  }

  /**
   * Get verified user info from platform API
   */
  static async getPlatformUser(
    platform: LinkPlatform,
    accessToken: string
  ): Promise<{ id: string; username: string }> {
    const config = OAUTH_CONFIG[platform]

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    }

    // Twitch requires Client-ID header
    if (platform === 'twitch') {
      headers['Client-ID'] = process.env.TWITCH_CLIENT_ID!
    }

    const response = await fetch(config.userInfoUrl, { headers })

    if (!response.ok) {
      const error = await response.text()
      console.error(`User info fetch failed for ${platform}:`, error)
      throw new Error(`Failed to get user info: ${response.status}`)
    }

    const data = await response.json()

    // Parse response based on platform
    switch (platform) {
      case 'kick':
        return {
          id: data.id.toString(),
          username: data.username,
        }
      case 'twitch':
        // Twitch returns array of users
        const user = data.data[0]
        return {
          id: user.id,
          username: user.display_name || user.login,
        }
      case 'discord':
        return {
          id: data.id,
          username: data.username,
        }
      default:
        throw new Error(`Unknown platform: ${platform}`)
    }
  }

  /**
   * Check if platform ID is already linked to any user
   */
  static async isPlatformIdLinked(
    platform: LinkPlatform,
    platformId: string
  ): Promise<{ isLinked: boolean; user_id?: number }> {
    const fieldName = this.getPlatformField(platform)

    const existingUser = await prisma.users.findFirst({
      where: { [fieldName]: platformId },
      select: { id: true },
    })

    return {
      isLinked: !!existingUser,
      user_id: existingUser?.id,
    }
  }

  /**
   * Link a verified platform to user account
   */
  static async linkPlatform(
    user_id: number,
    platform: LinkPlatform,
    platformId: string,
    platformUsername?: string
  ): Promise<void> {
    const fieldName = this.getPlatformField(platform)
    const updateData: Record<string, unknown> = {
      [fieldName]: platformId,
    }

    // Add platform-specific fields
    if (platform === 'discord' && platformUsername) {
      updateData.discordUsername = platformUsername
      updateData.discordLinkedAt = new Date()
    }

    await prisma.users.update({
      where: { id: user_id },
      data: updateData,
    })

    console.log(`Linked ${platform} account ${platformId} to user ${user_id}`)
  }

  /**
   * Get the database field name for a platform
   */
  static getPlatformField(platform: LinkPlatform): string {
    switch (platform) {
      case 'kick':
        return 'kick_user_id'
      case 'twitch':
        return 'twitch_user_id'
      case 'discord':
        return 'discord_user_id'
      default:
        throw new Error(`Unknown platform: ${platform}`)
    }
  }

  /**
   * Clean up expired state tokens
   * Should be called periodically (e.g., in daily cron)
   */
  static async cleanupExpiredStates(): Promise<number> {
    const result = await prisma.oauth_link_states.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    })
    return result.count
  }

  /**
   * Validate that a platform is supported
   */
  static isValidPlatform(platform: string): platform is LinkPlatform {
    return ['kick', 'twitch', 'discord'].includes(platform)
  }
}
