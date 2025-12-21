import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * GET /api/users/me
 * Get the current authenticated user's profile
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const profile = await UserService.getProfile(session.user.id)

  if (!profile) {
    return errorResponse('User not found', 404)
  }

  // Transform to frontend-expected format
  const response = {
    id: String(profile.id),
    kingpin_name: profile.kingpin_name,
    wealth: Number(profile.wealth),
    level: profile.level,
    xp: Number(profile.xp),
    tier: profile.status_tier,
    checkInStreak: profile.checkin_streak,
    lastCheckIn: profile.last_checkin_date?.toISOString() || null,
    created_at: profile.created_at.toISOString(),
    linkedAccounts: {
      kick: profile.kick_user_id
        ? { id: profile.kick_user_id, username: profile.username }
        : null,
      twitch: profile.twitch_user_id
        ? { id: profile.twitch_user_id, username: profile.username }
        : null,
      discord: profile.discord_user_id
        ? { id: profile.discord_user_id, username: profile.discord_username || profile.username }
        : null,
    },
  }

  return successResponse(response)
})

/**
 * PATCH /api/users/me
 * Update the current user's profile
 */
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const body = await request.json()

  // Handle Kingpin name update
  if (body.kingpin_name !== undefined) {
    try {
      await UserService.setKingpinName(session.user.id, body.kingpin_name)
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Failed to update name')
    }
  }

  // Return updated profile in frontend-expected format
  const profile = await UserService.getProfile(session.user.id)

  if (!profile) {
    return errorResponse('User not found', 404)
  }

  const response = {
    id: String(profile.id),
    kingpin_name: profile.kingpin_name,
    wealth: Number(profile.wealth),
    level: profile.level,
    xp: Number(profile.xp),
    tier: profile.status_tier,
    checkInStreak: profile.checkin_streak,
    lastCheckIn: profile.last_checkin_date?.toISOString() || null,
    created_at: profile.created_at.toISOString(),
    linkedAccounts: {
      kick: profile.kick_user_id
        ? { id: profile.kick_user_id, username: profile.username }
        : null,
      twitch: profile.twitch_user_id
        ? { id: profile.twitch_user_id, username: profile.username }
        : null,
      discord: profile.discord_user_id
        ? { id: profile.discord_user_id, username: profile.discord_username || profile.username }
        : null,
    },
  }

  return successResponse(response)
})
