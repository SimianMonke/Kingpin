import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { ConsumableService } from '@/lib/services/consumable.service'

/**
 * GET /api/shop/supplies/inventory
 * Get user's owned single-use consumables
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const inventory = await ConsumableService.getUserInventory(session.user.id)

  return successResponse({
    inventory,
    totalItems: inventory.reduce((sum, item) => sum + item.quantity, 0),
  })
})
