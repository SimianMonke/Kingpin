import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { InventoryService } from '@/lib/services/inventory.service'

/**
 * GET /api/users/me/inventory
 * Get the current user's inventory
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const [inventory, equipped, stats, escrowed] = await Promise.all([
    InventoryService.getInventory(session.user.id),
    InventoryService.getEquippedItems(session.user.id),
    InventoryService.getInventoryStats(session.user.id),
    InventoryService.getEscrowedItems(session.user.id),
  ])

  return successResponse({
    inventory,
    equipped,
    stats,
    escrowed,
  })
})
