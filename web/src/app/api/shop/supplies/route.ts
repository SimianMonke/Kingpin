import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { ConsumableService } from '@/lib/services/consumable.service'
import { BuffService } from '@/lib/services/buff.service'

/**
 * GET /api/shop/supplies
 * Get the Supply Depot catalog with user's active buffs
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id

  // Fetch catalog, user's active buffs, and inventory in parallel
  const [consumables, userBuffs, userInventory, totalSpent] = await Promise.all([
    ConsumableService.getCatalog(),
    BuffService.getActiveBuffs(userId),
    ConsumableService.getUserInventory(userId),
    ConsumableService.getTotalSpent(userId),
  ])

  // Separate duration buffs from single-use items
  const durationBuffs = consumables.filter((c) => c.isDurationBuff && !c.isSingleUse)
  const singleUseItems = consumables.filter((c) => c.isSingleUse)

  return successResponse({
    catalog: {
      durationBuffs,
      singleUseItems,
      all: consumables,
    },
    userBuffs: userBuffs.filter((b) => b.source === 'consumable'),
    userInventory,
    stats: {
      totalSpent,
      activeBuffCount: userBuffs.filter((b) => b.source === 'consumable').length,
      inventoryItemCount: userInventory.reduce((sum, i) => sum + i.quantity, 0),
    },
  })
})
