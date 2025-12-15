import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { ShopService } from '@/lib/services/shop.service'

interface BuyRequest {
  shopItemId?: number
  itemName?: string
}

/**
 * POST /api/users/me/shop/buy
 * Purchase an item from the player's personal shop
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<BuyRequest>(request)

  let shopItemId: number | undefined = body.shopItemId

  // If itemName provided instead of ID, look it up
  if (!shopItemId && body.itemName) {
    const item = await ShopService.findShopItemByName(session.user.id, body.itemName)
    if (!item) {
      return errorResponse(`Item "${body.itemName}" not found in your shop`)
    }
    shopItemId = item.shopItemId
  }

  if (!shopItemId) {
    return errorResponse('shopItemId or itemName is required')
  }

  const result = await ShopService.purchaseItem(session.user.id, shopItemId)

  if (!result.success) {
    return errorResponse(result.reason ?? 'Failed to purchase item')
  }

  return successResponse({
    success: true,
    itemName: result.itemName,
    pricePaid: result.pricePaid,
    newWealth: result.newWealth?.toString(),
    inventoryId: result.inventoryId,
    message: `Purchased ${result.itemName} for $${result.pricePaid?.toLocaleString()}`,
  })
})
