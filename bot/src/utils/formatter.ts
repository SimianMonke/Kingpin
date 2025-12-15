// =============================================================================
// CHAT MESSAGE FORMATTER
// =============================================================================

/**
 * Format username with optional title prefix
 * Titles appear before username: [Title] @Username
 * If no title, just returns @Username
 */
export function formatUsernameWithTitle(
  username: string,
  equippedTitle?: string | null
): string {
  if (equippedTitle) {
    return `[${equippedTitle}] @${username}`
  }
  return `@${username}`
}

/**
 * Format currency with commas
 */
export function formatWealth(amount: number): string {
  return `$${amount.toLocaleString()}`
}

/**
 * Format XP with commas
 */
export function formatXp(amount: number): string {
  return amount.toLocaleString()
}

/**
 * Format time remaining (ms to human readable)
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'now'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()

  if (diff > 0) {
    return `in ${formatTimeRemaining(diff)}`
  } else {
    return formatTimeRemaining(-diff) + ' ago'
  }
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Format tier with emoji
 */
export function formatTier(tier: string): string {
  const tierEmojis: Record<string, string> = {
    Rookie: '🔰',
    Associate: '⭐',
    Soldier: '🎖️',
    Captain: '🏅',
    Underboss: '👑',
    Kingpin: '💎',
  }
  return `${tierEmojis[tier] || ''} ${tier}`
}

/**
 * Format item tier with color indicator
 */
export function formatItemTier(tier: string): string {
  const tierIndicators: Record<string, string> = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    legendary: '🟡',
  }
  return `${tierIndicators[tier.toLowerCase()] || ''} ${tier}`
}

/**
 * Format crate tier with emoji
 */
export function formatCrateTier(tier: string): string {
  const crateEmojis: Record<string, string> = {
    common: '📦',
    uncommon: '🎁',
    rare: '💎',
    legendary: '👑',
  }
  return `${crateEmojis[tier.toLowerCase()] || '📦'} ${tier}`
}

/**
 * Format progress bar
 */
export function formatProgressBar(current: number, max: number, length: number = 10): string {
  const filled = Math.round((current / max) * length)
  const empty = length - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Format leaderboard entry
 */
export function formatLeaderboardEntry(
  rank: number,
  username: string,
  value: number | string,
  isCurrentUser: boolean = false
): string {
  const rankEmojis: Record<number, string> = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  }
  const rankStr = rankEmojis[rank] || `${rank}.`
  const highlight = isCurrentUser ? '→ ' : ''
  return `${highlight}${rankStr} ${username} - ${value}`
}

/**
 * Format profile message
 */
export function formatProfile(profile: {
  username: string
  kingpinName: string | null
  level: number
  xp: number
  xpToNextLevel: number
  wealth: number
  statusTier: string
  equippedTitle: string | null
  checkinStreak: number
  faction: { name: string } | null
}): string {
  const displayName = profile.kingpinName || profile.username
  const title = profile.equippedTitle ? ` [${profile.equippedTitle}]` : ''
  const faction = profile.faction ? ` | ${profile.faction.name}` : ''

  return [
    `👤 ${displayName}${title}`,
    `${formatTier(profile.statusTier)}`,
    `💰 ${formatWealth(profile.wealth)}`,
    `⭐ Lvl ${profile.level} (${formatXp(profile.xp)}/${formatXp(profile.xpToNextLevel)} XP)`,
    `🔥 ${profile.checkinStreak} day streak${faction}`,
  ].join(' | ')
}

/**
 * Format play result message with title prefix
 * Format: [Title] @Username 🎰 Event Name! +$500 | +50 XP
 */
export function formatPlayResult(
  username: string,
  equippedTitle: string | null | undefined,
  result: {
    event: {
      name: string
      description: string
      wealthChange: number
      xpGained: number
      isBust: boolean
    }
    jailed?: { durationMinutes: number }
    crateDropped?: { tier: string }
  }
): string {
  const { event, jailed, crateDropped } = result
  const userDisplay = formatUsernameWithTitle(username, equippedTitle)

  let message = `${userDisplay} 🎰 ${event.name}!`

  if (event.wealthChange !== 0) {
    const sign = event.wealthChange > 0 ? '+' : ''
    message += ` ${sign}${formatWealth(event.wealthChange)}`
  }

  if (event.xpGained > 0) {
    message += ` | +${formatXp(event.xpGained)} XP`
  }

  if (jailed) {
    message += ` | 🚔 BUSTED! Jailed for ${jailed.durationMinutes}m`
  }

  if (crateDropped) {
    message += ` | ${formatCrateTier(crateDropped.tier)} crate dropped!`
  }

  return message
}

/**
 * Format rob result message with attacker's title
 * Format: [Title] @Attacker robbed $X from @Defender!
 */
export function formatRobResult(
  attackerName: string,
  attackerTitle: string | null | undefined,
  result: {
    robSuccess: boolean
    wealthStolen: number
    itemStolen?: { name: string; tier: string }
    defender: { username: string }
    failReason?: string
  }
): string {
  const attackerDisplay = formatUsernameWithTitle(attackerName, attackerTitle)

  if (!result.robSuccess) {
    return `❌ ${attackerDisplay} failed to rob @${result.defender.username}! ${result.failReason || ''}`
  }

  let message = `💰 ${attackerDisplay} robbed ${formatWealth(result.wealthStolen)} from @${result.defender.username}!`

  if (result.itemStolen) {
    message += ` Also stole their ${formatItemTier(result.itemStolen.tier)} ${result.itemStolen.name}!`
  }

  return message
}

