import { config } from '../config'

// =============================================================================
// COOLDOWN MANAGER
// =============================================================================

interface CooldownEntry {
  expiresAt: number
}

class CooldownManager {
  private cooldowns: Map<string, CooldownEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired cooldowns every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Generate a cooldown key
   */
  private getKey(userId: string, command: string): string {
    return `${userId}:${command}`
  }

  /**
   * Check if user is on cooldown for a command
   */
  isOnCooldown(userId: string, command: string): boolean {
    const key = this.getKey(userId, command)
    const entry = this.cooldowns.get(key)

    if (!entry) return false

    if (Date.now() >= entry.expiresAt) {
      this.cooldowns.delete(key)
      return false
    }

    return true
  }

  /**
   * Get remaining cooldown time in ms
   */
  getRemainingCooldown(userId: string, command: string): number {
    const key = this.getKey(userId, command)
    const entry = this.cooldowns.get(key)

    if (!entry) return 0

    const remaining = entry.expiresAt - Date.now()
    return remaining > 0 ? remaining : 0
  }

  /**
   * Set cooldown for a user/command
   */
  setCooldown(userId: string, command: string, durationMs?: number): void {
    const key = this.getKey(userId, command)
    const duration = durationMs ?? config.bot.commandCooldownMs

    this.cooldowns.set(key, {
      expiresAt: Date.now() + duration,
    })
  }

  /**
   * Clear cooldown for a user/command
   */
  clearCooldown(userId: string, command: string): void {
    const key = this.getKey(userId, command)
    this.cooldowns.delete(key)
  }

  /**
   * Clear all cooldowns for a user
   */
  clearUserCooldowns(userId: string): void {
    const prefix = `${userId}:`
    for (const key of this.cooldowns.keys()) {
      if (key.startsWith(prefix)) {
        this.cooldowns.delete(key)
      }
    }
  }

  /**
   * Cleanup expired cooldowns
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cooldowns.entries()) {
      if (now >= entry.expiresAt) {
        this.cooldowns.delete(key)
      }
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Export singleton
export const cooldownManager = new CooldownManager()
export default cooldownManager
