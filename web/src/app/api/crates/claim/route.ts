import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { CrateService } from '@/lib/services/crate.service'

interface ClaimCrateBody {
  crateId: number
}

/**
 * POST /api/crates/claim
 * Claim a crate from escrow to main inventory
 *
 * Body:
 * - crateId: number - The escrowed crate to claim
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id
  const body = await parseJsonBody<ClaimCrateBody>(request)

  if (!body.crateId) {
    return errorResponse('crateId is required')
  }

  const result = await CrateService.claimFromEscrow(userId, body.crateId)

  if (!result.success) {
    return errorResponse(result.reason || 'Failed to claim crate')
  }

  // Return updated inventory
  const inventory = await CrateService.getCrates(userId)

  return successResponse({
    claimed: true,
    inventory,
  })
})
