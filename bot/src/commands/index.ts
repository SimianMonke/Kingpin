import { config } from '../config'
import { logger } from '../utils/logger'
import { cooldownManager } from '../utils/cooldown'
import { platformManager } from '../platforms'
import type { ChatMessage, CommandContext, CommandHandler } from '../types'

// Import command handlers
import { profileCommands } from './profile'
import { leaderboardCommands } from './leaderboard'
import { factionCommands } from './faction'
import { juicernautCommands } from './juicernaut'
import { inventoryCommands } from './inventory'
import { missionCommands } from './missions'
import { adminCommands } from './admin'
import { heistCommands } from './heist'
import { gamblingCommands } from './gambling'

// =============================================================================
// COMMAND REGISTRY
// =============================================================================

interface CommandDefinition {
  aliases: string[]
  handler: CommandHandler
  cooldown?: number // Override default cooldown (ms)
  modOnly?: boolean
  broadcasterOnly?: boolean
}

const commands: Map<string, CommandDefinition> = new Map()

// Register commands
function registerCommand(name: string, definition: CommandDefinition): void {
  commands.set(name.toLowerCase(), definition)
  // Also register aliases
  for (const alias of definition.aliases) {
    commands.set(alias.toLowerCase(), definition)
  }
}

// =============================================================================
// REGISTER ALL COMMANDS
// =============================================================================

// Profile commands
registerCommand('profile', {
  aliases: ['p', 'stats'],
  handler: profileCommands.profile,
})

registerCommand('balance', {
  aliases: ['bal', 'money', 'wealth'],
  handler: profileCommands.balance,
})

registerCommand('level', {
  aliases: ['lvl', 'xp'],
  handler: profileCommands.level,
})

// Leaderboard commands
registerCommand('lb', {
  aliases: ['leaderboard', 'top'],
  handler: leaderboardCommands.leaderboard,
})

registerCommand('rank', {
  aliases: ['myrank'],
  handler: leaderboardCommands.rank,
})

// Faction commands
registerCommand('factions', {
  aliases: ['faction list'],
  handler: factionCommands.listFactions,
})

registerCommand('faction', {
  aliases: ['f'],
  handler: factionCommands.faction,
})

registerCommand('territories', {
  aliases: ['territory', 'map'],
  handler: factionCommands.territories,
})

// Juicernaut commands
registerCommand('juice', {
  aliases: ['juicernaut', 'jn'],
  handler: juicernautCommands.juice,
})

registerCommand('juicehall', {
  aliases: ['juice hall', 'jnhall', 'juicehof'],
  handler: juicernautCommands.juiceHall,
})

// Inventory commands
registerCommand('inventory', {
  aliases: ['inv', 'items'],
  handler: inventoryCommands.inventory,
})

registerCommand('crates', {
  aliases: ['crate'],
  handler: inventoryCommands.crates,
})

registerCommand('shop', {
  aliases: ['store'],
  handler: inventoryCommands.shop,
})

registerCommand('market', {
  aliases: ['blackmarket', 'bm'],
  handler: inventoryCommands.market,
})

registerCommand('titles', {
  aliases: ['title'],
  handler: inventoryCommands.titles,
})

// Mission commands
registerCommand('missions', {
  aliases: ['mission', 'quests'],
  handler: missionCommands.missions,
})

registerCommand('achievements', {
  aliases: ['achieve', 'ach'],
  handler: missionCommands.achievements,
})

// Heist commands
registerCommand('grab', {
  aliases: [],
  handler: heistCommands.grab,
  cooldown: 0, // No cooldown for grab
})

// Gambling commands (Phase 11)
registerCommand('slots', {
  aliases: ['slot'],
  handler: gamblingCommands.slots,
  cooldown: 5000,
})

registerCommand('jackpot', {
  aliases: ['jp'],
  handler: gamblingCommands.jackpot,
  cooldown: 10000,
})

registerCommand('blackjack', {
  aliases: ['bj', '21'],
  handler: gamblingCommands.blackjack,
  cooldown: 10000,
})

registerCommand('hit', {
  aliases: [],
  handler: gamblingCommands.hit,
  cooldown: 2000,
})

