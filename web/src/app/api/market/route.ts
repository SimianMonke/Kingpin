import {
  successResponse,
  errorResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { BlackMarketService } from '@/lib/services/black-market.service'

/**
 * GET /api/market
 * Get the current Black Market inventory (public, no auth required)
 */
export const GET = withErrorHandling(async () => {
  const market = await BlackMarketService.getMarketInventory()

  if (!market) {
    return errorResponse('Black Market is currently unavailable', 503)
  }

  return successResponse(market)
})
