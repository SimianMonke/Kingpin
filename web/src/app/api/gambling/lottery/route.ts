import { NextRequest } from 'next/server'
import { GamblingService } from '@/lib/services'
import { withErrorHandling, successResponse, errorResponse, unauthorizedResponse, getAuthSession } from '@/lib/api-utils'
import { GAMBLING_CONFIG } from '@/lib/game/constants'

// GET /api/gambling/lottery - Get current lottery and optionally user's tickets
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const myTickets = searchParams.get('myTickets') === 'true'

  const lottery = await GamblingService.getCurrentLottery()

  if (myTickets) {
    const session = await getAuthSession()
    if (session?.user?.id) {
      const user_id = typeof session.user.id === 'string'
        ? parseInt(session.user.id, 10)
        : session.user.id
      const tickets = await GamblingService.getUserLotteryTickets(user_id)
      return successResponse({ lottery, tickets })
    }
  }

  return successResponse({ lottery })
})

// POST /api/gambling/lottery - Buy a lottery ticket
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

  const { numbers } = body

  // Validate numbers array exists and is an array
  if (!numbers || !Array.isArray(numbers)) {
    return errorResponse('numbers array required', 400)
  }

  // Validate exact count of numbers
  const requiredCount = GAMBLING_CONFIG.LOTTERY_NUMBERS_COUNT || 3
  if (numbers.length !== requiredCount) {
    return errorResponse(`Exactly ${requiredCount} numbers required`, 400)
  }

  // Validate each number is an integer in valid range
  const maxNumber = GAMBLING_CONFIG.LOTTERY_NUMBER_MAX || 20
  for (const n of numbers) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > maxNumber) {
      return errorResponse(`Numbers must be integers between 1 and ${maxNumber}`, 400)
    }
  }

  // Check for duplicates
  if (new Set(numbers).size !== numbers.length) {
    return errorResponse('Numbers must be unique', 400)
  }

  const result = await GamblingService.buyLotteryTicket(user_id, numbers as number[])
  return successResponse(result)
})
