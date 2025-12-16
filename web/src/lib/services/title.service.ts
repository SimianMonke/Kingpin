import { prisma } from '../db'

// =============================================================================
// TITLE SERVICE TYPES
// =============================================================================

export interface UserTitleInfo {
  title: string
  is_equipped: boolean | null
  unlocked_at: Date | null
}

export interface TitleEquipResult {
  success: boolean
  error?: string
  equippedTitle: string | null
}

// =============================================================================
// TITLE SERVICE
// =============================================================================

export const TitleService = {
  /**
   * Get all unlocked titles for a user
   */
  async getTitles(user_id: number): Promise<UserTitleInfo[]> {
    const titles = await prisma.user_titles.findMany({
      where: { user_id },
      orderBy: { unlocked_at: 'desc' },
    })

    return titles.map(t => ({
      title: t.title,
      is_equipped: t.is_equipped,
      unlocked_at: t.unlocked_at,
    }))
  },

  /**
   * Get currently equipped title
   */
  async getEquippedTitle(user_id: number): Promise<string | null> {
    const equipped = await prisma.user_titles.findFirst({
      where: { user_id, is_equipped: true },
    })

    return equipped?.title ?? null
  },

  /**
   * Equip a title
   */
  async equipTitle(user_id: number, title: string): Promise<TitleEquipResult> {
    // Check if user owns this title
    const userTitle = await prisma.user_titles.findUnique({
      where: {
        user_id_title: { user_id, title },
      },
    })

    if (!userTitle) {
      return {
        success: false,
        error: 'You do not own this title',
        equippedTitle: null,
      }
    }

    // Unequip current title and equip new one in transaction
    await prisma.$transaction(async (tx) => {
      // Unequip all titles
      await tx.user_titles.updateMany({
        where: { user_id, is_equipped: true },
        data: { is_equipped: false },
      })

      // Equip selected title
      await tx.user_titles.update({
        where: {
          user_id_title: { user_id, title },
        },
        data: { is_equipped: true },
      })
    })

    return {
      success: true,
      equippedTitle: title,
    }
  },

  /**
   * Unequip current title
   */
  async unequipTitle(user_id: number): Promise<TitleEquipResult> {
    await prisma.user_titles.updateMany({
      where: { user_id, is_equipped: true },
      data: { is_equipped: false },
    })

    return {
      success: true,
      equippedTitle: null,
    }
  },

  /**
   * Unlock a new title for a user
   */
  async unlockTitle(user_id: number, title: string): Promise<boolean> {
    try {
      await prisma.user_titles.upsert({
        where: {
          user_id_title: { user_id, title },
        },
        create: {
          user_id,
          title,
          is_equipped: false,
        },
        update: {}, // Already owned
      })
      return true
    } catch {
      return false
    }
  },

  /**
   * Check if user owns a title
   */
  async hasTitle(user_id: number, title: string): Promise<boolean> {
    const userTitle = await prisma.user_titles.findUnique({
      where: {
        user_id_title: { user_id, title },
      },
    })

    return !!userTitle
  },

  /**
   * Get title count for a user
   */
  async getTitleCount(user_id: number): Promise<number> {
    return prisma.user_titles.count({
      where: { user_id },
    })
  },

  /**
   * Format display name with title
   */
  formatWithTitle(display_name: string, title: string | null): string {
    if (!title) return display_name
    return `[${title}] ${display_name}`
  },
}

export default TitleService
