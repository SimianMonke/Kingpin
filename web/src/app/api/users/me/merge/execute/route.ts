/**
 * POST /api/users/me/merge/execute
 *
 * Executes the pending account merge.
 * Requires a pending merge cookie and user confirmation.
 */

import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
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

    // Get confirmation from body
    const body = await request.json()
    if (body.confirm !== 'MERGE') {
      return NextResponse.json(
        { success: false, error: 'Confirmation required. Send { confirm: "MERGE" }' },
        { status: 400 }
      )
    }

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
        { success: false, error: 'Merge session expired. Please start over.' },
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

    // Execute the merge
    const result = await AccountMergeService.executeMerge(
      pending.primary_user_id,
      pending.secondary_user_id
    )

    // Clear the pending cookie
    cookieStore.delete(MERGE_PENDING_COOKIE)

    return NextResponse.json({
      success: true,
      data: {
        mergedAt: result.mergedAt.toISOString(),
        summary: {
          ...result.summary,
          wealth_added: result.summary.wealth_added.toString(),
          xp_added: result.summary.xp_added.toString(),
        },
      },
    })
  } catch (error) {
    console.error('Merge execute error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to execute merge' },
      { status: 500 }
    )
  }
}
