import { prisma } from '../db'
import { safeVoid } from '../utils'
import { ROB_CONFIG, MISSION_OBJECTIVE_TYPES, ACHIEVEMENT_REQUIREMENT_TYPES, STOLEN_ITEM_ESCROW_HOURS } from '../game'
import { calculateRobSuccessRate, formatWealth } from '../game/formulas'
import { InventoryService, type InventoryItem, type PrismaTransactionClient } from './inventory.service'
import { JailService } from './jail.service'
import { LeaderboardService } from './leaderboard.service'
import { MissionService } from './mission.service'
import { AchievementService } from './achievement.service'
import { FactionService } from './faction.service'
import { NotificationService } from './notification.service'
import { DiscordService } from './discord.service'

// =============================================================================
// ROB SERVICE TYPES
// =============================================================================

export interface RobPrecheck {
  canRob: boolean
  reason?: string
  targetId?: number
  targetUsername?: string
  targetWealth?: bigint
  successRate?: number
  cooldownExpiresAt?: Date
  cooldownRemaining?: string
}

export interface RobResult {
  success: boolean
  outcome: 'success' | 'failure'
  wealthStolen: number
  insuranceSaved: number
  itemStolen: {
    id: number
    name: string
    type: string
    tier: string
  } | null
  xpGained: number
  attackerWeaponDamage: {
    degraded: boolean
    destroyed: boolean
    itemName?: string
  }
  defenderArmorDamage: {
    degraded: boolean
    destroyed: boolean
    itemName?: string
  }
  cooldownExpiresAt: Date
  message: string
}

interface PlayerInfo {
  id: number
  username: string
  kingpinName: string | null
  level: number
  wealth: bigint
}

// =============================================================================
// ROB SERVICE
// =============================================================================

