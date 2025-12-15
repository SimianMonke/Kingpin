import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { BlackMarketService } from '@/lib/services/black-market.service'

interface MarketBuyRequest {
  marketId: number
}

/**
 * POST /api/market/buy
 * Purchase an item from the Black Market
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<MarketBuyRequest>(request)

  if (!body.marketId || typeof body.marketId !== 'number') {
    return errorResponse('marketId is required')
  }

  const result = await BlackMarketService.purchaseItem(session.user.id, body.marketId)

  if (!result.success) {
    return errorResponse(result.reason ?? 'Failed to purchase item')
  }

  return successResponse({
    success: true,
    itemName: result.itemName,
    pricePaid: result.pricePaid,
    newWealth: result.newWealth?.toString(),
    inventoryId: result.inventoryId,
    stockRemaining: result.stockRemaining,
    message: `Purchased ${result.itemName} for $${result.pricePaid?.toLocaleString()}`,
  })
})
