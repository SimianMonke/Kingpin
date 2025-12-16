import { NextRequest } from 'next/server'
import {
  successResponse,
  notFoundResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * GET /api/users/[user_id]
 * Get a user's public profile by ID
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const params = await context?.params
  const user_id = params?.user_id

  if (!user_id) {
    return notFoundResponse('User ID required')
  }

  const profile = await UserService.getProfile(parseInt(user_id, 10))

  if (!profile) {
    return notFoundResponse('User not found')
  }

  // Return public profile (exclude sensitive data)
  const publicProfile = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    kingpin_name: profile.kingpin_name,
    level: profile.level,
    status_tier: profile.status_tier,
    faction_name: profile.faction_name,
    equippedTitle: profile.equippedTitle,
    total_play_count: profile.total_play_count,
    created_at: profile.created_at,
  }

  return successResponse(publicProfile)
})
