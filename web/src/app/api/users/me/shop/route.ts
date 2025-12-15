import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { ShopService } from '@/lib/services/shop.service'

/**
 * GET /api/users/me/shop
 * Get the current user's personal shop inventory
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const shop = await ShopService.getShopInventory(session.user.id)
  const stats = await ShopService.getShopStats(session.user.id)

  return successResponse({
    ...shop,
    stats,
  })
})
