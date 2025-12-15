/**
 * GET /api/auth/link/[platform]/callback
 *
 * Handles OAuth callback for account linking.
 * Verifies the state, exchanges code for tokens, gets verified user info,
 * and links the platform to the user's account.
 *
 * SEC-01: This ensures platform ownership is verified through OAuth,
 * preventing identity theft attacks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { OAuthLinkService, LinkPlatform } from '@/lib/services/oauth-link.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error from ${platform}:`, error)
    return NextResponse.redirect(
      new URL(`/profile?error=oauth_denied&platform=${platform}`, request.url)
    )
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/profile?error=invalid_callback', request.url)
    )
  }

  // Validate platform
  if (!OAuthLinkService.isValidPlatform(platform)) {
    return NextResponse.redirect(
      new URL('/profile?error=invalid_platform', request.url)
    )
  }

  try {
    // Verify state token (CSRF protection)
    const stateData = await OAuthLinkService.verifyState(state)
    if (!stateData) {
      console.error('Invalid or expired state token')
      return NextResponse.redirect(
        new URL('/profile?error=invalid_state', request.url)
      )
    }

    // Ensure platform matches
    if (stateData.platform !== platform) {
      console.error('Platform mismatch:', { expected: stateData.platform, got: platform })
      return NextResponse.redirect(
        new URL('/profile?error=platform_mismatch', request.url)
      )
    }

    // Exchange code for access token
    const tokens = await OAuthLinkService.exchangeCodeForTokens(
      platform as LinkPlatform,
      code
    )

    // Get verified user info from platform
    const platformUser = await OAuthLinkService.getPlatformUser(
      platform as LinkPlatform,
      tokens.accessToken
    )

    // Check if this platform ID is already linked to another user
    const linkStatus = await OAuthLinkService.isPlatformIdLinked(
      platform as LinkPlatform,
      platformUser.id
    )

    if (linkStatus.isLinked) {
      if (linkStatus.userId === stateData.userId) {
        // Already linked to this user - success (no-op)
        return NextResponse.redirect(
          new URL(`/profile?success=already_linked&platform=${platform}`, request.url)
        )
      } else {
        // Linked to a different user - cannot link
        console.error(`Platform ${platform} ID ${platformUser.id} already linked to user ${linkStatus.userId}`)
        return NextResponse.redirect(
          new URL(`/profile?error=already_linked_other&platform=${platform}`, request.url)
        )
      }
    }

    // Link the verified platform to user's account
    await OAuthLinkService.linkPlatform(
      stateData.userId,
      platform as LinkPlatform,
      platformUser.id,
      platformUser.username
    )

    // Success!
    console.log(`Successfully linked ${platform} account ${platformUser.id} (${platformUser.username}) to user ${stateData.userId}`)
    return NextResponse.redirect(
      new URL(`/profile?success=linked&platform=${platform}`, request.url)
    )
  } catch (error) {
    console.error(`OAuth callback error for ${platform}:`, error)
    return NextResponse.redirect(
      new URL(`/profile?error=link_failed&platform=${platform}`, request.url)
    )
  }
}
