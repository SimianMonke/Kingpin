/**
 * Account Merge Service
 *
 * Handles merging two user accounts when a player accidentally created
 * separate accounts on different platforms.
 *
 * The "primary" account survives and absorbs all data from the "secondary" account.
 * The secondary account is soft-deleted with a reference to where it merged.
 */

import { prisma } from '../db'
import { levelFromXp, getTierFromLevel } from '../game'
import type { Prisma } from '@prisma/client'

// =============================================================================
// TYPES
// =============================================================================

export interface MergePreview {
  primary: {
    id: number
    username: string
    platforms: string[]
    wealth: bigint
    xp: bigint
    level: number
    tier: string
    tokens: number
    bonds: number
    checkin_streak: number
    total_play_count: number
    wins: number
    losses: number
    inventory_count: number
    crate_count: number
    title_count: number
    achievement_count: number
    faction: string | null
  }
  secondary: {
    id: number
    username: string
    platforms: string[]
    wealth: bigint
    xp: bigint
    level: number
    tier: string
    tokens: number
    bonds: number
    checkin_streak: number
    total_play_count: number
    wins: number
    losses: number
    inventory_count: number
    crate_count: number
    title_count: number
    achievement_count: number
    faction: string | null
  }
  result: {
    wealth: bigint
    xp: bigint
    level: number
    tier: string
    tokens: number
    bonds: number
    checkin_streak: number
    total_play_count: number
    wins: number
    losses: number
    inventory_count: number
    crate_count: number
    title_count: number
    platforms: string[]
  }
  warnings: string[]
}

