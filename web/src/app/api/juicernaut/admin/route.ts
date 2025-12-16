import { NextRequest, NextResponse } from 'next/server'
import { JuicernautService } from '@/lib/services'

// =============================================================================
// JUICERNAUT ADMIN API
// Requires ADMIN_API_KEY header for authentication
// =============================================================================

/**
 * Verify admin API key
 */
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    console.error('ADMIN_API_KEY not configured')
    return false
  }

  const providedKey = request.headers.get('x-api-key')
  return providedKey === adminKey
}

// =============================================================================
// POST /api/juicernaut/admin - Session control (start/end)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    if (!verifyAdminKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, platform, title, session_id } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start': {
        if (!platform) {
          return NextResponse.json(
            { error: 'Missing platform parameter' },
            { status: 400 }
          )
        }

        // Start new session
        const session = await JuicernautService.startSession(platform, title)

        console.log(
          `Juicernaut session started: ${session.id} on ${platform}`
        )

        return NextResponse.json({
          success: true,
          action: 'start',
          session: {
            id: session.id,
            title: session.title,
            platform: session.platform,
            is_active: session.is_active,
            started_at: session.started_at,
          },
        })
      }

      case 'end': {
        // End session
        let targetSessionId = session_id

        // If no session ID provided, end the active session
        if (!targetSessionId) {
          const activeSession = await JuicernautService.getActiveSession()
          if (!activeSession) {
            return NextResponse.json(
              { error: 'No active session to end' },
              { status: 400 }
            )
          }
          targetSessionId = activeSession.id
        }

        const result = await JuicernautService.endSession(targetSessionId)

        console.log(
          `Juicernaut session ended: ${targetSessionId}, Winner: ${result.winnerUsername || 'None'}`
        )

        return NextResponse.json({
          success: true,
          action: 'end',
          session_id: targetSessionId,
          winner: result.winner_id
            ? {
                user_id: result.winner_id,
                username: result.winnerUsername,
                totalContributedUsd: result.totalContributedUsd,
                rewards: result.rewards,
              }
            : null,
        })
      }

      case 'status': {
        // Get current session status (admin view)
        const session = await JuicernautService.getActiveSession()

        if (!session) {
          return NextResponse.json({
            success: true,
            action: 'status',
            session: null,
          })
        }

        const leaderboard = await JuicernautService.getSessionLeaderboard(
          session.id,
          20
        )
        const crownHistory = await JuicernautService.getCrownHistory(session.id)

        return NextResponse.json({
          success: true,
          action: 'status',
          session,
          leaderboard,
          crownHistory,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Juicernaut admin error:', error)

    // HIGH-05 fix: Don't expose error details in production
    const isDev = process.env.NODE_ENV === 'development'
    if (error instanceof Error) {
      return NextResponse.json(
        { error: isDev ? error.message : 'Operation failed' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET /api/juicernaut/admin - Admin status check
// =============================================================================

export async function GET(request: NextRequest) {
  // Verify admin authentication
  if (!verifyAdminKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const session = await JuicernautService.getActiveSession()
    const hallOfFame = await JuicernautService.getHallOfFame(5)

    let leaderboard = null
    let crownHistory = null

    if (session) {
      leaderboard = await JuicernautService.getSessionLeaderboard(session.id, 20)
      crownHistory = await JuicernautService.getCrownHistory(session.id)
    }

    return NextResponse.json({
      configured: !!process.env.ADMIN_API_KEY,
      activeSession: session,
      leaderboard,
      crownHistory,
      hallOfFame,
    })
  } catch (error) {
    console.error('Juicernaut admin status error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin status' },
      { status: 500 }
    )
  }
}
