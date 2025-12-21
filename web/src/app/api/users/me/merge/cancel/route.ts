/**
 * POST /api/users/me/merge/cancel
 *
 * Cancels a pending account merge.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthSession } from '@/lib/api-utils'

const MERGE_PENDING_COOKIE = 'kingpin_merge_pending'

export async function POST() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const cookieStore = await cookies()
    cookieStore.delete(MERGE_PENDING_COOKIE)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Merge cancel error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel merge' },
      { status: 500 }
    )
  }
}
