import { NextAuthOptions } from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers/oauth'
import DiscordProvider from 'next-auth/providers/discord'
import TwitchProvider from 'next-auth/providers/twitch'
import { cookies } from 'next/headers'
import { prisma } from './db'

// Cookie names (must match route.ts files)
const LINK_INTENT_COOKIE = 'kingpin_link_intent'
const MERGE_INTENT_COOKIE = 'kingpin_merge_intent'
const MERGE_PENDING_COOKIE = 'kingpin_merge_pending'

interface LinkIntent {
  user_id: number
  platform: string
  expires: number
}

interface MergeIntent {
  primary_user_id: number
  platform: string
  expires: number
}

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
    params: {
      scope: 'user:read',
      response_type: 'code',
    },
  },
  token: 'https://id.kick.com/oauth/token',
  userinfo: 'https://api.kick.com/public/v1/users',
  clientId: process.env.KICK_CLIENT_ID,
  clientSecret: process.env.KICK_CLIENT_SECRET,
  // Kick requires client credentials in POST body (not Basic Auth header)
  client: {
    token_endpoint_auth_method: 'client_secret_post',
  },
  checks: ['pkce', 'state'],
  profile(profile) {
    const user = profile.data?.[0]
    if (!user) {
      throw new Error('No user data in Kick API response')
    }
    return {
      id: user.user_id.toString(),
      name: user.name,
      email: user.email || null,
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
    async signIn({ user, account }) {
      if (!account || !user) return false

      try {
        const platformField = getPlatformField(account.provider)
        if (!platformField) return false

        // Check for linking intent cookie (for single-redirect platforms like Kick)
        let linkIntent: LinkIntent | null = null
        try {
          const cookieStore = await cookies()
          const linkCookie = cookieStore.get(LINK_INTENT_COOKIE)
          if (linkCookie?.value) {
            linkIntent = JSON.parse(linkCookie.value) as LinkIntent

            // Validate the cookie
            if (
              linkIntent.platform !== account.provider ||
              Date.now() > linkIntent.expires
            ) {
              linkIntent = null // Invalid or expired
            }

            // Clear the cookie regardless
            cookieStore.delete(LINK_INTENT_COOKIE)
          }
        } catch {
          // Cookie parsing failed, continue with normal sign-in
        }

        // If this is a linking operation
        if (linkIntent) {
          console.log(`Linking ${account.provider} account ${account.providerAccountId} to user ${linkIntent.user_id}`)

          // Check if this platform ID is already linked to someone
          const existingUser = await prisma.users.findFirst({
            where: { [platformField]: account.providerAccountId },
          })

          if (existingUser) {
            if (existingUser.id === linkIntent.user_id) {
              // Already linked to this user - success
              return '/profile?success=already_linked&platform=' + account.provider
            } else {
              // Linked to a different user - error
              console.log(`${account.provider} ID ${account.providerAccountId} already linked to user ${existingUser.id}`)
              return '/profile?error=already_linked_other&platform=' + account.provider
            }
          }

          // Link the platform to the user
          await prisma.users.update({
            where: { id: linkIntent.user_id },
            data: { [platformField]: account.providerAccountId },
          })

          console.log(`Successfully linked ${account.provider} account ${account.providerAccountId} to user ${linkIntent.user_id}`)
          return '/profile?success=linked&platform=' + account.provider
        }

        // Check for merge intent cookie
        let mergeIntent: MergeIntent | null = null
        try {
          const cookieStore = await cookies()
          const mergeCookie = cookieStore.get(MERGE_INTENT_COOKIE)
          if (mergeCookie?.value) {
            mergeIntent = JSON.parse(mergeCookie.value) as MergeIntent

            // Validate the cookie
            if (
              mergeIntent.platform !== account.provider ||
              Date.now() > mergeIntent.expires
            ) {
              mergeIntent = null
            }

            // Clear the merge intent cookie
            cookieStore.delete(MERGE_INTENT_COOKIE)
          }
        } catch {
          // Cookie parsing failed
        }

        // If this is a merge operation
        if (mergeIntent) {
          console.log(`Merge attempt: ${account.provider} account ${account.providerAccountId} into user ${mergeIntent.primary_user_id}`)

          // Find the user who owns this platform account
          const secondaryUser = await prisma.users.findFirst({
            where: { [platformField]: account.providerAccountId },
          })

          if (!secondaryUser) {
            // No account found with this platform ID - can't merge, offer to link instead
            return '/profile?error=no_account_to_merge&platform=' + account.provider
          }

          if (secondaryUser.id === mergeIntent.primary_user_id) {
            // Trying to merge with themselves
            return '/profile?error=cannot_merge_self&platform=' + account.provider
          }

          if (secondaryUser.merged_into_user_id) {
            // Account was already merged
            return '/profile?error=already_merged&platform=' + account.provider
          }

          // Store pending merge info in a cookie for the preview page
          const cookieStore = await cookies()
          const pendingMerge = JSON.stringify({
            primary_user_id: mergeIntent.primary_user_id,
            secondary_user_id: secondaryUser.id,
            platform: account.provider,
            expires: Date.now() + 30 * 60 * 1000, // 30 minutes to complete
          })

          cookieStore.set(MERGE_PENDING_COOKIE, pendingMerge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1800, // 30 minutes
            path: '/',
          })

          console.log(`Merge pending: User ${secondaryUser.id} -> User ${mergeIntent.primary_user_id}`)
          return '/profile?merge_pending=true'
        }

        // Normal sign-in flow (not linking or merging)
        // Check if user exists with this platform ID
        let dbUser = await prisma.users.findFirst({
          where: { [platformField]: account.providerAccountId },
        })

        if (!dbUser) {
          // DISCORD RESTRICTION: Discord cannot create new accounts
          // Users must first create an account via Kick or Twitch, then link Discord from profile
          if (account.provider === 'discord') {
            console.log(`Discord sign-in rejected: No existing account for Discord ID ${account.providerAccountId}`)
            return '/login?error=DiscordAccountNotLinked'
          }

          // Check if a user with the same username exists on another platform
          // This prevents accidental duplicate accounts
          const existingUserWithSameName = await prisma.users.findFirst({
            where: {
              username: { equals: user.name || '', mode: 'insensitive' },
              merged_into_user_id: null, // Not already merged
            },
          })

          if (existingUserWithSameName) {
            // A user with this username exists - prompt to merge instead
            console.log(`Duplicate username detected: ${user.name} already exists as user ${existingUserWithSameName.id}`)
            const otherPlatform = existingUserWithSameName.kick_user_id
              ? 'Kick'
              : existingUserWithSameName.twitch_user_id
                ? 'Twitch'
                : 'another platform'
            return `/login?error=DuplicateUsername&username=${encodeURIComponent(user.name || '')}&platform=${otherPlatform}`
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
              console.log(`Discord sign-in rejected: User ${dbUser.id} has no Kick/Twitch linked`)
              return '/login?error=DiscordAccountNotLinked'
            }
          }

          // Update last seen and sync username from platform
          // This keeps the username current if user changes it on the platform
          await prisma.users.update({
            where: { id: dbUser.id },
            data: {
              last_seen: new Date(),
              username: user.name || dbUser.username,
              display_name: user.name || dbUser.display_name,
            },
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
