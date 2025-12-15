import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { InventoryService } from '@/lib/services/inventory.service'

interface SellRequest {
  inventoryId: number
}

/**
 * POST /api/users/me/inventory/sell
 * Sell an item from inventory
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<SellRequest>(request)

  if (!body.inventoryId || typeof body.inventoryId !== 'number') {
    return errorResponse('inventoryId is required')
  }

  try {
    const result = await InventoryService.sellItem(session.user.id, body.inventoryId)

    return successResponse({
      success: result.success,
      itemName: result.itemName,
      wealthGained: result.wealthGained,
      message: `Sold ${result.itemName} for $${result.wealthGained.toLocaleString()}`,
    })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to sell item')
  }
})
