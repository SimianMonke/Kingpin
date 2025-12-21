import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { BondService } from '@/lib/services/bond.service'

/**
 * Check if request is from the bot (has valid API key)
 */
function isBotRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  return !!(apiKey && botKey && apiKey === botKey)
}

/**
 * GET /api/bonds/history
 * Get user's bond transaction history
 *
 * Query params:
 * - userId: (for bot) User's database ID
 * - limit: (optional) Number of transactions to return (default: 20, max: 100)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  const { searchParams } = new URL(request.url)

  if (isBotRequest(request)) {
    const userIdParam = searchParams.get('userId')
    if (!userIdParam) {
      return errorResponse('userId required for bot requests', 400)
    }
    user_id = parseInt(userIdParam, 10)
    if (isNaN(user_id)) {
      return errorResponse('Invalid userId', 400)
    }
  } else {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id
  }

  // Parse limit from query params
  let limit = 20
  const limitParam = searchParams.get('limit')
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 100) // Cap at 100
    }
  }

  const [status, transactions] = await Promise.all([
    BondService.getBondStatus(user_id),
    BondService.getTransactionHistory(user_id, limit),
  ])

  return successResponse({
    currentBonds: status.bonds,
    transactions: transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
      isCredit: t.amount > 0,
    })),
  })
})
