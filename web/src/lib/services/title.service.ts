import { prisma } from '../db'

// =============================================================================
// TITLE SERVICE TYPES
// =============================================================================

export interface UserTitleInfo {
  title: string
  isEquipped: boolean
  unlockedAt: Date
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
  async getTitles(userId: number): Promise<UserTitleInfo[]> {
    const titles = await prisma.userTitle.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    })

    return titles.map(t => ({
      title: t.title,
      isEquipped: t.isEquipped,
      unlockedAt: t.unlockedAt,
    }))
  },

  /**
   * Get currently equipped title
   */
  async getEquippedTitle(userId: number): Promise<string | null> {
    const equipped = await prisma.userTitle.findFirst({
      where: { userId, isEquipped: true },
    })

    return equipped?.title ?? null
  },

  /**
   * Equip a title
   */
  async equipTitle(userId: number, title: string): Promise<TitleEquipResult> {
    // Check if user owns this title
    const userTitle = await prisma.userTitle.findUnique({
      where: {
        userId_title: { userId, title },
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
      await tx.userTitle.updateMany({
        where: { userId, isEquipped: true },
        data: { isEquipped: false },
      })

      // Equip selected title
      await tx.userTitle.update({
        where: {
          userId_title: { userId, title },
        },
        data: { isEquipped: true },
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
  async unequipTitle(userId: number): Promise<TitleEquipResult> {
    await prisma.userTitle.updateMany({
      where: { userId, isEquipped: true },
      data: { isEquipped: false },
    })

    return {
      success: true,
      equippedTitle: null,
    }
  },

  /**
   * Unlock a new title for a user
   */
  async unlockTitle(userId: number, title: string): Promise<boolean> {
    try {
      await prisma.userTitle.upsert({
        where: {
          userId_title: { userId, title },
        },
        create: {
          userId,
          title,
          isEquipped: false,
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
  async hasTitle(userId: number, title: string): Promise<boolean> {
    const userTitle = await prisma.userTitle.findUnique({
      where: {
        userId_title: { userId, title },
      },
    })

    return !!userTitle
  },

  /**
   * Get title count for a user
   */
  async getTitleCount(userId: number): Promise<number> {
    return prisma.userTitle.count({
      where: { userId },
    })
  },

  /**
   * Format display name with title
   */
  formatWithTitle(displayName: string, title: string | null): string {
    if (!title) return displayName
    return `[${title}] ${displayName}`
  },
}

export default TitleService
