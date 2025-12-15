import { config, validateConfig } from './config'
import { logger } from './utils/logger'
import { platformManager } from './platforms'
import { commandRouter } from './commands'
import { handleRedemption } from './handlers'
import type { ChatMessage, ChannelPointRedemption, Platform } from './types'

// =============================================================================
// KINGPIN BOT - MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  logger.info('='.repeat(60))
  logger.info('  KINGPIN BOT')
  logger.info('  Multi-platform chatbot for Kingpin RPG')
  logger.info('='.repeat(60))

  // Validate configuration
  logger.info('Validating configuration...')
  validateConfig()
  logger.info('Configuration valid')

  // Set up event handlers
  setupEventHandlers()

  // Initialize platform connections
  logger.info('Initializing platform connections...')
  await platformManager.initialize()

  // Log connected platforms
  const connected = platformManager.getConnectedPlatforms()
  if (connected.length === 0) {
    logger.error('No platforms connected! Check your configuration.')
    process.exit(1)
  }

  logger.info(`Connected to: ${connected.join(', ')}`)
  logger.info('Bot is ready!')
  logger.info('='.repeat(60))
}

/**
 * Set up event handlers for platform events
 */
function setupEventHandlers(): void {
  // Handle incoming chat messages
  platformManager.on('message', async (message: ChatMessage) => {
    try {
      await commandRouter.processMessage(message)
    } catch (error) {
      logger.error('Error processing message:', error)
    }
  })

  // Handle channel point redemptions
  platformManager.on('redemption', async (redemption: ChannelPointRedemption) => {
    try {
      await handleRedemption(redemption)
    } catch (error) {
      logger.error('Error processing redemption:', error)
    }
  })

  // Handle platform connection events
  platformManager.on('connected', (platform: Platform) => {
    logger.info(`Connected to ${platform}`)
  })

  platformManager.on('disconnected', (platform: Platform) => {
    logger.warn(`Disconnected from ${platform}`)
  })

  platformManager.on('error', (platform: Platform, error: Error) => {
    logger.error(`Error on ${platform}:`, error)
  })
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down...`)

  try {
    await platformManager.shutdown()
    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

// Handle process signals
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error)
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason)
})

// Start the bot
main().catch((error) => {
  logger.error('Failed to start bot:', error)
  process.exit(1)
})
