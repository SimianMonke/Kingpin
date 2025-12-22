import { NextRequest } from 'next/server'
import {
  successResponse,
  notFoundResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { UserService } from '@/lib/services/user.service'
import { InsuranceService } from '@/lib/services/insurance.service'

// =============================================================================
// GET /api/users/by-name/[username]
// Look up user by username, display name, or kingpin name
// Used by bot for commands like !profile @user and !rob target
// Also used by web for target selection in rob tab
// =============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  // Allow either bot API key OR authenticated session
  const apiKey = request.headers.get('x-api-key')
  const isBotRequest = apiKey && apiKey === process.env.BOT_API_KEY

  if (!isBotRequest) {
    // Check for session auth
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
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

  // Get full profile and insurance status
  const [profile, insuranceStatus] = await Promise.all([
    UserService.getProfile(user.id),
    InsuranceService.getInsuranceStatus(user.id),
  ])

  // Add rob-specific fields for target selection
  return successResponse({
    ...profile,
    // Map status_tier to tier for frontend compatibility
    tier: profile?.status_tier,
    // Include insurance info for rob target display
    insuranceTier: insuranceStatus.tier,
    insuranceProtection: insuranceStatus.protection,
  })
})
