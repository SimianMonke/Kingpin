import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { JuicernautService } from '@/lib/services'
import { getLumiaSdkService } from '@/lib/services/lumia-sdk.service'

// =============================================================================
// GET /api/juicernaut - Get current session status and leaderboard
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const includeHistory = searchParams.get('history') === 'true'
    const includeHallOfFame = searchParams.get('halloffame') === 'true'
    const announceToStream = searchParams.get('announce') === 'true'

    // Get active session
    const session = await JuicernautService.getActiveSession()

    // If no active session
    if (!session) {
      // Optionally return hall of fame
      if (includeHallOfFame) {
        const hallOfFame = await JuicernautService.getHallOfFame(limit)
        return NextResponse.json({
          session: null,
          leaderboard: [],
          hallOfFame,
        })
      }

      return NextResponse.json({
        session: null,
        leaderboard: [],
      })
    }

    // Get session leaderboard
    const leaderboard = await JuicernautService.getSessionLeaderboard(
      session.id,
      limit
    )

    // Optionally get crown history
    let crownHistory = null
    if (includeHistory) {
      crownHistory = await JuicernautService.getCrownHistory(session.id)
    }

    // Optionally get hall of fame
    let hallOfFame = null
    if (includeHallOfFame) {
      hallOfFame = await JuicernautService.getHallOfFame(limit)
    }

    // Trigger Lumia leaderboard effect if announcing to stream
    if (announceToStream && leaderboard.length > 0) {
      const lumia = getLumiaSdkService()
      // Fire and forget - don't block API response
      lumia.init().then(() => {
        const top3 = leaderboard.slice(0, 3).map((entry) => ({
          name: entry.username,
          totalUsd: entry.totalUsd,
        }))
        lumia.triggerLeaderboardAnnounce(top3, session.total_contributions_usd)
      }).catch((err) => {
        console.warn('[Lumia] Failed to trigger leaderboard announce:', err)
      })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        platform: session.platform,
        is_active: session.is_active,
        started_at: session.started_at,
        total_contributions_usd: session.total_contributions_usd,
        current_juicernaut: session.current_juicernaut,
      },
      leaderboard,
      ...(crownHistory && { crownHistory }),
      ...(hallOfFame && { hallOfFame }),
    })
  } catch (error) {
    console.error('Error fetching Juicernaut status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Juicernaut status' },
      { status: 500 }
    )
  }
}
