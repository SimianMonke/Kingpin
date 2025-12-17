import { NextRequest } from 'next/server'
import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { StreamActionService } from '@/lib/services/stream-action.service'

/**
 * GET /api/shop/stream-actions/history
 * Get user's stream action history
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id

  // Parse query params
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const sessionIdParam = searchParams.get('sessionId')

  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20
  const sessionId = sessionIdParam ? parseInt(sessionIdParam, 10) : undefined

  const history = await StreamActionService.getUserHistory(userId, sessionId, limit)

  return successResponse({
    history,
    count: history.length,
  })
})
