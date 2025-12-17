import { NextAuthOptions } from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers/oauth'
import DiscordProvider from 'next-auth/providers/discord'
import TwitchProvider from 'next-auth/providers/twitch'
import { prisma } from './db'

// Kick API response structure: { message: string, data: [{ user_id, name, email, profile_picture }] }
interface KickApiResponse {
  message: string
  data: Array<{
    user_id: number
    name: string
    email: string
    profile_picture: string
  }>
}

// Custom Kick provider (Kick uses OAuth 2.1 with PKCE)
// OAuth server: https://id.kick.com
// Docs: https://github.com/KickEngineering/KickDevDocs
const KickProvider: OAuthConfig<KickApiResponse> = {
  id: 'kick',
  name: 'Kick',
  type: 'oauth',
  authorization: {
    url: 'https://id.kick.com/oauth/authorize',
    params: { scope: 'user:read' },
  },
  token: 'https://id.kick.com/oauth/token',
  userinfo: 'https://api.kick.com/public/v1/users',
  clientId: process.env.KICK_CLIENT_ID,
  clientSecret: process.env.KICK_CLIENT_SECRET,
  checks: ['pkce', 'state'],
  profile(profile) {
    // Extract user from data array
    const user = profile.data?.[0]
    if (!user) {
      throw new Error('No user data in Kick API response')
    }
    return {
      id: user.user_id.toString(),
      name: user.name,
      email: user.email,
      image: user.profile_picture,
    }
  },
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Kick OAuth
    KickProvider,

    // Twitch OAuth
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    }),

    // Discord OAuth
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !user) return false

      try {
        // Find or create user based on platform
        const platformField = getPlatformField(account.provider)
        if (!platformField) return false

        // Check if user exists with this platform ID
        let dbUser = await prisma.users.findFirst({
          where: { [platformField]: account.providerAccountId },
        })

        if (!dbUser) {
          // DISCORD RESTRICTION: Discord cannot create new accounts
          // Users must first create an account via Kick or Twitch, then link Discord from profile
          if (account.provider === 'discord') {
            console.log(`Discord sign-in rejected: No existing account for Discord ID ${account.providerAccountId}`)
            // Redirect to login page with custom error
            return '/login?error=DiscordAccountNotLinked'
          }

          // Create new user (only for Kick/Twitch)
          dbUser = await prisma.users.create({
            data: {
              [platformField]: account.providerAccountId,
              username: user.name || `user_${account.providerAccountId}`,
              display_name: user.name,
            },
          })

          console.log(`Created new user: ${dbUser.id} via ${account.provider}`)
        } else {
          // User exists - allow sign-in
          // For Discord logins, verify the user has Kick or Twitch linked (security check)
          if (account.provider === 'discord') {
            if (!dbUser.kick_user_id && !dbUser.twitch_user_id) {
              // This shouldn't happen in normal flow, but prevents orphaned Discord-only accounts
              console.log(`Discord sign-in rejected: User ${dbUser.id} has no Kick/Twitch linked`)
              return '/login?error=DiscordAccountNotLinked'
            }
          }

          // Update last seen
          await prisma.users.update({
            where: { id: dbUser.id },
            data: { last_seen: new Date() },
          })
        }

        return true
      } catch (error) {
        console.error('SignIn error:', error)
        return false
      }
    },

    async jwt({ token, account, user }) {
      // On initial sign in, add user data to token
      if (account && user) {
        const platformField = getPlatformField(account.provider)
        if (platformField) {
          const dbUser = await prisma.users.findFirst({
            where: { [platformField]: account.providerAccountId },
          })

          if (dbUser) {
            token.user_id = dbUser.id
            token.provider = account.provider
            token.platformId = account.providerAccountId
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      // Add user ID and platform info to session
      if (token.user_id) {
        session.user.id = token.user_id as number
        session.user.provider = token.provider as string
        session.user.platformId = token.platformId as string
      }

      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,

  // Enable debug logging to diagnose OAuth issues
  debug: true,

  logger: {
    error(code, metadata) {
      console.error('NextAuth Error:', code, JSON.stringify(metadata, null, 2))
    },
    warn(code) {
      console.warn('NextAuth Warning:', code)
    },
    debug(code, metadata) {
      console.log('NextAuth Debug:', code, metadata)
    },
  },
}

function getPlatformField(provider: string): string | null {
  switch (provider) {
    case 'kick':
      return 'kick_user_id'
    case 'twitch':
      return 'twitch_user_id'
    case 'discord':
      return 'discord_user_id'
    default:
      return null
  }
}

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: number
      name?: string | null
      email?: string | null
      image?: string | null
      provider: string
      platformId: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user_id?: number
    provider?: string
    platformId?: string
  }
}
