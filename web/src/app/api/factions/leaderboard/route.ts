import { NextRequest } from 'next/server'
import {
  successResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services'

// =============================================================================
// GET /api/factions/leaderboard - Get faction standings
// =============================================================================

export const GET = withErrorHandling(async () => {
  const standings = await FactionService.getFactionStandings()

  return successResponse({
    factions: standings.factions,
    period: standings.period,
    // Highlight the leading faction
    leader: standings.factions[0] ?? null,
  })
})
