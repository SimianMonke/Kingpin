import { NextRequest } from 'next/server'
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

// =============================================================================
// GET /api/users/by-name/[username]
// Look up user by username, display name, or kingpin name
// Used by bot for commands like !profile @user and !rob target
// =============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  // Require bot API key authentication
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return forbiddenResponse('Invalid API key')
  }

  const params = await context?.params
  const username = params?.username

  if (!username) {
    return notFoundResponse('Username required')
  }

  // Look up user by username (case-insensitive, checks username, display_name, kingpin_name)
  const user = await UserService.findByUsername(username)

  if (!user) {
    return notFoundResponse('User not found')
  }

  // Get full profile
  const profile = await UserService.getProfile(user.id)

  return successResponse(profile)
})
