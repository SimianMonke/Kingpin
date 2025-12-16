import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  forbiddenResponse,
  withErrorHandling,
  parseJsonBody,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'
import { CrateService } from '@/lib/services/crate.service'
import { CRATE_SOURCES, CRATE_TIERS } from '@/lib/game'
import type { CrateTier } from '@/lib/game'

// =============================================================================
// POST /api/admin/give
// Admin endpoint to give wealth, XP, or crates to a user
// Used by bot for broadcaster commands like !givewealth, !givexp, !givecrate
// =============================================================================

interface GiveRequest {
  user_id: number
  type: 'wealth' | 'xp' | 'crate'
  amount?: number  // For wealth and XP
  crate_tier?: CrateTier  // For crate
}

interface GiveResponse {
  success: boolean
  type: string
  user_id: number
  amount?: number
  crate_tier?: string
  crateId?: number
  levelUp?: boolean
  newLevel?: number
  tierPromotion?: boolean
  newTier?: string
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Require admin API key authentication
  const apiKey = request.headers.get('x-api-key')
  const adminKey = process.env.ADMIN_API_KEY

  if (!apiKey || !adminKey || apiKey !== adminKey) {
    return forbiddenResponse('Invalid admin API key')
  }

  const body = await parseJsonBody<GiveRequest>(request)

  // Validate request
  if (!body.user_id || !body.type) {
    return errorResponse('Missing required fields: user_id and type')
  }

  if (!['wealth', 'xp', 'crate'].includes(body.type)) {
    return errorResponse('Invalid type. Must be wealth, xp, or crate')
  }

  // Verify user exists
  const user = await UserService.findById(body.user_id)
  if (!user) {
    return notFoundResponse('User not found')
  }

  let response: GiveResponse = {
    success: true,
    type: body.type,
    user_id: body.user_id,
  }

  switch (body.type) {
    case 'wealth': {
      if (!body.amount || body.amount <= 0) {
        return errorResponse('Amount must be a positive number')
      }

      await UserService.addWealth(body.user_id, body.amount)
      response.amount = body.amount
      break
    }

    case 'xp': {
      if (!body.amount || body.amount <= 0) {
        return errorResponse('Amount must be a positive number')
      }

      const xpResult = await UserService.addXp(body.user_id, body.amount)
      response.amount = body.amount
      response.levelUp = xpResult.levelUp
      response.newLevel = xpResult.newLevel
      response.tierPromotion = xpResult.tierPromotion
      response.newTier = xpResult.newTier
      break
    }

    case 'crate': {
      const tier = body.crate_tier || 'common'
      const validTiers = Object.keys(CRATE_TIERS)

      if (!validTiers.includes(tier)) {
        return errorResponse(`Invalid crate tier. Must be one of: ${validTiers.join(', ')}`)
      }

      const crateResult = await CrateService.awardCrate(
        body.user_id,
        tier as CrateTier,
        CRATE_SOURCES.GIFT
      )

      if (!crateResult.success) {
        return errorResponse(crateResult.reason || 'Failed to award crate')
      }

      response.crate_tier = tier
      response.crateId = crateResult.crateId
      break
    }
  }

  return successResponse(response)
})
