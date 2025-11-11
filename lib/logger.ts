/**
 * Logging Utility
 * 
 * Structured logging dengan level yang berbeda
 * Bisa di-extend untuk integrasi dengan logging service (Sentry, Datadog, dll)
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private minLevel: LogLevel

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    const currentLevelIndex = levels.indexOf(this.minLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return

    const formattedMessage = this.formatMessage(level, message, context)
    
    // Log ke console dengan format yang sesuai
    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedMessage)
        }
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        if (error) {
          console.error('Error stack:', error.stack)
        }
        // TODO: Send ke error tracking service (Sentry, dll)
        break
    }

    // TODO: Send ke logging service (Datadog, CloudWatch, dll) untuk production
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error)
  }

  // Helper untuk logging API requests
  apiRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext) {
    this.info(`API ${method} ${path}`, {
      ...context,
      statusCode,
      duration: `${duration}ms`,
    })
  }

  // Helper untuk logging database operations
  dbOperation(operation: string, model: string, duration: number, context?: LogContext) {
    this.debug(`DB ${operation} ${model}`, {
      ...context,
      duration: `${duration}ms`,
    })
  }
}

// Export singleton instance
export const logger = new Logger(
  process.env.LOG_LEVEL as LogLevel || LogLevel.INFO
)

// Export class untuk testing
export { Logger }

