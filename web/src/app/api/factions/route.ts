import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services'

// =============================================================================
// GET /api/factions - List all factions
// =============================================================================

export const GET = withErrorHandling(async () => {
  const factions = await FactionService.getAllFactions()

  return successResponse({
    factions,
  })
})

// =============================================================================
// POST /api/factions - Join a faction
// =============================================================================

interface JoinFactionBody {
  faction_name: string
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id
  const body = await parseJsonBody<JoinFactionBody>(request)

  if (!body.faction_name) {
    return errorResponse('Faction name is required')
  }

  const result = await FactionService.joinFaction(user_id, body.faction_name)

  if (!result.success) {
    return errorResponse(result.error ?? 'Failed to join faction')
  }

  return successResponse({
    message: `Welcome to ${result.faction?.name}!`,
    faction: result.faction,
    assignedTerritory: result.assignedTerritory,
  })
})
