import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { ConsumableService } from '@/lib/services/consumable.service'

interface UseRequest {
  consumableId: string
}

/**
 * POST /api/shop/supplies/use
 * Use a single-use consumable from inventory
 *
 * Note: This endpoint decrements the consumable count and returns success.
 * The actual effect application is handled by the caller (e.g., jail service for bail_bond,
 * shop service for reroll_token, crate service for crate_magnet).
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<UseRequest>(request)

  if (!body.consumableId) {
    return errorResponse('consumableId is required')
  }

  const result = await ConsumableService.useConsumable(session.user.id, body.consumableId)

  if (!result.success) {
    return errorResponse(result.reason ?? 'Failed to use consumable')
  }

  return successResponse({
    success: true,
    consumableName: result.consumableName,
    quantityRemaining: result.quantityRemaining,
    message: `Used ${result.consumableName}. ${result.quantityRemaining} remaining.`,
  })
})
