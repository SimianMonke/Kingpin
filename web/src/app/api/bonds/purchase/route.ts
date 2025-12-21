import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { BondService } from '@/lib/services/bond.service'
import { BOND_CONFIG } from '@/lib/game'

/**
 * Check if request is from the bot (has valid API key)
 */
function isBotRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const botKey = process.env.BOT_API_KEY
  return !!(apiKey && botKey && apiKey === botKey)
}

/**
 * GET /api/bonds/purchase
 * Get available items to purchase with bonds
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  if (isBotRequest(request)) {
    const { searchParams } = new URL(request.url)
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

  const status = await BondService.getBondStatus(user_id)

  return successResponse({
    currentBonds: status.bonds,
    cosmetics: Object.entries(BOND_CONFIG.COSMETICS).map(([type, cost]) => ({
      type,
      cost,
      canAfford: status.bonds >= cost,
    })),
    seasonPass: {
      cost: BOND_CONFIG.SEASON_PASS.COST,
      durationDays: BOND_CONFIG.SEASON_PASS.DURATION_DAYS,
      canAfford: status.bonds >= BOND_CONFIG.SEASON_PASS.COST,
    },
  })
})

/**
 * POST /api/bonds/purchase
 * Purchase cosmetics or season pass with bonds
 *
 * Body:
 * - userId: (for bot) User's database ID
 * - type: 'cosmetic' | 'season_pass'
 * - cosmetic_type: (for cosmetics) 'CUSTOM_TITLE' | 'PROFILE_FRAME' | 'NAME_COLOR' | 'CHAT_BADGE'
 * - cosmetic_name: (optional) Custom name for the cosmetic (e.g., custom title text)
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  let user_id: number

  let body: {
    userId?: number
    type?: string
    cosmetic_type?: string
    cosmetic_name?: string
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid request body', 400)
  }

  if (isBotRequest(request)) {
    if (!body.userId || typeof body.userId !== 'number') {
      return errorResponse('userId required for bot requests', 400)
    }
    user_id = body.userId
  } else {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    user_id = session.user.id
  }

  const { type, cosmetic_type, cosmetic_name } = body

  if (!type) {
    return errorResponse('Purchase type required (cosmetic or season_pass)', 400)
  }

  if (type === 'season_pass') {
    const result = await BondService.purchaseSeasonPass(user_id)

    if (!result.success) {
      return errorResponse(result.error || 'Failed to purchase season pass', 400)
    }

    return successResponse({
      success: true,
      type: 'season_pass',
      cost: result.cost,
      expiresAt: result.expiresAt,
      remainingBonds: 0, // Would need to fetch updated balance
      message: `Season pass purchased! Expires ${result.expiresAt?.toLocaleDateString()}`,
    })
  }

  if (type === 'cosmetic') {
    if (!cosmetic_type) {
      return errorResponse('cosmetic_type required for cosmetic purchases', 400)
    }

    // Validate cosmetic type
    const validTypes = Object.keys(BOND_CONFIG.COSMETICS)
    if (!validTypes.includes(cosmetic_type)) {
      return errorResponse(
        `Invalid cosmetic_type. Valid types: ${validTypes.join(', ')}`,
        400
      )
    }

    const result = await BondService.purchaseCosmetic(
      user_id,
      cosmetic_type as keyof typeof BOND_CONFIG.COSMETICS,
      cosmetic_name
    )

    if (!result.success) {
      return errorResponse(result.error || 'Failed to purchase cosmetic', 400)
    }

    return successResponse({
      success: true,
      type: 'cosmetic',
      cosmetic_type,
      cosmetic_name,
      cost: result.cost,
      remainingBonds: result.remainingBonds,
      message: `Purchased ${cosmetic_type.toLowerCase().replace('_', ' ')}!`,
    })
  }

  return errorResponse('Invalid purchase type. Use "cosmetic" or "season_pass"', 400)
})
