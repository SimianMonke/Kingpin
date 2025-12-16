import { prisma } from '../db'
import { JAIL_CONFIG } from '../game'
import { formatTimeRemaining } from '../game/formulas'
import type { PrismaTransactionClient } from './inventory.service'

// =============================================================================
// JAIL SERVICE TYPES
// =============================================================================

export interface JailStatus {
  isJailed: boolean
  expires_at: Date | null
  remainingSeconds: number | null
  remainingFormatted: string | null
}

export interface BailResult {
  success: boolean
  wasJailed: boolean
  bailCost: number
  newWealth: bigint
}

export interface CooldownInfo {
  command_type: string
  target_identifier: string | null
  expires_at: Date
  remainingSeconds: number
  remainingFormatted: string
}

// =============================================================================
// JAIL SERVICE
// =============================================================================

export const JailService = {
  /**
   * Check if a user is currently jailed
   */
  async getJailStatus(user_id: number): Promise<JailStatus> {
    const cooldown = await prisma.cooldowns.findFirst({
      where: {
        user_id,
        command_type: 'jail',
        expires_at: { gt: new Date() },
      },
    })

    if (!cooldown) {
      return {
        isJailed: false,
        expires_at: null,
        remainingSeconds: null,
        remainingFormatted: null,
      }
    }

    const now = new Date()
    const remainingMs = cooldown.expires_at.getTime() - now.getTime()
    const remainingSeconds = Math.ceil(remainingMs / 1000)

    return {
      isJailed: true,
      expires_at: cooldown.expires_at,
      remainingSeconds,
      remainingFormatted: formatTimeRemaining(cooldown.expires_at),
    }
  },

  /**
   * Put a user in jail
   */
  async jailUser(user_id: number, durationMinutes: number = JAIL_CONFIG.DURATION_MINUTES): Promise<Date> {
    const expires_at = new Date()
    expires_at.setMinutes(expires_at.getMinutes() + durationMinutes)

    await prisma.cooldowns.upsert({
      where: {
        user_id_command_type_target_identifier: {
          user_id,
          command_type: 'jail',
          target_identifier: '',
        },
      },
      update: {
        expires_at,
      },
      create: {
        user_id,
        command_type: 'jail',
        target_identifier: '',
        expires_at,
      },
    })

    return expires_at
  },

  /**
   * Process bail payment
   */
  async payBail(user_id: number): Promise<BailResult> {
    const jailStatus = await this.getJailStatus(user_id)

    if (!jailStatus.isJailed) {
      return {
        success: false,
        wasJailed: false,
        bailCost: 0,
        newWealth: BigInt(0),
      }
    }

    // Get user's current wealth
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { wealth: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Calculate bail cost (10% of wealth, minimum from config)
    const wealthNum = Number(user.wealth)
    const bailCost = Math.max(
      JAIL_CONFIG.MIN_BAIL,
      Math.floor(wealthNum * JAIL_CONFIG.BAIL_COST_PERCENT)
    )

    // If player has less than minimum bail, they can still bail for free
    const actualCost = wealthNum < JAIL_CONFIG.MIN_BAIL ? 0 : bailCost

    // Process bail in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct bail cost
      const updatedUser = await tx.users.update({
        where: { id: user_id },
        data: {
          wealth: { decrement: actualCost },
        },
        select: { wealth: true },
      })

      // Remove jail cooldown
      await tx.cooldowns.deleteMany({
        where: {
          user_id,
          command_type: 'jail',
        },
      })

      // Record bail event
      await tx.game_events.create({
        data: {
          user_id,
          event_type: 'bail',
          wealth_change: -actualCost,
          xp_change: 0,
          event_description: `Paid bail to escape jail`,
          success: true,
        },
      })

      return updatedUser
    })

    return {
      success: true,
      wasJailed: true,
      bailCost: actualCost,
      newWealth: result.wealth ?? BigInt(0),
    }
  },

  /**
   * Clear jail (for admin or expired cooldown cleanup)
   */
  async clearJail(user_id: number): Promise<boolean> {
    const result = await prisma.cooldowns.deleteMany({
      where: {
        user_id,
        command_type: 'jail',
      },
    })

    return result.count > 0
  },

  /**
   * Get all active cooldowns for a user
   */
  async getAllCooldowns(user_id: number): Promise<CooldownInfo[]> {
    const cooldowns = await prisma.cooldowns.findMany({
      where: {
        user_id,
        expires_at: { gt: new Date() },
      },
      orderBy: { expires_at: 'asc' },
    })

    return cooldowns.map((cd) => {
      const now = new Date()
      const remainingMs = cd.expires_at.getTime() - now.getTime()
      const remainingSeconds = Math.ceil(remainingMs / 1000)

      return {
        command_type: cd.command_type,
        target_identifier: cd.target_identifier,
        expires_at: cd.expires_at,
        remainingSeconds,
        remainingFormatted: formatTimeRemaining(cd.expires_at),
      }
    })
  },

  /**
   * Set a generic cooldown
   * @param tx - Optional transaction client for atomic operations
   */
  async setCooldown(
    user_id: number,
    command_type: string,
    durationSeconds: number,
    target_identifier: string = '',
    tx?: PrismaTransactionClient
  ): Promise<Date> {
    const db = tx || prisma
    const expires_at = new Date()
    expires_at.setSeconds(expires_at.getSeconds() + durationSeconds)

    await db.cooldowns.upsert({
      where: {
        user_id_command_type_target_identifier: {
          user_id,
          command_type,
          target_identifier,
        },
      },
      update: {
        expires_at,
      },
      create: {
        user_id,
        command_type,
        target_identifier,
        expires_at,
      },
    })

    return expires_at
  },

  /**
   * Check if a specific cooldown is active
   */
  async hasCooldown(
    user_id: number,
    command_type: string,
    target_identifier: string = ''
  ): Promise<{ active: boolean; expires_at: Date | null; remainingSeconds: number | null }> {
    const cooldown = await prisma.cooldowns.findUnique({
      where: {
        user_id_command_type_target_identifier: {
          user_id,
          command_type,
          target_identifier,
        },
      },
    })

    if (!cooldown || cooldown.expires_at <= new Date()) {
      return { active: false, expires_at: null, remainingSeconds: null }
    }

    const remainingMs = cooldown.expires_at.getTime() - new Date().getTime()
    return {
      active: true,
      expires_at: cooldown.expires_at,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    }
  },

  /**
   * Clear a specific cooldown
   */
  async clearCooldown(
    user_id: number,
    command_type: string,
    target_identifier: string = ''
  ): Promise<boolean> {
    const result = await prisma.cooldowns.deleteMany({
      where: {
        user_id,
        command_type,
        target_identifier,
      },
    })

    return result.count > 0
  },

  /**
   * Clean up all expired cooldowns (for scheduled job)
   */
  async cleanupExpiredCooldowns(): Promise<number> {
    const result = await prisma.cooldowns.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    })

    return result.count
  },
}

export default JailService
