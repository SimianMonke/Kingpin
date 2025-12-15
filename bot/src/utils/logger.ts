import { config } from '../config'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private minLevel: number

  constructor() {
    this.minLevel = LOG_LEVELS[config.bot.logLevel as LogLevel] || LOG_LEVELS.info
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < this.minLevel) return

    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    if (data !== undefined) {
      console.log(prefix, message, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
    } else {
      console.log(prefix, message)
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }
}

export const logger = new Logger()
export default logger
