/**
 * GET /api/auth/link/[platform]
 *
 * Initiates OAuth flow for linking an additional platform to the user's account.
 * Redirects to the platform's OAuth authorization page.
 *
 * SEC-01: This route ensures account linking happens through proper OAuth verification,
 * preventing identity theft attacks where users could claim others' platform IDs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/api-utils'
import { OAuthLinkService, LinkPlatform } from '@/lib/services/oauth-link.service'

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

    const userId = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id

    // Generate and store state token for CSRF protection
    const state = OAuthLinkService.generateState()
    await OAuthLinkService.storeState(state, userId, platform as LinkPlatform)

    // Build OAuth URL and redirect
    const authUrl = OAuthLinkService.buildAuthUrl(platform as LinkPlatform, state)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth link initiation error:', error)
    return NextResponse.redirect(
      new URL('/profile?error=link_failed', request.url)
    )
  }
}
