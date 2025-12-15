import {
  successResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { JailService } from '@/lib/services/jail.service'

/**
 * GET /api/users/me/cooldowns
 * Get all active cooldowns for the current user
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const [jailStatus, allCooldowns] = await Promise.all([
    JailService.getJailStatus(session.user.id),
    JailService.getAllCooldowns(session.user.id),
  ])

  return successResponse({
    jail: jailStatus,
    cooldowns: allCooldowns,
  })
})
