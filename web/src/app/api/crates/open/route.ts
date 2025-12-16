import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
  parseJsonBody,
} from '@/lib/api-utils'
import { CrateService } from '@/lib/services/crate.service'

interface OpenCrateBody {
  user_id?: number  // HIGH-06: For bot requests
  crateId?: number
  count?: number
}

/**
 * POST /api/crates/open
 * Open one or more crates
 *
 * Body:
 * - user_id?: number - User ID (required for bot requests with x-api-key)
 * - crateId?: number - Specific crate to open (opens oldest if not specified)
 * - count?: number - Number of crates to open (batch mode)
 *
 * If both are specified, crateId is ignored and batch mode is used
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Parse request body first
  let body: OpenCrateBody = {}
  try {
    body = await parseJsonBody<OpenCrateBody>(request)
  } catch {
    // Empty body is okay - will open oldest crate
  }

  // HIGH-06 fix: Support bot authentication
  const apiKey = request.headers.get('x-api-key')
  let user_id: number

  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    // Bot request
    if (!body.user_id || typeof body.user_id !== 'number') {
      return errorResponse('user_id required and must be a number', 400)
    }
    user_id = body.user_id
  } else {
    // Session request
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }
    // Handle both string and number user_id from session
    user_id = typeof session.user.id === 'string'
      ? parseInt(session.user.id, 10)
      : session.user.id
  }

  const { crateId, count } = body

  // Batch mode
  if (count && count > 1) {
    const result = await CrateService.batchOpen(user_id, Math.min(count, 10)) // Cap at 10

    if (!result.success && result.results.length === 0) {
      return errorResponse(result.stats.stopReason || 'Failed to open crates')
    }

    return successResponse(result)
  }

  // Single crate mode
  const result = await CrateService.openCrate(user_id, crateId)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to open crate')
  }

  return successResponse(result)
})
