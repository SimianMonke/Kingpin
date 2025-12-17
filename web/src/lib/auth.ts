import { NextAuthOptions } from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers/oauth'
import DiscordProvider from 'next-auth/providers/discord'
import TwitchProvider from 'next-auth/providers/twitch'
import { prisma } from './db'

interface KickProfile {
  id: number
  username: string
  email: string
  profile_pic: string
}

// Custom Kick provider (Kick uses OAuth 2.1 with PKCE)
// OAuth server: https://id.kick.com
// Docs: https://github.com/KickEngineering/KickDevDocs
const KickProvider: OAuthConfig<KickProfile> = {
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
    return {
      id: profile.id.toString(),
      name: profile.username,
      email: profile.email,
      image: profile.profile_pic,
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

  debug: process.env.NODE_ENV === 'development',
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
