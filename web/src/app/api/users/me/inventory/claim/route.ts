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

interface ClaimRequest {
  inventoryId: number
}

/**
 * POST /api/users/me/inventory/claim
 * Claim an item from escrow
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await parseJsonBody<ClaimRequest>(request)

  if (!body.inventoryId || typeof body.inventoryId !== 'number') {
    return errorResponse('inventoryId is required')
  }

  const result = await InventoryService.claimFromEscrow(session.user.id, body.inventoryId)

  if (!result.success) {
    return errorResponse(result.reason ?? 'Failed to claim item')
  }

  return successResponse({
    success: true,
    message: 'Item claimed from escrow',
  })
})
