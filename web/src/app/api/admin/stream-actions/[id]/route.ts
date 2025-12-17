import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  forbiddenResponse,
  withErrorHandling,
  parseJsonBody,
} from '@/lib/api-utils'
import { prisma } from '@/lib/db'

// =============================================================================
// GET /api/admin/stream-actions/[id]
// Get a single stream action by ID
// =============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  // Require admin API key authentication
  const apiKey = request.headers.get('x-api-key')
  const adminKey = process.env.ADMIN_API_KEY

  if (!apiKey || !adminKey || apiKey !== adminKey) {
    return forbiddenResponse('Invalid admin API key')
  }

  const { id } = await context!.params

  const action = await prisma.stream_action_types.findUnique({
    where: { id },
  })

  if (!action) {
    return notFoundResponse('Stream action not found')
  }

  // Get usage stats
  const usageStats = await prisma.stream_action_usage.aggregate({
    where: { action_id: id },
    _count: true,
    _sum: { cost: true },
  })

  // Get recent usage
  const recentUsage = await prisma.stream_action_usage.findMany({
    where: { action_id: id },
    orderBy: { triggered_at: 'desc' },
    take: 10,
    include: {
      users: {
        select: { username: true, display_name: true },
      },
    },
  })

  return successResponse({
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
      isActive: action.is_active ?? true,
      sortOrder: action.sort_order ?? 0,
      createdAt: action.created_at,
    },
    stats: {
      totalTriggered: usageStats._count,
      totalRevenue: usageStats._sum.cost ?? 0,
    },
    recentUsage: recentUsage.map((u) => ({
      id: u.id,
      username: u.users.display_name || u.users.username,
      cost: u.cost,
      status: u.status,
      payload: u.payload,
      triggeredAt: u.triggered_at,
      completedAt: u.completed_at,
    })),
  })
})

// =============================================================================
// PATCH /api/admin/stream-actions/[id]
// Update a stream action
// =============================================================================

interface UpdateStreamActionRequest {
  name?: string
  description?: string
  category?: 'lights' | 'fog' | 'sound' | 'tts'
  cost?: number
  cooldownSeconds?: number
  limitPerStream?: number | null
  lumiaCommandId?: string | null
  queueBehavior?: 'overwrite' | 'queue'
  maxCharacters?: number | null
  sortOrder?: number
  isActive?: boolean
}

export const PATCH = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  // Require admin API key authentication
  const apiKey = request.headers.get('x-api-key')
  const adminKey = process.env.ADMIN_API_KEY

  if (!apiKey || !adminKey || apiKey !== adminKey) {
    return forbiddenResponse('Invalid admin API key')
  }

  const { id } = await context!.params

  // Check if action exists
  const existing = await prisma.stream_action_types.findUnique({
    where: { id },
  })

  if (!existing) {
    return notFoundResponse('Stream action not found')
  }

  const body = await parseJsonBody<UpdateStreamActionRequest>(request)

  // Validate category if provided
  if (body.category) {
    const validCategories = ['lights', 'fog', 'sound', 'tts']
    if (!validCategories.includes(body.category)) {
      return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`)
    }
  }

  // Validate queue behavior if provided
  if (body.queueBehavior && !['overwrite', 'queue'].includes(body.queueBehavior)) {
    return errorResponse('Invalid queueBehavior. Must be "overwrite" or "queue"')
  }

  // Build update data
  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.category !== undefined) updateData.category = body.category
  if (body.cost !== undefined) updateData.cost = body.cost
  if (body.cooldownSeconds !== undefined) updateData.cooldown_seconds = body.cooldownSeconds
  if (body.limitPerStream !== undefined) updateData.limit_per_stream = body.limitPerStream
  if (body.lumiaCommandId !== undefined) updateData.lumia_command_id = body.lumiaCommandId
  if (body.queueBehavior !== undefined) updateData.queue_behavior = body.queueBehavior
  if (body.maxCharacters !== undefined) updateData.max_characters = body.maxCharacters
  if (body.sortOrder !== undefined) updateData.sort_order = body.sortOrder
  if (body.isActive !== undefined) updateData.is_active = body.isActive

  if (Object.keys(updateData).length === 0) {
    return errorResponse('No fields to update')
  }

  const action = await prisma.stream_action_types.update({
    where: { id },
    data: updateData,
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

// =============================================================================
// DELETE /api/admin/stream-actions/[id]
// Soft delete a stream action (sets is_active = false)
// =============================================================================

export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  // Require admin API key authentication
  const apiKey = request.headers.get('x-api-key')
  const adminKey = process.env.ADMIN_API_KEY

  if (!apiKey || !adminKey || apiKey !== adminKey) {
    return forbiddenResponse('Invalid admin API key')
  }

  const { id } = await context!.params

  // Check if action exists
  const existing = await prisma.stream_action_types.findUnique({
    where: { id },
  })

  if (!existing) {
    return notFoundResponse('Stream action not found')
  }

  // Soft delete (set is_active = false)
  await prisma.stream_action_types.update({
    where: { id },
    data: { is_active: false },
  })

  return successResponse({
    success: true,
    message: `Stream action "${existing.name}" has been deactivated`,
  })
})
