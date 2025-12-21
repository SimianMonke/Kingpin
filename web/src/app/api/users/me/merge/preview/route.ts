/**
 * GET /api/users/me/merge/preview
 *
 * Returns a preview of what will happen when accounts are merged.
 * Requires a pending merge cookie set by the auth callback.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthSession } from '@/lib/api-utils'
import { AccountMergeService } from '@/lib/services/account-merge.service'

const MERGE_PENDING_COOKIE = 'kingpin_merge_pending'

interface PendingMerge {
  primary_user_id: number
  secondary_user_id: number
  platform: string
  expires: number
}

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const currentUserId = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id

    // Get pending merge from cookie
    const cookieStore = await cookies()
    const pendingCookie = cookieStore.get(MERGE_PENDING_COOKIE)

    if (!pendingCookie?.value) {
      return NextResponse.json(
        { success: false, error: 'No pending merge found' },
        { status: 400 }
      )
    }

    let pending: PendingMerge
    try {
      pending = JSON.parse(pendingCookie.value)
    } catch {
      cookieStore.delete(MERGE_PENDING_COOKIE)
      return NextResponse.json(
        { success: false, error: 'Invalid merge data' },
        { status: 400 }
      )
    }

    // Validate expiry
    if (Date.now() > pending.expires) {
      cookieStore.delete(MERGE_PENDING_COOKIE)
      return NextResponse.json(
        { success: false, error: 'Merge session expired' },
        { status: 400 }
      )
    }

    // Validate that current user is the primary user
    if (currentUserId !== pending.primary_user_id) {
      cookieStore.delete(MERGE_PENDING_COOKIE)
      return NextResponse.json(
        { success: false, error: 'Merge session invalid' },
        { status: 403 }
      )
    }

    // Get merge preview
    const preview = await AccountMergeService.getMergePreview(
      pending.primary_user_id,
      pending.secondary_user_id
    )

    // Convert BigInts to strings for JSON serialization
    return NextResponse.json({
      success: true,
      data: {
        primary: {
          ...preview.primary,
          wealth: preview.primary.wealth.toString(),
          xp: preview.primary.xp.toString(),
        },
        secondary: {
          ...preview.secondary,
          wealth: preview.secondary.wealth.toString(),
          xp: preview.secondary.xp.toString(),
        },
        result: {
          ...preview.result,
          wealth: preview.result.wealth.toString(),
          xp: preview.result.xp.toString(),
        },
        warnings: preview.warnings,
      },
    })
  } catch (error) {
    console.error('Merge preview error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get merge preview' },
      { status: 500 }
    )
  }
}
