/**
 * Error Reporting Service
 * Unified error handling that sends to both Sentry and Discord
 */

import * as Sentry from '@sentry/nextjs'
import { DiscordService } from './discord.service'

type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal'

interface ErrorContext {
  userId?: number
  username?: string
  action?: string
  metadata?: Record<string, unknown>
}

interface ErrorReport {
  message: string
  severity: ErrorSeverity
  error?: Error
  context?: ErrorContext
}

export const ErrorReportingService = {
  /**
   * Report an error to both Sentry and Discord
   */
  async report({ message, severity, error, context }: ErrorReport): Promise<void> {
    // Always log to console
    const logMethod = severity === 'fatal' || severity === 'error' ? console.error : console.warn
    logMethod(`[${severity.toUpperCase()}] ${message}`, error ?? '', context ?? '')

    // Send to Sentry
    this.sendToSentry({ message, severity, error, context })

    // Send critical errors to Discord
    if (severity === 'error' || severity === 'fatal') {
      await this.sendToDiscord({ message, severity, error, context })
    }
  },

  /**
   * Send error to Sentry
   */
  sendToSentry({ message, severity, error, context }: ErrorReport): void {
    const sentryLevel = this.mapSeverityToSentry(severity)

    if (error) {
      Sentry.captureException(error, {
        level: sentryLevel,
        tags: {
          action: context?.action,
          userId: context?.userId?.toString(),
        },
        extra: {
          message,
          username: context?.username,
          ...context?.metadata,
        },
      })
    } else {
      Sentry.captureMessage(message, {
        level: sentryLevel,
        tags: {
          action: context?.action,
          userId: context?.userId?.toString(),
        },
        extra: {
          username: context?.username,
          ...context?.metadata,
        },
      })
    }
  },

  /**
   * Send critical error to Discord admin channel
   */
  async sendToDiscord({ message, severity, error, context }: ErrorReport): Promise<boolean> {
    const level = severity === 'fatal' ? 'error' : severity
    const discordLevel = level === 'info' || level === 'warning' || level === 'error' ? level : 'error'

    const details = [
      context?.action ? `Action: ${context.action}` : null,
      context?.userId ? `User ID: ${context.userId}` : null,
      context?.username ? `Username: ${context.username}` : null,
      error?.stack ? `\`\`\`\n${error.stack.slice(0, 500)}\n\`\`\`` : null,
    ]
      .filter(Boolean)
      .join('\n')

    return DiscordService.postSystemAlert(discordLevel, message, details || undefined)
  },

  /**
   * Map severity to Sentry level
   */
  mapSeverityToSentry(severity: ErrorSeverity): Sentry.SeverityLevel {
    const map: Record<ErrorSeverity, Sentry.SeverityLevel> = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      fatal: 'fatal',
    }
    return map[severity]
  },

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Report an info-level message
   */
  info(message: string, context?: ErrorContext): void {
    this.report({ message, severity: 'info', context })
  },

  /**
   * Report a warning
   */
  warn(message: string, context?: ErrorContext): void {
    this.report({ message, severity: 'warning', context })
  },

  /**
   * Report an error (sends to Discord)
   */
  async error(message: string, error?: Error, context?: ErrorContext): Promise<void> {
    await this.report({ message, severity: 'error', error, context })
  },

  /**
   * Report a fatal error (sends to Discord)
   */
  async fatal(message: string, error?: Error, context?: ErrorContext): Promise<void> {
    await this.report({ message, severity: 'fatal', error, context })
  },

  // =============================================================================
  // DOMAIN-SPECIFIC ERROR REPORTERS
  // =============================================================================

  /**
   * Report a payment/monetization error
   */
  async paymentError(
    message: string,
    error?: Error,
    metadata?: { userId?: number; amount?: number; platform?: string }
  ): Promise<void> {
    await this.error(message, error, {
      action: 'payment',
      userId: metadata?.userId,
      metadata: {
        amount: metadata?.amount,
        platform: metadata?.platform,
      },
    })
  },

  /**
   * Report an economy error (gambling, robbery, etc.)
   */
  async economyError(
    message: string,
    error?: Error,
    metadata?: { userId?: number; action?: string; amount?: bigint }
  ): Promise<void> {
    await this.error(message, error, {
      action: metadata?.action ?? 'economy',
      userId: metadata?.userId,
      metadata: {
        amount: metadata?.amount?.toString(),
      },
    })
  },

  /**
   * Report an authentication error
   */
  async authError(
    message: string,
    error?: Error,
    metadata?: { platform?: string; oauthError?: string }
  ): Promise<void> {
    await this.error(message, error, {
      action: 'auth',
      metadata: {
        platform: metadata?.platform,
        oauthError: metadata?.oauthError,
      },
    })
  },

  /**
   * Report a database error
   */
  async dbError(
    message: string,
    error?: Error,
    metadata?: { operation?: string; table?: string }
  ): Promise<void> {
    await this.error(message, error, {
      action: 'database',
      metadata: {
        operation: metadata?.operation,
        table: metadata?.table,
      },
    })
  },

  /**
   * Report an external API error (Kick, Twitch, Discord, etc.)
   */
  async apiError(
    message: string,
    error?: Error,
    metadata?: { service?: string; endpoint?: string; statusCode?: number }
  ): Promise<void> {
    await this.error(message, error, {
      action: 'external_api',
      metadata: {
        service: metadata?.service,
        endpoint: metadata?.endpoint,
        statusCode: metadata?.statusCode,
      },
    })
  },
}

export default ErrorReportingService
