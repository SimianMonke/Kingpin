import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'
import type { Platform } from '@/types'

// =============================================================================
// GET /api/users/lookup
// Look up user by platform and platform user ID
// Used by bot to find users from chat
// =============================================================================

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require bot API key authentication
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return forbiddenResponse('Invalid API key')
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') as Platform | null
  const platformUserId = searchParams.get('platformUserId')

  // Validate parameters
  if (!platform || !['kick', 'twitch', 'discord'].includes(platform)) {
    return errorResponse('Invalid or missing platform parameter')
  }

  if (!platformUserId) {
    return errorResponse('Missing platformUserId parameter')
  }

  // Look up user
  const user = await UserService.findByPlatform(platform, platformUserId)

  if (!user) {
    return notFoundResponse('User not found')
  }

  // Get full profile
  const profile = await UserService.getProfile(user.id)

  return successResponse(profile)
})
