import { NextAuthOptions } from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import TwitchProvider from 'next-auth/providers/twitch'
import { prisma } from './db'

// Custom Kick provider (Kick uses OAuth 2.0)
const KickProvider = {
  id: 'kick',
  name: 'Kick',
  type: 'oauth' as const,
  authorization: {
    url: 'https://kick.com/oauth/authorize',
    params: { scope: 'user:read' },
  },
  token: 'https://kick.com/oauth/token',
  userinfo: 'https://kick.com/api/v1/user',
  clientId: process.env.KICK_CLIENT_ID,
  clientSecret: process.env.KICK_CLIENT_SECRET,
  profile(profile: KickProfile) {
    return {
      id: profile.id.toString(),
      name: profile.username,
      email: profile.email,
      image: profile.profile_pic,
    }
  },
}

interface KickProfile {
  id: number
  username: string
  email: string
  profile_pic: string
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
        let dbUser = await prisma.user.findFirst({
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
          dbUser = await prisma.user.create({
            data: {
              [platformField]: account.providerAccountId,
              username: user.name || `user_${account.providerAccountId}`,
              displayName: user.name,
            },
          })

          console.log(`Created new user: ${dbUser.id} via ${account.provider}`)
        } else {
          // User exists - allow sign-in
          // For Discord logins, verify the user has Kick or Twitch linked (security check)
          if (account.provider === 'discord') {
            if (!dbUser.kickUserId && !dbUser.twitchUserId) {
              // This shouldn't happen in normal flow, but prevents orphaned Discord-only accounts
              console.log(`Discord sign-in rejected: User ${dbUser.id} has no Kick/Twitch linked`)
              return '/login?error=DiscordAccountNotLinked'
            }
          }

          // Update last seen
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { lastSeen: new Date() },
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
          const dbUser = await prisma.user.findFirst({
            where: { [platformField]: account.providerAccountId },
          })

          if (dbUser) {
            token.userId = dbUser.id
            token.provider = account.provider
            token.platformId = account.providerAccountId
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      // Add user ID and platform info to session
      if (token.userId) {
        session.user.id = token.userId as number
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

  debug: process.env.NODE_ENV === 'development',
}

function getPlatformField(provider: string): string | null {
  switch (provider) {
    case 'kick':
      return 'kickUserId'
    case 'twitch':
      return 'twitchUserId'
    case 'discord':
      return 'discordUserId'
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
    userId?: number
    provider?: string
    platformId?: string
  }
}
