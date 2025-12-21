import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// =============================================================================
// API RESPONSE HELPERS
// =============================================================================

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(message: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, error: message, ...(code && { code }) }, { status })
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ success: false, error: message }, { status: 403 })
}

export function notFoundResponse(message = 'Not found') {
  return NextResponse.json({ success: false, error: message }, { status: 404 })
}

export function serverErrorResponse(message = 'Internal server error') {
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

// =============================================================================
// AUTH HELPERS
// =============================================================================

export async function getAuthSession() {
  return getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    throw new AuthError('Not authenticated')
  }
  return session
}

/**
 * MED-02: Helper to get authenticated user ID as a number
 * Handles the string-to-number coercion in one place
 */
export async function requireAuthUserId(): Promise<number> {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    throw new AuthError('Not authenticated')
  }
  // NextAuth stores user.id as string, convert to number for Prisma
  const user_id = typeof session.user.id === 'string'
    ? parseInt(session.user.id, 10)
    : session.user.id
  if (isNaN(user_id)) {
    throw new AuthError('Invalid user ID')
  }
  return user_id
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

export async function parseJsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return await request.json()
  } catch {
    throw new ValidationError('Invalid JSON body')
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// =============================================================================
// ERROR HANDLER WRAPPER
// =============================================================================

type ApiHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      // Log full error details for debugging
      console.error('API Error:', {
        url: request.url,
        method: request.method,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
      })

      if (error instanceof AuthError) {
        return unauthorizedResponse(error.message)
      }

      if (error instanceof ValidationError) {
        return errorResponse(error.message)
      }

      if (error instanceof Error) {
        // Include error details in production for debugging
        const message = process.env.NODE_ENV === 'development'
          ? error.message
          : `An error occurred (${error.name}: ${error.message.slice(0, 100)})`
        return serverErrorResponse(message)
      }

      return serverErrorResponse()
    }
  }
}

// =============================================================================
// RATE LIMITING (SEC-02 Security Fix)
// =============================================================================

interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitRecord>()

/**
 * Preset rate limits for different endpoint types
 */
export const RATE_LIMITS = {
  // Standard API calls - 60 per minute
  STANDARD: { limit: 60, windowMs: 60000 },

  // Sensitive endpoints - 20 per minute
  SENSITIVE: { limit: 20, windowMs: 60000 },

  // Heist answers - 5 per heist attempt (prevents brute-force)
  HEIST: { limit: 5, windowMs: 60000 },

  // Gambling - 30 per minute
  GAMBLING: { limit: 30, windowMs: 60000 },

  // Auth/Login - 10 per minute (prevents credential stuffing)
  AUTH: { limit: 10, windowMs: 60000 },

  // Webhooks - higher limit for external services
  WEBHOOK: { limit: 100, windowMs: 60000 },
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Check rate limit for an identifier
 * @param identifier - Unique identifier (user_id, IP, etc.)
 * @param maxRequests - Max requests per window
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitResult with allowed status and remaining count
 */
export function checkRateLimit(
  identifier: string,
  maxRequests = 60,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  // No existing record or expired - create new
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    }
  }

  // Check if over limit
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    }
  }

  // Increment and allow
  record.count++
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  }
}

/**
 * Rate limit response helper - returns 429 with retry info
 */
export function rateLimitedResponse(result: RateLimitResult) {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded. Please slow down.',
      retryAfterSeconds: retryAfter,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
        'Retry-After': retryAfter.toString(),
      },
    }
  )
}

/**
 * Quick helper to check rate limit and return error if exceeded
 * Returns null if allowed, Response if rate limited
 *
 * Usage:
 * const rateLimitError = applyRateLimit(`user:${user_id}`, RATE_LIMITS.GAMBLING)
 * if (rateLimitError) return rateLimitError
 */
export function applyRateLimit(
  identifier: string,
  config: { limit: number; windowMs: number } = RATE_LIMITS.STANDARD
): NextResponse | null {
  const result = checkRateLimit(identifier, config.limit, config.windowMs)
  if (!result.allowed) {
    return rateLimitedResponse(result)
  }
  return null
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000)
