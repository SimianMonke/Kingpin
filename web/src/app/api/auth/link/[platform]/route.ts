/**
 * GET /api/auth/link/[platform]
 *
 * Initiates OAuth flow for linking an additional platform to the user's account.
 *
 * For platforms that only allow one redirect URI (Kick), we use NextAuth's
 * sign-in flow with a linking cookie to detect the operation in the callback.
 *
 * For platforms with multiple URIs allowed (Twitch, Discord), we use a
 * dedicated callback handler.
 *
 * SEC-01: This route ensures account linking happens through proper OAuth verification,
 * preventing identity theft attacks where users could claim others' platform IDs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/api-utils'
import { OAuthLinkService, LinkPlatform } from '@/lib/services/oauth-link.service'
import { cookies } from 'next/headers'

// Platforms that only allow one redirect URI - use NextAuth flow with cookie
const SINGLE_REDIRECT_PLATFORMS = ['kick']

// Cookie name for storing linking intent
export const LINK_INTENT_COOKIE = 'kingpin_link_intent'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params

    // Validate platform
    if (!OAuthLinkService.isValidPlatform(platform)) {
      return NextResponse.redirect(
        new URL('/profile?error=invalid_platform', request.url)
      )
    }

    // Require authenticated session
    const session = await getAuthSession()
    if (!session?.user?.id) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', `/api/auth/link/${platform}`)
      return NextResponse.redirect(loginUrl)
    }

    const user_id = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id

    // For single-redirect platforms (Kick), use NextAuth's sign-in flow with a cookie
    if (SINGLE_REDIRECT_PLATFORMS.includes(platform)) {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

      // Create linking intent cookie (expires in 10 minutes)
      const linkIntent = JSON.stringify({
        user_id,
        platform,
        expires: Date.now() + 10 * 60 * 1000,
      })

      const cookieStore = await cookies()
      cookieStore.set(LINK_INTENT_COOKIE, linkIntent, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      })

      // Redirect to NextAuth sign-in for this platform
      // The signIn callback in auth.ts will detect the cookie and perform linking
      const signInUrl = new URL(`/api/auth/signin/${platform}`, baseUrl)
      signInUrl.searchParams.set('callbackUrl', '/profile')
      return NextResponse.redirect(signInUrl)
    }

    // For multi-redirect platforms (Twitch, Discord), use custom OAuth flow
    const state = OAuthLinkService.generateState()
    await OAuthLinkService.storeState(state, user_id, platform as LinkPlatform)

    const authUrl = OAuthLinkService.buildAuthUrl(platform as LinkPlatform, state)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth link initiation error:', error)
    return NextResponse.redirect(
      new URL('/profile?error=link_failed', request.url)
    )
  }
}
