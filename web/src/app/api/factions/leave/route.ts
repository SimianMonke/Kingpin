import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services'

// =============================================================================
// POST /api/factions/leave - Leave current faction
// =============================================================================

export const POST = withErrorHandling(async () => {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id
  const result = await FactionService.leaveFaction(user_id)

  if (!result.success) {
    return errorResponse(result.error ?? 'Failed to leave faction')
  }

  return successResponse({
    message: 'You have left your faction.',
    cooldownUntil: result.cooldownUntil,
    cooldownDays: 7,
  })
})