export interface MergeResult {
  success: boolean
  primaryUserId: number
  secondaryUserId: number
  mergedAt: Date
  summary: {
    wealth_added: bigint
    xp_added: bigint
    items_transferred: number
    crates_transferred: number
    titles_transferred: number
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export const AccountMergeService = {
  /**
   * Generate a preview of what will happen if accounts are merged
   */
  async getMergePreview(
    primaryUserId: number,
    secondaryUserId: number
  ): Promise<MergePreview> {
    if (primaryUserId === secondaryUserId) {
      throw new Error('Cannot merge an account with itself')
    }

    const [primary, secondary] = await Promise.all([
      this.getUserSnapshot(primaryUserId),
      this.getUserSnapshot(secondaryUserId),
    ])

    if (!primary) throw new Error('Primary account not found')
    if (!secondary) throw new Error('Secondary account not found')

    if (secondary.merged_into_user_id) {
      throw new Error('Secondary account has already been merged')
    }

    const warnings: string[] = []

    // Check for faction conflicts
    if (primary.faction_id && secondary.faction_id && primary.faction_id !== secondary.faction_id) {
      warnings.push(`Faction conflict: Primary is in "${primary.faction_name}", Secondary is in "${secondary.faction_name}". Primary faction will be kept.`)
    }

    // Calculate merged values
    const combinedXp = (primary.xp ?? BigInt(0)) + (secondary.xp ?? BigInt(0))
    const newLevel = levelFromXp(Number(combinedXp))
    const newTier = getTierFromLevel(newLevel)

    // Determine which streak to keep (higher one)
    const bestStreak = Math.max(primary.checkin_streak ?? 0, secondary.checkin_streak ?? 0)

    // Combine platforms
    const platforms: string[] = []
    if (primary.kick_user_id || secondary.kick_user_id) platforms.push('kick')
    if (primary.twitch_user_id || secondary.twitch_user_id) platforms.push('twitch')
    if (primary.discord_user_id || secondary.discord_user_id) platforms.push('discord')

    return {
      primary: {
        id: primary.id,
        username: primary.username,
        platforms: this.getPlatforms(primary),
        wealth: primary.wealth ?? BigInt(0),
        xp: primary.xp ?? BigInt(0),
        level: primary.level ?? 1,
        tier: primary.status_tier ?? 'Punk',
        tokens: primary.tokens ?? 0,
        bonds: primary.bonds ?? 0,
        checkin_streak: primary.checkin_streak ?? 0,
        total_play_count: primary.total_play_count ?? 0,
        wins: primary.wins ?? 0,
        losses: primary.losses ?? 0,
        inventory_count: primary._count.user_inventory,
        crate_count: primary._count.user_crates,
        title_count: primary._count.user_titles,
        achievement_count: primary._count.user_achievements,
        faction: primary.faction_name,
      },
      secondary: {
        id: secondary.id,
        username: secondary.username,
        platforms: this.getPlatforms(secondary),
        wealth: secondary.wealth ?? BigInt(0),
        xp: secondary.xp ?? BigInt(0),
        level: secondary.level ?? 1,
        tier: secondary.status_tier ?? 'Punk',
        tokens: secondary.tokens ?? 0,
        bonds: secondary.bonds ?? 0,
        checkin_streak: secondary.checkin_streak ?? 0,
        total_play_count: secondary.total_play_count ?? 0,
        wins: secondary.wins ?? 0,
        losses: secondary.losses ?? 0,
        inventory_count: secondary._count.user_inventory,
        crate_count: secondary._count.user_crates,
        title_count: secondary._count.user_titles,
        achievement_count: secondary._count.user_achievements,
        faction: secondary.faction_name,
      },
      result: {
        wealth: (primary.wealth ?? BigInt(0)) + (secondary.wealth ?? BigInt(0)),
        xp: combinedXp,
        level: newLevel,
        tier: newTier,
        tokens: (primary.tokens ?? 0) + (secondary.tokens ?? 0),
        bonds: (primary.bonds ?? 0) + (secondary.bonds ?? 0),
        checkin_streak: bestStreak,
        total_play_count: (primary.total_play_count ?? 0) + (secondary.total_play_count ?? 0),
        wins: (primary.wins ?? 0) + (secondary.wins ?? 0),
        losses: (primary.losses ?? 0) + (secondary.losses ?? 0),
        inventory_count: primary._count.user_inventory + secondary._count.user_inventory,
        crate_count: primary._count.user_crates + secondary._count.user_crates,
        title_count: primary._count.user_titles + secondary._count.user_titles, // May have duplicates
        platforms,
      },
      warnings,
    }
  },

  /**
   * Execute the account merge
   */
  async executeMerge(
    primaryUserId: number,
    secondaryUserId: number
  ): Promise<MergeResult> {
    // Get preview first to validate and calculate
    const preview = await this.getMergePreview(primaryUserId, secondaryUserId)

    const secondary = await this.getUserSnapshot(secondaryUserId)
    if (!secondary) throw new Error('Secondary account not found')

    // Create audit log of secondary account state before merge
    const auditLog = {
      merged_at: new Date().toISOString(),
      secondary_user_id: secondaryUserId,
      secondary_username: secondary.username,
      pre_merge_state: {
        wealth: secondary.wealth?.toString(),
        xp: secondary.xp?.toString(),
        level: secondary.level,
        tokens: secondary.tokens,
        bonds: secondary.bonds,
        inventory_count: secondary._count.user_inventory,
        crate_count: secondary._count.user_crates,
        platforms: this.getPlatforms(secondary),
      },
    }

    const mergedAt = new Date()
    let itemsTransferred = 0
    let cratesTransferred = 0
    let titlesTransferred = 0

    await prisma.$transaction(async (tx) => {
      // 1. Transfer platform IDs from secondary to primary
      const platformUpdates: Prisma.usersUpdateInput = {}
      if (secondary.kick_user_id) {
        platformUpdates.kick_user_id = secondary.kick_user_id
      }
      if (secondary.twitch_user_id) {
        platformUpdates.twitch_user_id = secondary.twitch_user_id
      }
      if (secondary.discord_user_id) {
        platformUpdates.discord_user_id = secondary.discord_user_id
        platformUpdates.discord_username = secondary.discord_username
        platformUpdates.discord_linked_at = secondary.discord_linked_at
      }

      // 2. Calculate new combined stats
      const combinedXp = preview.result.xp
      const newLevel = preview.result.level
      const newTier = preview.result.tier

      // 3. Update primary user with combined stats and platform IDs
      await tx.users.update({
        where: { id: primaryUserId },
        data: {
          ...platformUpdates,
          wealth: { increment: secondary.wealth ?? 0 },
          xp: combinedXp,
          level: newLevel,
          status_tier: newTier,
          tokens: { increment: secondary.tokens ?? 0 },
          bonds: { increment: secondary.bonds ?? 0 },
          total_play_count: { increment: secondary.total_play_count ?? 0 },
          wins: { increment: secondary.wins ?? 0 },
          losses: { increment: secondary.losses ?? 0 },
          checkin_streak: preview.result.checkin_streak,
        },
      })

      // 4. Clear platform IDs from secondary (avoid unique constraint issues)
      await tx.users.update({
        where: { id: secondaryUserId },
        data: {
          kick_user_id: null,
          twitch_user_id: null,
          discord_user_id: null,
        },
      })

      // 5. Transfer inventory items
      const inventoryResult = await tx.user_inventory.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })
      itemsTransferred = inventoryResult.count

      // 6. Transfer crates
      const cratesResult = await tx.user_crates.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })
      cratesTransferred = cratesResult.count

      // 7. Transfer titles (handling duplicates)
      const existingTitles = await tx.user_titles.findMany({
        where: { user_id: primaryUserId },
        select: { title: true },
      })
      const existingTitleSet = new Set(existingTitles.map((t) => t.title))

      const secondaryTitles = await tx.user_titles.findMany({
        where: { user_id: secondaryUserId },
      })

      for (const title of secondaryTitles) {
        if (!existingTitleSet.has(title.title)) {
          await tx.user_titles.update({
            where: { id: title.id },
            data: { user_id: primaryUserId },
          })
          titlesTransferred++
        } else {
          // Delete duplicate title
          await tx.user_titles.delete({ where: { id: title.id } })
        }
      }

      // 8. Transfer achievements (merge progress, keep higher values)
      const primaryAchievements = await tx.user_achievements.findMany({
        where: { user_id: primaryUserId },
      })
      const primaryAchievementMap = new Map(
        primaryAchievements.map((a) => [a.achievement_id, a])
      )

      const secondaryAchievements = await tx.user_achievements.findMany({
        where: { user_id: secondaryUserId },
      })

      for (const secAch of secondaryAchievements) {
        const priAch = primaryAchievementMap.get(secAch.achievement_id)
        if (priAch) {
          // Merge: keep higher progress, preserve completion
          const newProgress = BigInt(
            Math.max(Number(priAch.current_progress ?? 0), Number(secAch.current_progress ?? 0))
          )
          const isCompleted = priAch.is_completed || secAch.is_completed
          const completedAt = priAch.completed_at || secAch.completed_at

          await tx.user_achievements.update({
            where: { id: priAch.id },
            data: {
              current_progress: newProgress,
              is_completed: isCompleted,
              completed_at: completedAt,
            },
          })
          await tx.user_achievements.delete({ where: { id: secAch.id } })
        } else {
          // Transfer entirely
          await tx.user_achievements.update({
            where: { id: secAch.id },
            data: { user_id: primaryUserId },
          })
        }
      }

      // 9. Transfer consumables (merge quantities)
      const primaryConsumables = await tx.user_consumables.findMany({
        where: { user_id: primaryUserId },
      })
      const primaryConsumableMap = new Map(
        primaryConsumables.map((c) => [c.consumable_id, c])
      )

      const secondaryConsumables = await tx.user_consumables.findMany({
        where: { user_id: secondaryUserId },
      })

      for (const secCon of secondaryConsumables) {
        const priCon = primaryConsumableMap.get(secCon.consumable_id)
        if (priCon) {
          // Add quantities
          await tx.user_consumables.update({
            where: { id: priCon.id },
            data: { quantity: { increment: secCon.quantity ?? 0 } },
          })
          await tx.user_consumables.delete({ where: { id: secCon.id } })
        } else {
          await tx.user_consumables.update({
            where: { id: secCon.id },
            data: { user_id: primaryUserId },
          })
        }
      }

      // 10. Reassign history records to primary
      await tx.gambling_sessions.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.game_events.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.chat_messages.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.crate_opens.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.lottery_tickets.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.mission_completions.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.leaderboard_snapshots.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.token_transactions.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.bond_transactions.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.consumable_purchases.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.monetization_events.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      await tx.session_contributions.updateMany({
        where: { user_id: secondaryUserId },
        data: { user_id: primaryUserId },
      })

      // 11. Delete remaining secondary data that can't be transferred
      await tx.user_missions.deleteMany({ where: { user_id: secondaryUserId } })
      await tx.cooldowns.deleteMany({ where: { user_id: secondaryUserId } })
      await tx.active_buffs.deleteMany({ where: { user_id: secondaryUserId } })
      await tx.user_notifications.deleteMany({ where: { user_id: secondaryUserId } })
      await tx.player_shop_inventory.deleteMany({ where: { user_id: secondaryUserId } })

      // 12. Handle gambling stats (merge if exists)
      const secondaryGamblingStats = await tx.player_gambling_stats.findUnique({
        where: { user_id: secondaryUserId },
      })
      if (secondaryGamblingStats) {
        const primaryGamblingStats = await tx.player_gambling_stats.findUnique({
          where: { user_id: primaryUserId },
        })
        if (primaryGamblingStats) {
          await tx.player_gambling_stats.update({
            where: { user_id: primaryUserId },
            data: {
              total_wagered: { increment: secondaryGamblingStats.total_wagered ?? 0 },
              total_won: { increment: secondaryGamblingStats.total_won ?? 0 },
              total_lost: { increment: secondaryGamblingStats.total_lost ?? 0 },
              net_profit: { increment: secondaryGamblingStats.net_profit ?? 0 },
              slots_played: { increment: secondaryGamblingStats.slots_played ?? 0 },
              slots_won: { increment: secondaryGamblingStats.slots_won ?? 0 },
              blackjack_played: { increment: secondaryGamblingStats.blackjack_played ?? 0 },
              blackjack_won: { increment: secondaryGamblingStats.blackjack_won ?? 0 },
              coinflips_played: { increment: secondaryGamblingStats.coinflips_played ?? 0 },
              coinflips_won: { increment: secondaryGamblingStats.coinflips_won ?? 0 },
              lottery_tickets: { increment: secondaryGamblingStats.lottery_tickets ?? 0 },
              lottery_wins: { increment: secondaryGamblingStats.lottery_wins ?? 0 },
              jackpots_hit: { increment: secondaryGamblingStats.jackpots_hit ?? 0 },
              jackpot_total: { increment: secondaryGamblingStats.jackpot_total ?? 0 },
              biggest_win: Math.max(
                Number(primaryGamblingStats.biggest_win ?? 0),
                Number(secondaryGamblingStats.biggest_win ?? 0)
              ),
              biggest_loss: Math.max(
                Number(primaryGamblingStats.biggest_loss ?? 0),
                Number(secondaryGamblingStats.biggest_loss ?? 0)
              ),
              best_win_streak: Math.max(
                primaryGamblingStats.best_win_streak ?? 0,
                secondaryGamblingStats.best_win_streak ?? 0
              ),
              worst_loss_streak: Math.max(
                primaryGamblingStats.worst_loss_streak ?? 0,
                secondaryGamblingStats.worst_loss_streak ?? 0
              ),
            },
          })
        }
        await tx.player_gambling_stats.delete({ where: { user_id: secondaryUserId } })
      }

      // 13. Mark secondary account as merged (soft delete)
      await tx.users.update({
        where: { id: secondaryUserId },
        data: {
          merged_into_user_id: primaryUserId,
          merged_at: mergedAt,
          merge_audit_log: auditLog,
          // Clear all identifying info
          wealth: 0,
          xp: 0,
          level: 1,
          tokens: 0,
          bonds: 0,
          faction_id: null,
        },
      })
    })

    console.log(`Account merge complete: User #${secondaryUserId} merged into User #${primaryUserId}`)

    return {
      success: true,
      primaryUserId,
      secondaryUserId,
      mergedAt,
      summary: {
        wealth_added: preview.secondary.wealth,
        xp_added: preview.secondary.xp,
        items_transferred: itemsTransferred,
        crates_transferred: cratesTransferred,
        titles_transferred: titlesTransferred,
      },
    }
  },

  /**
   * Get user snapshot for merge preview
   */
  async getUserSnapshot(userId: number) {
    return prisma.users.findUnique({
      where: { id: userId },
      include: {
        factions: { select: { name: true } },
        _count: {
          select: {
            user_inventory: true,
            user_crates: true,
            user_titles: true,
            user_achievements: true,
          },
        },
      },
    }).then((user) =>
      user
        ? {
            ...user,
            faction_name: user.factions?.name ?? null,
          }
        : null
    )
  },

  /**
   * Get list of platforms for a user
   */
  getPlatforms(user: { kick_user_id?: string | null; twitch_user_id?: string | null; discord_user_id?: string | null }): string[] {
    const platforms: string[] = []
    if (user.kick_user_id) platforms.push('kick')
    if (user.twitch_user_id) platforms.push('twitch')
    if (user.discord_user_id) platforms.push('discord')
    return platforms
  },

  /**
   * Check if a user can initiate a merge (hasn't merged recently)
   */
  async canMerge(userId: number): Promise<{ allowed: boolean; reason?: string }> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { merged_into_user_id: true },
    })

    if (!user) {
      return { allowed: false, reason: 'User not found' }
    }

    if (user.merged_into_user_id) {
      return { allowed: false, reason: 'This account has already been merged into another account' }
    }

    return { allowed: true }
  },
}

export default AccountMergeService
