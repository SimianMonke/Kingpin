/**
 * POST /api/users/me/merge/initiate
 *
 * Initiates the account merge flow. User must authenticate with the
 * platform of the account they want to merge into their current account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthSession } from '@/lib/api-utils'

// Cookie name for merge intent
export const MERGE_INTENT_COOKIE = 'kingpin_merge_intent'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { platform } = body

    if (!platform || !['kick', 'twitch', 'discord'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform' },
        { status: 400 }
      )
    }

    const primaryUserId = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id

    // Create merge intent cookie (expires in 10 minutes)
    const mergeIntent = JSON.stringify({
      primary_user_id: primaryUserId,
      platform,
      expires: Date.now() + 10 * 60 * 1000,
    })

    const cookieStore = await cookies()
    cookieStore.set(MERGE_INTENT_COOKIE, mergeIntent, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Return the sign-in URL for the platform
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const signInUrl = `${baseUrl}/api/auth/signin/${platform}?callbackUrl=/profile?merge_pending=true`

    return NextResponse.json({
      success: true,
      signInUrl,
    })
  } catch (error) {
    console.error('Merge initiate error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initiate merge' },
      { status: 500 }
    )
  }
}
