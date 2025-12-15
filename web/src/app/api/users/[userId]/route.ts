import { NextRequest } from 'next/server'
import {
  successResponse,
  notFoundResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'

/**
 * GET /api/users/[userId]
 * Get a user's public profile by ID
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const params = await context?.params
  const userId = params?.userId

  if (!userId) {
    return notFoundResponse('User ID required')
  }

  const profile = await UserService.getProfile(parseInt(userId, 10))

  if (!profile) {
    return notFoundResponse('User not found')
  }

  // Return public profile (exclude sensitive data)
  const publicProfile = {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    kingpinName: profile.kingpinName,
    level: profile.level,
    statusTier: profile.statusTier,
    factionName: profile.factionName,
    equippedTitle: profile.equippedTitle,
    totalPlayCount: profile.totalPlayCount,
    createdAt: profile.createdAt,
  }

  return successResponse(publicProfile)
})