registerCommand('stand', {
  aliases: ['stay'],
  handler: gamblingCommands.stand,
  cooldown: 2000,
})

registerCommand('double', {
  aliases: ['dd'],
  handler: gamblingCommands.double,
  cooldown: 2000,
})

registerCommand('flip', {
  aliases: ['coinflip', 'cf'],
  handler: gamblingCommands.flip,
  cooldown: 30000,
})

registerCommand('accept', {
  aliases: ['acceptflip'],
  handler: gamblingCommands.accept,
  cooldown: 5000,
})

registerCommand('flips', {
  aliases: ['openflips'],
  handler: gamblingCommands.flips,
  cooldown: 10000,
})

registerCommand('cancelflip', {
  aliases: [],
  handler: gamblingCommands.cancelflip,
  cooldown: 5000,
})

registerCommand('lottery', {
  aliases: ['lotto-buy'],
  handler: gamblingCommands.lottery,
  cooldown: 10000,
})

registerCommand('lotto', {
  aliases: ['lottoinfo'],
  handler: gamblingCommands.lotto,
  cooldown: 10000,
})

registerCommand('gamblestats', {
  aliases: ['gstats', 'gamblingstat'],
  handler: gamblingCommands.gamblestats,
  cooldown: 10000,
})

// Admin commands
registerCommand('startsession', {
  aliases: ['startstream'],
  handler: adminCommands.startSession,
  modOnly: true,
})

registerCommand('endsession', {
  aliases: ['endstream'],
  handler: adminCommands.endSession,
  modOnly: true,
})

registerCommand('givewealth', {
  aliases: ['addwealth'],
  handler: adminCommands.giveWealth,
  broadcasterOnly: true,
})

registerCommand('givexp', {
  aliases: ['addxp'],
  handler: adminCommands.giveXp,
  broadcasterOnly: true,
})

registerCommand('givecrate', {
  aliases: ['addcrate'],
  handler: adminCommands.giveCrate,
  broadcasterOnly: true,
})

// =============================================================================
// COMMAND ROUTER
// =============================================================================

export class CommandRouter {
  private prefix: string

  constructor() {
    this.prefix = config.bot.commandPrefix
  }

  /**
   * Process an incoming chat message for commands
   */
  async processMessage(message: ChatMessage): Promise<void> {
    // Check if message starts with command prefix
    if (!message.message.startsWith(this.prefix)) {
      return
    }

    // Parse command and arguments
    const content = message.message.slice(this.prefix.length).trim()
    const parts = content.split(/\s+/)
    const commandName = parts[0]?.toLowerCase()
    const args = parts.slice(1)

    if (!commandName) return

    // Find command
    const command = commands.get(commandName)
    if (!command) {
      // Unknown command - silently ignore
      return
    }

    // Check permissions
    if (command.broadcasterOnly && !message.isBroadcaster) {
      return // Silently ignore
    }

    if (command.modOnly && !message.isMod && !message.isBroadcaster) {
      return // Silently ignore
    }

    // Check cooldown
    const cooldownMs = command.cooldown ?? config.bot.commandCooldownMs
    if (cooldownMs > 0 && cooldownManager.isOnCooldown(message.userId, commandName)) {
      const remaining = cooldownManager.getRemainingCooldown(message.userId, commandName)
      logger.debug(`Command ${commandName} on cooldown for ${message.username}: ${remaining}ms remaining`)
      return // Silently ignore cooldowns
    }

    // Create command context
    const ctx: CommandContext = {
      message,
      args,
      command: commandName,
      reply: async (text: string) => {
        await platformManager.sendMessage(message.platform, message.channelId, text)
      },
    }

    // Execute command
    try {
      logger.debug(`Executing command: ${commandName} from ${message.username} on ${message.platform}`)
      await command.handler(ctx)

      // Set cooldown after successful execution
      if (cooldownMs > 0) {
        cooldownManager.setCooldown(message.userId, commandName, cooldownMs)
      }
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error)
      await ctx.reply(`Error: Something went wrong. Please try again.`)
    }
  }
}

// Export singleton instance
export const commandRouter = new CommandRouter()
export default commandRouter
