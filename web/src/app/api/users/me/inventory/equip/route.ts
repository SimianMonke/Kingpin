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

interface EquipRequest {
  inventoryId: number
}

/**
 * POST /api/users/me/inventory/equip
 * Equip an item from inventory
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<EquipRequest>(request)

  if (!body.inventoryId || typeof body.inventoryId !== 'number') {
    return errorResponse('inventoryId is required')
  }

  try {
    const result = await InventoryService.equipItem(session.user.id, body.inventoryId)

    return successResponse({
      success: result.success,
      previousItem: result.previousItem,
      message: result.previousItem
        ? `Equipped item, replacing ${result.previousItem.itemName}`
        : 'Item equipped',
    })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to equip item')
  }
})
