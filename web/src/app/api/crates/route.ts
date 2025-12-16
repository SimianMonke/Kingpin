import { NextRequest } from 'next/server'
import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { CrateService } from '@/lib/services/crate.service'

/**
 * GET /api/crates
 * Get user's crate inventory including escrow and stats
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id

  // Get crate inventory
  const inventory = await CrateService.getCrates(user_id)

  // Check for history query param
  const url = new URL(request.url)
  const includeHistory = url.searchParams.get('history') === 'true'

  let history = undefined
  if (includeHistory) {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    history = await CrateService.getOpenHistory(user_id, limit)
  }

  return successResponse({
    ...inventory,
    history,
  })
})