export const RobService = {
  /**
   * Pre-check if a robbery can be attempted
   */
  async canRob(attackerId: number, targetUsername: string): Promise<RobPrecheck> {
    // Clean up target username (remove @ if present)
    const cleanTarget = targetUsername.trim().replace(/^@/, '').toLowerCase()

    // 1. Check if attacker is jailed
    const jailStatus = await JailService.getJailStatus(attackerId)
    if (jailStatus.isJailed) {
      return {
        canRob: false,
        reason: `You can't rob while in jail. Time remaining: ${jailStatus.remainingFormatted}`,
      }
    }

    // 2. Find target user
    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanTarget, mode: 'insensitive' } },
          { kingpinName: { equals: cleanTarget, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        kingpinName: true,
        level: true,
        wealth: true,
      },
    })

    if (!target) {
      return {
        canRob: false,
        reason: `User "${targetUsername}" not found.`,
      }
    }

    // 3. Can't rob yourself
    if (target.id === attackerId) {
      return {
        canRob: false,
        reason: "You can't rob yourself!",
      }
    }

    // 4. Check if target has wealth
    if (target.wealth <= 0) {
      return {
        canRob: false,
        reason: `${target.kingpinName || target.username} has no wealth to steal!`,
        targetId: target.id,
        targetUsername: target.username,
      }
    }

    // 5. Check for Juicernaut immunity
    const immunityBuff = await prisma.activeBuff.findFirst({
      where: {
        userId: target.id,
        buffType: 'juicernaut_immunity',
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    })

    if (immunityBuff) {
      return {
        canRob: false,
        reason: `${target.kingpinName || target.username} is the current Juicernaut and cannot be robbed!`,
        targetId: target.id,
        targetUsername: target.username,
      }
    }

    // 6. Check per-target cooldown
    const cooldownStatus = await JailService.hasCooldown(
      attackerId,
      'rob_target',
      target.id.toString()
    )

    if (cooldownStatus.active) {
      const hours = Math.floor((cooldownStatus.remainingSeconds || 0) / 3600)
      const minutes = Math.floor(((cooldownStatus.remainingSeconds || 0) % 3600) / 60)
      return {
        canRob: false,
        reason: `You already robbed ${target.kingpinName || target.username} recently. Try again in ${hours}h ${minutes}m.`,
        targetId: target.id,
        targetUsername: target.username,
        cooldownExpiresAt: cooldownStatus.expiresAt || undefined,
      }
    }

    // 7. Calculate success rate for preview
    const [attacker, attackerEquipped, defenderEquipped] = await Promise.all([
      prisma.user.findUnique({
        where: { id: attackerId },
        select: { level: true },
      }),
      InventoryService.getEquippedItems(attackerId),
      InventoryService.getEquippedItems(target.id),
    ])

    const weaponBonus = attackerEquipped.weapon?.robBonus || 0
    const armorBonus = defenderEquipped.armor?.defenseBonus || 0

    const successRate = calculateRobSuccessRate({
      attackerLevel: attacker?.level || 1,
      defenderLevel: target.level,
      attackerWeaponBonus: weaponBonus,
      defenderArmorBonus: armorBonus,
    })

    return {
      canRob: true,
      targetId: target.id,
      targetUsername: target.username,
      targetWealth: target.wealth,
      successRate: Math.round(successRate * 100),
    }
  },

  /**
   * Execute a robbery attempt
   */
  async executeRob(attackerId: number, targetId: number): Promise<RobResult> {
    // Get both players' info
    const [attacker, target] = await Promise.all([
      prisma.user.findUnique({
        where: { id: attackerId },
        select: { id: true, username: true, kingpinName: true, level: true, wealth: true },
      }),
      prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, username: true, kingpinName: true, level: true, wealth: true },
      }),
    ])

    if (!attacker || !target) {
      throw new Error('Player not found')
    }

    // Get equipped items for both
    const [attackerEquipped, defenderEquipped] = await Promise.all([
      InventoryService.getEquippedItems(attackerId),
      InventoryService.getEquippedItems(targetId),
    ])

    // Calculate success rate
    const weaponBonus = attackerEquipped.weapon?.robBonus || 0
    const armorBonus = defenderEquipped.armor?.defenseBonus || 0

    // Get faction buffs for attacker and defender
    const [attackerFactionBuffs, defenderFactionBuffs] = await Promise.all([
      FactionService.getAggregatedBuffs(attackerId),
      FactionService.getAggregatedBuffs(targetId),
    ])

    // Apply rob_success buff (from The Ports, Deadzone)
    const factionRobBonus = attackerFactionBuffs['rob_success'] || 0
    // Apply defense buff (from The Hollows)
    const factionDefenseBonus = defenderFactionBuffs['defense'] || 0

    const successRate = calculateRobSuccessRate({
      attackerLevel: attacker.level,
      defenderLevel: target.level,
      attackerWeaponBonus: weaponBonus + factionRobBonus,
      defenderArmorBonus: armorBonus + factionDefenseBonus,
    })

    // Roll for success
    const roll = Math.random()
    const isSuccess = roll < successRate

    // Calculate results
    let wealthStolen = 0
    let insuranceSaved = 0
    let stolenItem: RobResult['itemStolen'] = null
    let xpGained = isSuccess ? ROB_CONFIG.XP_REWARD_SUCCESS : ROB_CONFIG.XP_REWARD_FAILURE

    if (isSuccess) {
      // Calculate wealth to steal (8-28%)
      const stealPercent = ROB_CONFIG.STEAL_PERCENTAGE.min +
        Math.random() * (ROB_CONFIG.STEAL_PERCENTAGE.max - ROB_CONFIG.STEAL_PERCENTAGE.min)
      const baseSteal = Math.floor(Number(target.wealth) * stealPercent)

      // Apply housing insurance
      const insurancePercent = defenderEquipped.housing?.insurancePercent || 0
      insuranceSaved = Math.floor(baseSteal * insurancePercent)
      wealthStolen = baseSteal - insuranceSaved

      // Roll for item theft (5% chance)
      if (Math.random() < ROB_CONFIG.ITEM_THEFT_CHANCE) {
        stolenItem = await this.attemptItemTheft(attackerId, targetId, defenderEquipped)
      }
    }

    // Calculate cooldown expiry time (for return value)
    const cooldownSeconds = ROB_CONFIG.COOLDOWN_HOURS * 60 * 60
    const cooldownExpiresAt = new Date()
    cooldownExpiresAt.setSeconds(cooldownExpiresAt.getSeconds() + cooldownSeconds)

    // Execute ENTIRE robbery in single transaction for atomicity (CRIT-02/03 fix)
    // Includes: wealth transfer, XP gain, equipment degradation, cooldown, event logging
    const { attackerWeaponDamage, defenderArmorDamage } = await prisma.$transaction(async (tx) => {
      // 1. Transfer wealth (if successful)
      if (isSuccess && wealthStolen > 0) {
        await tx.user.update({
          where: { id: targetId },
          data: { wealth: { decrement: wealthStolen } },
        })

        await tx.user.update({
          where: { id: attackerId },
          data: { wealth: { increment: wealthStolen } },
        })
      }

      // 2. Add XP to attacker
      await tx.user.update({
        where: { id: attackerId },
        data: { xp: { increment: xpGained } },
      })

      // 3. Degrade equipment (NOW INSIDE transaction)
      const [weaponDamage, armorDamage] = await Promise.all([
        InventoryService.degradeAttackerWeapon(attackerId, tx),
        InventoryService.degradeDefenderArmor(targetId, tx),
      ])

      // 4. Set cooldown (NOW INSIDE transaction)
      await JailService.setCooldown(
        attackerId,
        'rob_target',
        cooldownSeconds,
        targetId.toString(),
        tx
      )

      // 5. Log event for attacker
      await tx.gameEvent.create({
        data: {
          userId: attackerId,
          eventType: 'rob',
          wealthChange: wealthStolen,
          xpChange: xpGained,
          targetUserId: targetId,
          success: isSuccess,
          eventDescription: isSuccess
            ? `Robbed ${target.kingpinName || target.username} for ${formatWealth(wealthStolen)}${stolenItem ? ` and stole their ${stolenItem.name}!` : ''}`
            : `Failed to rob ${target.kingpinName || target.username}`,
        },
      })

      // 6. Log event for defender
      await tx.gameEvent.create({
        data: {
          userId: targetId,
          eventType: 'rob_victim',
          wealthChange: -wealthStolen,
          xpChange: 0,
          targetUserId: attackerId,
          success: !isSuccess, // Success from defender's perspective means the rob failed
          eventDescription: isSuccess
            ? `Was robbed by ${attacker.kingpinName || attacker.username} for ${formatWealth(wealthStolen)}${insuranceSaved > 0 ? ` (insurance saved ${formatWealth(insuranceSaved)})` : ''}`
            : `Defended against robbery attempt by ${attacker.kingpinName || attacker.username}`,
        },
      })

      return { attackerWeaponDamage: weaponDamage, defenderArmorDamage: armorDamage }
    })

    // MED-01 fix: Wrap non-critical external calls to prevent failures from crashing rob
    // Update leaderboard snapshots
    await safeVoid(
      () => LeaderboardService.updateSnapshot(attackerId, {
        robCount: 1,
        robSuccessCount: isSuccess ? 1 : 0,
        wealthEarned: wealthStolen,
        xpEarned: xpGained,
      }),
      'rob.service:leaderboard'
    )

    // Check for hall of fame records
    if (isSuccess && wealthStolen > 0) {
      await safeVoid(
        () => LeaderboardService.checkAndUpdateRecord('biggest_single_rob', attackerId, wealthStolen),
        'rob.service:leaderboard:record'
      )
    }

    // Update mission progress for attacker
    await safeVoid(
      () => MissionService.updateProgress(attackerId, MISSION_OBJECTIVE_TYPES.ROB_ATTEMPTS, 1),
      'rob.service:mission:robAttempts'
    )
    if (isSuccess) {
      await safeVoid(
        () => MissionService.updateProgress(attackerId, MISSION_OBJECTIVE_TYPES.ROB_SUCCESSES, 1),
        'rob.service:mission:robSuccesses'
      )
      await safeVoid(
        () => MissionService.updateProgress(attackerId, MISSION_OBJECTIVE_TYPES.WEALTH_EARNED, wealthStolen),
        'rob.service:mission:wealthEarned'
      )
    }

    // Update achievement progress for attacker
    if (isSuccess) {
      await safeVoid(
        () => AchievementService.incrementProgress(attackerId, ACHIEVEMENT_REQUIREMENT_TYPES.ROB_WINS, 1),
        'rob.service:achievement:robWins'
      )
      await safeVoid(
        () => AchievementService.incrementProgress(attackerId, ACHIEVEMENT_REQUIREMENT_TYPES.TOTAL_WEALTH_EARNED, wealthStolen),
        'rob.service:achievement:wealthEarned'
      )
    }

    // Update achievement progress for defender (successful defense)
    if (!isSuccess) {
      await safeVoid(
        () => AchievementService.incrementProgress(targetId, ACHIEVEMENT_REQUIREMENT_TYPES.ROB_DEFENSES, 1),
        'rob.service:achievement:robDefenses'
      )
    }

    // Add territory score for faction (20 points per rob attempt)
    await safeVoid(
      () => FactionService.addTerritoryScore(attackerId, 'rob'),
      'rob.service:faction:territoryScore'
    )

    // Notify defender of robbery outcome
    const attackerName = attacker.kingpinName || attacker.username
    if (isSuccess) {
      // Notify defender they were robbed
      await safeVoid(
        () => NotificationService.notifyRobbed(
          targetId,
          attackerName,
          wealthStolen,
          stolenItem?.name
        ),
        'rob.service:notification:robbed'
      )
      // Post item theft to Discord feed (major event)
      if (stolenItem) {
        await safeVoid(
          () => DiscordService.postItemTheft(
            attackerName,
            target.kingpinName || target.username,
            stolenItem.name,
            stolenItem.tier
          ),
          'rob.service:discord:itemTheft'
        )
      }
    } else {
      // Notify defender they blocked the robbery
      await safeVoid(
        () => NotificationService.notifyRobDefended(targetId, attackerName),
        'rob.service:notification:robDefended'
      )
    }

    // Build result message
    const targetName = target.kingpinName || target.username
    let message: string
    if (isSuccess) {
      message = `💰 You robbed ${targetName} for ${formatWealth(wealthStolen)}!`
      if (insuranceSaved > 0) {
        message += ` (🛡️ Insurance saved them ${formatWealth(insuranceSaved)})`
      }
      if (stolenItem) {
        message += `\n🔥 You also stole their ${stolenItem.name}!`
      }
    } else {
      message = `❌ You tried to rob ${targetName} but failed! Better luck next time.`
    }

    if (attackerWeaponDamage.destroyed) {
      message += `\n⚠️ Your ${attackerWeaponDamage.itemName} broke!`
    }

    return {
      success: true,
      outcome: isSuccess ? 'success' : 'failure',
      wealthStolen,
      insuranceSaved,
      itemStolen: stolenItem,
      xpGained,
      attackerWeaponDamage,
      defenderArmorDamage,
      cooldownExpiresAt,
      message,
    }
  },

  /**
   * Attempt to steal an equipped item from the defender
   */
  async attemptItemTheft(
    attackerId: number,
    defenderId: number,
    defenderEquipped: Awaited<ReturnType<typeof InventoryService.getEquippedItems>>
  ): Promise<RobResult['itemStolen']> {
    // Get list of equipped items
    const equippedItems: InventoryItem[] = []
    if (defenderEquipped.weapon) equippedItems.push(defenderEquipped.weapon)
    if (defenderEquipped.armor) equippedItems.push(defenderEquipped.armor)
    if (defenderEquipped.business) equippedItems.push(defenderEquipped.business)
    if (defenderEquipped.housing) equippedItems.push(defenderEquipped.housing)

    if (equippedItems.length === 0) {
      return null
    }

    // Random selection from equipped items
    const randomIndex = Math.floor(Math.random() * equippedItems.length)
    const itemToSteal = equippedItems[randomIndex]

    // Transfer item from defender to attacker
    await prisma.$transaction(async (tx) => {
      // Unequip from defender
      await tx.userInventory.update({
        where: { id: itemToSteal.id },
        data: {
          isEquipped: false,
          slot: null,
          equippedAt: null,
        },
      })

      // Check if attacker has inventory space
      const attackerInventoryCount = await tx.userInventory.count({
        where: { userId: attackerId, isEscrowed: false },
      })

      const hasSpace = attackerInventoryCount < 10 // MAX_INVENTORY_SIZE

      // Transfer to attacker (or escrow if no space)
      // HIGH-02 fix: Stolen items use 48-hour escrow (longer than normal)
      await tx.userInventory.update({
        where: { id: itemToSteal.id },
        data: {
          userId: attackerId,
          isEscrowed: !hasSpace,
          escrowExpiresAt: hasSpace ? null : new Date(Date.now() + STOLEN_ITEM_ESCROW_HOURS * 60 * 60 * 1000),
        },
      })
    })

    return {
      id: itemToSteal.id,
      name: itemToSteal.itemName,
      type: itemToSteal.itemType,
      tier: itemToSteal.tier,
    }
  },

  /**
   * Get recent rob events for a user (both as attacker and defender)
   */
  async getRobHistory(userId: number, limit: number = 10): Promise<Array<{
    id: number
    eventType: string
    targetUsername: string | null
    wealthChange: bigint
    success: boolean
    description: string
    createdAt: Date
  }>> {
    const events = await prisma.gameEvent.findMany({
      where: {
        OR: [
          { userId, eventType: 'rob' },
          { userId, eventType: 'rob_victim' },
        ],
      },
      include: {
        targetUser: {
          select: { username: true, kingpinName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      targetUsername: event.targetUser?.kingpinName || event.targetUser?.username || null,
      wealthChange: event.wealthChange,
      success: event.success,
      description: event.eventDescription || '',
      createdAt: event.createdAt,
    }))
  },
}

export default RobService
