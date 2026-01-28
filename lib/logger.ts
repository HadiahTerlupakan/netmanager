/**
 * Bisa di-extend untuk integrasi dengan logging service (Sentry, Datadog, dll)
 */

import { randomUUID } from 'crypto'

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
        // Send to Sentry for production error tracking
        try {
          const Sentry = require('@sentry/nextjs')
          if (error) {
            Sentry.captureException(error, { extra: context })
          } else {
            Sentry.captureMessage(message, { level: 'error', extra: context })
          }
        } catch (e) {
          // Sentry not available, silently fail
        }
        break
    }

    // Production logging to external service
    if (process.env.NODE_ENV === 'production' && level !== LogLevel.DEBUG) {
      // Future: Add Datadog, CloudWatch, etc. integration here
    }
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

  // Database Logging Methods
  async logActivity(data: { action: string; subject: string; details?: any; userId?: string; ipAddress?: string; userAgent?: string }) {
    this.info(`[ACTIVITY] ${data.action} ${data.subject}`, data)
    try {
      // Dynamic import to avoid circular dependency if any, though prisma is safe here
      const { prisma } = await import('@/lib/prisma')

      await prisma.systemLog.create({
        data: {
          id: randomUUID(),
          type: 'ACTIVITY',
          action: data.action,
          subject: data.subject,
          details: data.details ? JSON.stringify(data.details) : null,
          userId: data.userId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        }
      })
    } catch (error) {
      this.error('Failed to save activity log to DB', error as Error)
    }
  }

  async logAuth(data: { action: string; userId?: string; details?: any; ipAddress?: string; userAgent?: string }) {
    this.info(`[AUTH] ${data.action}`, data)
    try {
      const { prisma } = await import('@/lib/prisma')

      await prisma.systemLog.create({
        data: {
          id: randomUUID(),
          type: 'AUTH',
          action: data.action,
          subject: 'Auth',
          details: data.details ? JSON.stringify(data.details) : null,
          userId: data.userId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        }
      })
    } catch (error) {
      this.error('Failed to save auth log to DB', error as Error)
    }
  }
}

// Export singleton instance
export const logger = new Logger(
  process.env.LOG_LEVEL as LogLevel || LogLevel.INFO
)

// Export class untuk testing
export { Logger }

