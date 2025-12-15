import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { TitleService } from '@/lib/services/title.service'

/**
 * GET /api/titles
 * Get all unlocked titles for user
 */
export const GET = withErrorHandling(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id

  const [titles, equipped] = await Promise.all([
    TitleService.getTitles(userId),
    TitleService.getEquippedTitle(userId),
  ])

  return successResponse({
    titles,
    equippedTitle: equipped,
    totalCount: titles.length,
  })
})

/**
 * POST /api/titles
 * Equip or unequip a title
 * Body: { title: string | null }
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const userId = session.user.id
  const body = await request.json()

  const { title } = body

  // Unequip if null
  if (title === null || title === undefined) {
    const result = await TitleService.unequipTitle(userId)
    return successResponse(result)
  }

  if (typeof title !== 'string' || title.trim() === '') {
    return errorResponse('Invalid title', 400)
  }

  const result = await TitleService.equipTitle(userId, title.trim())

  if (!result.success) {
    return errorResponse(result.error ?? 'Unable to equip title', 400)
  }

  return successResponse(result)
})
