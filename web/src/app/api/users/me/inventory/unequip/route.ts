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
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '@/lib/game'

interface UnequipRequest {
  slot: EquipmentSlot
}

/**
 * POST /api/users/me/inventory/unequip
 * Unequip an item from a slot
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<UnequipRequest>(request)

  if (!body.slot || !EQUIPMENT_SLOTS.includes(body.slot)) {
    return errorResponse(`Invalid slot. Must be one of: ${EQUIPMENT_SLOTS.join(', ')}`)
  }

  const result = await InventoryService.unequipSlot(session.user.id, body.slot)

  if (!result.success) {
    return errorResponse(`No item equipped in ${body.slot} slot`)
  }

  return successResponse({
    success: true,
    unequippedItem: result.unequippedItem,
    message: `Unequipped ${result.unequippedItem?.itemName ?? 'item'}`,
  })
})
