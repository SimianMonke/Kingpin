import { prisma } from '../db'
import { JAIL_CONFIG } from '../game'
import { formatTimeRemaining } from '../game/formulas'
import type { PrismaTransactionClient } from './inventory.service'

// =============================================================================
// JAIL SERVICE TYPES
// =============================================================================

export interface JailStatus {
  isJailed: boolean
  expiresAt: Date | null
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
  commandType: string
  targetIdentifier: string | null
  expiresAt: Date
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
  async getJailStatus(userId: number): Promise<JailStatus> {
    const cooldown = await prisma.cooldown.findFirst({
      where: {
        userId,
        commandType: 'jail',
        expiresAt: { gt: new Date() },
      },
    })

    if (!cooldown) {
      return {
        isJailed: false,
        expiresAt: null,
        remainingSeconds: null,
        remainingFormatted: null,
      }
    }

    const now = new Date()
    const remainingMs = cooldown.expiresAt.getTime() - now.getTime()
    const remainingSeconds = Math.ceil(remainingMs / 1000)

    return {
      isJailed: true,
      expiresAt: cooldown.expiresAt,
      remainingSeconds,
      remainingFormatted: formatTimeRemaining(cooldown.expiresAt),
    }
  },

  /**
   * Put a user in jail
   */
  async jailUser(userId: number, durationMinutes: number = JAIL_CONFIG.DURATION_MINUTES): Promise<Date> {
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes)

    await prisma.cooldown.upsert({
      where: {
        userId_commandType_targetIdentifier: {
          userId,
          commandType: 'jail',
          targetIdentifier: '',
        },
      },
      update: {
        expiresAt,
      },
      create: {
        userId,
        commandType: 'jail',
        targetIdentifier: '',
        expiresAt,
      },
    })

    return expiresAt
  },

  /**
   * Process bail payment
   */
  async payBail(userId: number): Promise<BailResult> {
    const jailStatus = await this.getJailStatus(userId)

    if (!jailStatus.isJailed) {
      return {
        success: false,
        wasJailed: false,
        bailCost: 0,
        newWealth: BigInt(0),
      }
    }

    // Get user's current wealth
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          wealth: { decrement: actualCost },
        },
        select: { wealth: true },
      })

      // Remove jail cooldown
      await tx.cooldown.deleteMany({
        where: {
          userId,
          commandType: 'jail',
        },
      })

      // Record bail event
      await tx.gameEvent.create({
        data: {
          userId,
          eventType: 'bail',
          wealthChange: -actualCost,
          xpChange: 0,
          eventDescription: `Paid bail to escape jail`,
          success: true,
        },
      })

      return updatedUser
    })

    return {
      success: true,
      wasJailed: true,
      bailCost: actualCost,
      newWealth: result.wealth,
    }
  },

  /**
   * Clear jail (for admin or expired cooldown cleanup)
   */
  async clearJail(userId: number): Promise<boolean> {
    const result = await prisma.cooldown.deleteMany({
      where: {
        userId,
        commandType: 'jail',
      },
    })

    return result.count > 0
  },

  /**
   * Get all active cooldowns for a user
   */
  async getAllCooldowns(userId: number): Promise<CooldownInfo[]> {
    const cooldowns = await prisma.cooldown.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
    })

    return cooldowns.map((cd) => {
      const now = new Date()
      const remainingMs = cd.expiresAt.getTime() - now.getTime()
      const remainingSeconds = Math.ceil(remainingMs / 1000)

      return {
        commandType: cd.commandType,
        targetIdentifier: cd.targetIdentifier,
        expiresAt: cd.expiresAt,
        remainingSeconds,
        remainingFormatted: formatTimeRemaining(cd.expiresAt),
      }
    })
  },

  /**
   * Set a generic cooldown
   * @param tx - Optional transaction client for atomic operations
   */
  async setCooldown(
    userId: number,
    commandType: string,
    durationSeconds: number,
    targetIdentifier: string = '',
    tx?: PrismaTransactionClient
  ): Promise<Date> {
    const db = tx || prisma
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + durationSeconds)

    await db.cooldown.upsert({
      where: {
        userId_commandType_targetIdentifier: {
          userId,
          commandType,
          targetIdentifier,
        },
      },
      update: {
        expiresAt,
      },
      create: {
        userId,
        commandType,
        targetIdentifier,
        expiresAt,
      },
    })

    return expiresAt
  },

  /**
   * Check if a specific cooldown is active
   */
  async hasCooldown(
    userId: number,
    commandType: string,
    targetIdentifier: string = ''
  ): Promise<{ active: boolean; expiresAt: Date | null; remainingSeconds: number | null }> {
    const cooldown = await prisma.cooldown.findUnique({
      where: {
        userId_commandType_targetIdentifier: {
          userId,
          commandType,
          targetIdentifier,
        },
      },
    })

    if (!cooldown || cooldown.expiresAt <= new Date()) {
      return { active: false, expiresAt: null, remainingSeconds: null }
    }

    const remainingMs = cooldown.expiresAt.getTime() - new Date().getTime()
    return {
      active: true,
      expiresAt: cooldown.expiresAt,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    }
  },

  /**
   * Clear a specific cooldown
   */
  async clearCooldown(
    userId: number,
    commandType: string,
    targetIdentifier: string = ''
  ): Promise<boolean> {
    const result = await prisma.cooldown.deleteMany({
      where: {
        userId,
        commandType,
        targetIdentifier,
      },
    })

    return result.count > 0
  },

  /**
   * Clean up all expired cooldowns (for scheduled job)
   */
  async cleanupExpiredCooldowns(): Promise<number> {
    const result = await prisma.cooldown.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    return result.count
  },
}

export default JailService
