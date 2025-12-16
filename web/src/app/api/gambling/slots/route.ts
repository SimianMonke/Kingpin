import { NextRequest } from 'next/server'
import { GamblingService } from '@/lib/services'
import { withErrorHandling, successResponse, errorResponse, unauthorizedResponse, getAuthSession } from '@/lib/api-utils'

// GET /api/gambling/slots - Pre-check and jackpot info
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()
  if (!session?.user?.id) return unauthorizedResponse()

  const user_id = typeof session.user.id === 'string'
    ? parseInt(session.user.id, 10)
    : session.user.id
  const [preCheck, jackpot] = await Promise.all([
    GamblingService.canGamble(user_id),
    GamblingService.getJackpotInfo(),
  ])

  return successResponse({ ...preCheck, jackpot })
})

// POST /api/gambling/slots - Play slots
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Parse body ONCE at the start
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const apiKey = request.headers.get('x-api-key')
  let user_id: number

  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    // Bot request - validate user_id type
    if (!body.user_id || typeof body.user_id !== 'number') {
      return errorResponse('user_id required and must be a number', 400)
    }
    user_id = body.user_id
  } else {
    // Session request
    const session = await getAuthSession()
    if (!session?.user?.id) return unauthorizedResponse()
    user_id = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id
  }

  const wager_amount = BigInt((body.wager as number) || (body.amount as number) || 0)
  if (!wager_amount || wager_amount <= 0) {
    return errorResponse('Invalid wager amount', 400)
  }

  const result = await GamblingService.playSlots(user_id, wager_amount)
  return successResponse(result)
})
