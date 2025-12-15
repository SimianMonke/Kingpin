// =============================================================================
// UTILITY FUNCTIONS
// General-purpose utilities for the Kingpin application
// =============================================================================

/**
 * MED-01 fix: Safe wrapper for non-critical async operations
 * Prevents external service failures from crashing main operations
 *
 * @param operation - The async operation to execute
 * @param fallback - Value to return if operation fails
 * @param context - Logging context for debugging
 * @returns The operation result or fallback value
 */
export async function safeCall<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`[${context}] Non-critical operation failed:`, error)
    return fallback
  }
}

/**
 * MED-01 fix: Safe wrapper that returns void (for fire-and-forget operations)
 *
 * @param operation - The async operation to execute
 * @param context - Logging context for debugging
 */
export async function safeVoid(
  operation: () => Promise<unknown>,
  context: string
): Promise<void> {
  try {
    await operation()
  } catch (error) {
    console.error(`[${context}] Non-critical operation failed:`, error)
  }
}

/**
 * MED-02 fix: Safely convert BigInt to Number with overflow protection
 * Returns capped value if BigInt exceeds safe integer range
 *
 * @param value - The BigInt value to convert
 * @param context - Logging context for debugging (optional)
 * @returns Safe number representation
 */
export function safeBigIntToNumber(value: bigint, context?: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    if (context) {
      console.warn(`[${context}] BigInt exceeds safe integer range: ${value}`)
    }
    return Number.MAX_SAFE_INTEGER
  }
  if (value < BigInt(Number.MIN_SAFE_INTEGER)) {
    if (context) {
      console.warn(`[${context}] BigInt below safe integer range: ${value}`)
    }
    return Number.MIN_SAFE_INTEGER
  }
  return Number(value)
}

/**
 * MED-02 fix: Safely convert BigInt to Number, returning null if overflow
 * Use when you need to detect overflow rather than cap
 *
 * @param value - The BigInt value to convert
 * @returns Number or null if overflow would occur
 */
export function bigIntToNumberOrNull(value: bigint): number | null {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    return null
  }
  return Number(value)
}
