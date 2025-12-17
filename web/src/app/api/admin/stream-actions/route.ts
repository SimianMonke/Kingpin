import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  withErrorHandling,
  parseJsonBody,
} from '@/lib/api-utils'
import { prisma } from '@/lib/db'

// =============================================================================
// GET /api/admin/stream-actions
// List all stream actions (including inactive) for admin management
// =============================================================================

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin API key authentication
  const apiKey = request.headers.get('x-api-key')
  const adminKey = process.env.ADMIN_API_KEY

  if (!apiKey || !adminKey || apiKey !== adminKey) {
    return forbiddenResponse('Invalid admin API key')
  }

  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('includeInactive') !== 'false'
  const category = searchParams.get('category')

  const actions = await prisma.stream_action_types.findMany({
    where: {
      ...(includeInactive ? {} : { is_active: true }),
      ...(category ? { category } : {}),
    },
    orderBy: [
      { category: 'asc' },
      { sort_order: 'asc' },
    ],
  })

  return successResponse({
    actions: actions.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      cost: a.cost,
      cooldownSeconds: a.cooldown_seconds,
      limitPerStream: a.limit_per_stream,
      lumiaCommandId: a.lumia_command_id,
      queueBehavior: a.queue_behavior,
      maxCharacters: a.max_characters,
      isActive: a.is_active ?? true,
      sortOrder: a.sort_order ?? 0,
      createdAt: a.created_at,
    })),
    total: actions.length,
  })
})

// =============================================================================
// POST /api/admin/stream-actions
// Create a new stream action
// =============================================================================

interface CreateStreamActionRequest {
  id: string
  name: string
  description?: string
  category: 'lights' | 'fog' | 'sound' | 'tts'
  cost: number
  cooldownSeconds: number
  limitPerStream?: number
  lumiaCommandId?: string
  queueBehavior?: 'overwrite' | 'queue'
  maxCharacters?: number
  sortOrder?: number
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Require admin API key authentication
  const apiKey = request.headers.get('x-api-key')
  const adminKey = process.env.ADMIN_API_KEY

  if (!apiKey || !adminKey || apiKey !== adminKey) {
    return forbiddenResponse('Invalid admin API key')
  }

  const body = await parseJsonBody<CreateStreamActionRequest>(request)

  // Validate required fields
  if (!body.id || !body.name || !body.category || body.cost === undefined || body.cooldownSeconds === undefined) {
    return errorResponse('Missing required fields: id, name, category, cost, cooldownSeconds')
  }

  // Validate ID format (alphanumeric + underscores only)
  if (!/^[a-z0-9_]+$/.test(body.id)) {
    return errorResponse('ID must contain only lowercase letters, numbers, and underscores')
  }

  // Check if ID already exists
  const existing = await prisma.stream_action_types.findUnique({
    where: { id: body.id },
  })

  if (existing) {
    return errorResponse(`Stream action with ID "${body.id}" already exists`)
  }

  // Validate category
  const validCategories = ['lights', 'fog', 'sound', 'tts']
  if (!validCategories.includes(body.category)) {
    return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`)
  }

  // Validate queue behavior
  if (body.queueBehavior && !['overwrite', 'queue'].includes(body.queueBehavior)) {
    return errorResponse('Invalid queueBehavior. Must be "overwrite" or "queue"')
  }

  // Get max sort order for the category
  const maxSortOrder = await prisma.stream_action_types.aggregate({
    where: { category: body.category },
    _max: { sort_order: true },
  })

  const action = await prisma.stream_action_types.create({
    data: {
      id: body.id,
      name: body.name,
      description: body.description,
      category: body.category,
      cost: body.cost,
      cooldown_seconds: body.cooldownSeconds,
      limit_per_stream: body.limitPerStream ?? null,
      lumia_command_id: body.lumiaCommandId ?? null,
      queue_behavior: body.queueBehavior ?? (body.category === 'tts' || body.category === 'sound' ? 'queue' : 'overwrite'),
      max_characters: body.maxCharacters ?? null,
      sort_order: body.sortOrder ?? ((maxSortOrder._max.sort_order ?? 0) + 1),
      is_active: true,
    },
  })

  return successResponse({
    success: true,
    action: {
      id: action.id,
      name: action.name,
      description: action.description,
      category: action.category,
      cost: action.cost,
      cooldownSeconds: action.cooldown_seconds,
      limitPerStream: action.limit_per_stream,
      lumiaCommandId: action.lumia_command_id,
      queueBehavior: action.queue_behavior,
      maxCharacters: action.max_characters,
      isActive: action.is_active,
      sortOrder: action.sort_order,
    },
  })
})
