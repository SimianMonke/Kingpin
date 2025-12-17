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

interface PurchaseRequest {
  consumableId: string
}

/**
 * POST /api/shop/supplies/purchase
 * Purchase a consumable from the Supply Depot
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<PurchaseRequest>(request)

  if (!body.consumableId) {
    return errorResponse('consumableId is required')
  }

  const result = await ConsumableService.purchase(session.user.id, body.consumableId)

  if (!result.success) {
    return errorResponse(result.reason ?? 'Failed to purchase consumable')
  }

  // Build response message based on what happened
  let message = `Purchased ${result.consumableName} for $${result.pricePaid?.toLocaleString()}`

  if (result.buffApplied) {
    if (result.wasUpgrade) {
      message += ' (Upgraded existing buff!)'
    } else if (result.wasExtension) {
      message += ' (Extended existing buff!)'
    } else if (result.wasDowngrade) {
      message += ' (Note: You have a higher tier buff active)'
    }
  }

  if (result.quantityNow !== undefined) {
    message += ` (Now owned: ${result.quantityNow})`
  }

  return successResponse({
    success: true,
    consumableName: result.consumableName,
    pricePaid: result.pricePaid,
    newWealth: result.newWealth?.toString(),
    buffApplied: result.buffApplied,
    wasExtension: result.wasExtension,
    wasUpgrade: result.wasUpgrade,
    wasDowngrade: result.wasDowngrade,
    quantityNow: result.quantityNow,
    message,
  })
})