/**
 * Format bail result message with title
 * Format: [Title] @Username escaped jail!
 */
export function formatBailResult(
  username: string,
  equippedTitle: string | null | undefined,
  paid: number
): string {
  const userDisplay = formatUsernameWithTitle(username, equippedTitle)
  return `⚖️ ${userDisplay} paid ${formatWealth(paid)} bail and escaped jail!`
}

/**
 * Format crate open result
 */
export function formatCrateOpenResult(result: {
  crateTier: string
  dropType: string
  reward: {
    item?: { name: string; type: string; tier: string }
    wealth?: { amount: number }
    title?: { title: string; isDuplicate: boolean; duplicateValue?: number }
  }
}): string {
  const { crateTier, reward } = result

  if (reward.item) {
    return `${formatCrateTier(crateTier)} opened! Got ${formatItemTier(reward.item.tier)} ${reward.item.name} (${reward.item.type})`
  }

  if (reward.wealth) {
    return `${formatCrateTier(crateTier)} opened! Got ${formatWealth(reward.wealth.amount)}`
  }

  if (reward.title) {
    if (reward.title.isDuplicate) {
      return `${formatCrateTier(crateTier)} opened! "${reward.title.title}" (duplicate - ${formatWealth(reward.title.duplicateValue || 0)})`
    }
    return `${formatCrateTier(crateTier)} opened! Unlocked "${reward.title.title}" title!`
  }

  return `${formatCrateTier(crateTier)} opened!`
}

/**
 * Format jail status message
 */
export function formatJailStatus(username: string, releaseAt: string | null): string {
  if (!releaseAt) {
    return `@${username} is not in jail.`
  }

  const releaseTime = new Date(releaseAt)
  const now = new Date()
  const remaining = releaseTime.getTime() - now.getTime()

  if (remaining <= 0) {
    return `@${username} is not in jail.`
  }

  return `🚔 @${username} is in jail! Remaining: ${formatTimeRemaining(remaining)}. Use !bail to escape.`
}

/**
 * Format level up announcement with title
 * Format: [Title] @Username leveled up to X!
 */
export function formatLevelUp(
  username: string,
  equippedTitle: string | null | undefined,
  newLevel: number,
  rewards?: { wealth?: number; unlockedTier?: string }
): string {
  const userDisplay = formatUsernameWithTitle(username, equippedTitle)
  let message = `🎉 ${userDisplay} leveled up to ${newLevel}!`

  if (rewards?.wealth) {
    message += ` | Bonus: ${formatWealth(rewards.wealth)}`
  }

  if (rewards?.unlockedTier) {
    message += ` | 🆙 NEW TIER: ${formatTier(rewards.unlockedTier)}`
  }

  return message
}

/**
 * Format check-in announcement with title
 * Format: [Title] @Username checked in! (X day streak)
 */
export function formatCheckin(
  username: string,
  equippedTitle: string | null | undefined,
  streak: number,
  rewards: { wealth: number; xp: number; crateDropped?: { tier: string } }
): string {
  const userDisplay = formatUsernameWithTitle(username, equippedTitle)
  let message = `✅ ${userDisplay} checked in!`

  if (streak > 1) {
    message += ` 🔥 ${streak} day streak!`
  }

  message += ` | +${formatWealth(rewards.wealth)} | +${formatXp(rewards.xp)} XP`

  if (rewards.crateDropped) {
    message += ` | ${formatCrateTier(rewards.crateDropped.tier)} crate!`
  }

  return message
}

/**
 * Format crate open result with title
 * Format: [Title] @Username opened a crate!
 */
export function formatCrateOpen(
  username: string,
  equippedTitle: string | null | undefined,
  result: {
    crateTier: string
    dropType: string
    reward: {
      item?: { name: string; type: string; tier: string }
      wealth?: { amount: number }
      title?: { title: string; isDuplicate: boolean; duplicateValue?: number }
    }
  }
): string {
  const userDisplay = formatUsernameWithTitle(username, equippedTitle)
  const { crateTier, reward } = result

  let message = `${userDisplay} ${formatCrateTier(crateTier)} opened!`

  if (reward.item) {
    message += ` Got ${formatItemTier(reward.item.tier)} ${reward.item.name} (${reward.item.type})`
  } else if (reward.wealth) {
    message += ` Got ${formatWealth(reward.wealth.amount)}`
  } else if (reward.title) {
    if (reward.title.isDuplicate) {
      message += ` "${reward.title.title}" (duplicate - ${formatWealth(reward.title.duplicateValue || 0)})`
    } else {
      message += ` Unlocked "${reward.title.title}" title!`
    }
  }

  return message
}

export default {
  formatUsernameWithTitle,
  formatWealth,
  formatXp,
  formatTimeRemaining,
  formatRelativeTime,
  truncate,
  formatTier,
  formatItemTier,
  formatCrateTier,
  formatProgressBar,
  formatLeaderboardEntry,
  formatProfile,
  formatPlayResult,
  formatRobResult,
  formatBailResult,
  formatCrateOpenResult,
  formatCrateOpen,
  formatJailStatus,
  formatLevelUp,
  formatCheckin,
}
