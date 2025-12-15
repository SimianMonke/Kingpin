import { NextRequest } from 'next/server'
import { GamblingService } from '@/lib/services'
import { withErrorHandling, successResponse, errorResponse, unauthorizedResponse, getAuthSession } from '@/lib/api-utils'

// GET /api/gambling/slots - Pre-check and jackpot info
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()
  if (!session?.user?.id) return unauthorizedResponse()

  const userId = typeof session.user.id === 'string'
    ? parseInt(session.user.id, 10)
    : session.user.id
  const [preCheck, jackpot] = await Promise.all([
    GamblingService.canGamble(userId),
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
  let userId: number

  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    // Bot request - validate userId type
    if (!body.userId || typeof body.userId !== 'number') {
      return errorResponse('userId required and must be a number', 400)
    }
    userId = body.userId
  } else {
    // Session request
    const session = await getAuthSession()
    if (!session?.user?.id) return unauthorizedResponse()
    userId = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id
  }

  const wagerAmount = BigInt((body.wager as number) || (body.amount as number) || 0)
  if (!wagerAmount || wagerAmount <= 0) {
    return errorResponse('Invalid wager amount', 400)
  }

  const result = await GamblingService.playSlots(userId, wagerAmount)
  return successResponse(result)
})
