/**
 * Bisa di-extend untuk integrasi dengan logging service (Sentry, Datadog, dll)
 * Enhanced with timing utility for performance monitoring
 */

import { randomUUID } from "crypto";

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

interface LogContext {
  [key: string]: unknown;
}

interface TimerEntry {
  label: string;
  start: number;
  context?: LogContext;
}

interface LoggerActorInput {
  type: string;
  id: string;
  userId?: string;
}

interface ActivityLogInput {
  action: string;
  subject: string;
  details?: Record<string, unknown>;
  actor?: LoggerActorInput;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
}

interface AuthLogInput {
  action: string;
  actor?: LoggerActorInput;
  userId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private minLevel: LogLevel;
  private activeTimers = new Map<string, TimerEntry>();

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  private resolveActor(data: { actor?: LoggerActorInput; userId?: string }) {
    if (data.actor) {
      return {
        actorType: data.actor.type,
        actorId: data.actor.id,
        userId:
          data.actor.type === "user"
            ? data.actor.userId || data.actor.id
            : null,
      };
    }

    if (!data.userId) {
      return {
        actorType: null,
        actorId: null,
        userId: null,
      };
    }

    return {
      actorType: "user",
      actorId: data.userId,
      userId: data.userId,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private async log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        if (error) {
          console.error("Error stack:", error.stack);
        }
        break;
    }
  }

  private normalizeMessage(message: unknown): string {
    return typeof message === "string" ? message : JSON.stringify(message);
  }

  private normalizeContext(args: unknown[]): LogContext | undefined {
    if (args.length === 0) return undefined;
    return { args };
  }

  private normalizeError(error: unknown): Error | undefined {
    if (error instanceof Error) return error;
    if (error === undefined || error === null) return undefined;
    return new Error(typeof error === "string" ? error : JSON.stringify(error));
  }

  debug(message: unknown, ...args: unknown[]) {
    this.log(
      LogLevel.DEBUG,
      this.normalizeMessage(message),
      this.normalizeContext(args),
    );
  }

  info(message: unknown, ...args: unknown[]) {
    this.log(
      LogLevel.INFO,
      this.normalizeMessage(message),
      this.normalizeContext(args),
    );
  }

  warn(message: unknown, ...args: unknown[]) {
    this.log(
      LogLevel.WARN,
      this.normalizeMessage(message),
      this.normalizeContext(args),
    );
  }

  error(message: unknown, error?: unknown, context?: unknown) {
    this.log(
      LogLevel.ERROR,
      this.normalizeMessage(message),
      context && typeof context === "object"
        ? (context as LogContext)
        : undefined,
      this.normalizeError(error),
    );
  }

  // Helper untuk logging API requests
  apiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ) {
    this.info(`API ${method} ${path}`, {
      ...context,
      statusCode,
      duration: `${duration}ms`,
    });
  }

  // Helper untuk logging database operations
  dbOperation(
    operation: string,
    model: string,
    duration: number,
    context?: LogContext,
  ) {
    this.debug(`DB ${operation} ${model}`, {
      ...context,
      duration: `${duration}ms`,
    });
  }

  /**
   * Start a timer for performance monitoring
   * @param label - Unique label for the timer
   * @param context - Optional context to include when timer ends
   * @returns Timer ID that can be used to stop the timer
   */
  startTimer(label: string, context?: LogContext): string {
    const timerId = `${label}-${randomUUID()}`;
    this.activeTimers.set(timerId, {
      label,
      start: performance.now(),
      context,
    });

    if (this.isDevelopment) {
      this.debug(`Timer started: ${label}`);
    }

    return timerId;
  }

  /**
   * Stop a timer and log the duration
   * @param timerId - Timer ID returned from startTimer
   * @param additionalContext - Additional context to include in the log
   * @returns Duration in milliseconds, or null if timer not found
   */
  stopTimer(timerId: string, additionalContext?: LogContext): number | null {
    const timer = this.activeTimers.get(timerId);
    if (!timer) {
      this.warn(`Timer not found: ${timerId}`);
      return null;
    }

    const duration = performance.now() - timer.start;
    this.activeTimers.delete(timerId);

    this.info(`Timer completed: ${timer.label}`, {
      ...timer.context,
      ...additionalContext,
      duration: `${duration.toFixed(2)}ms`,
    });

    return duration;
  }

  /**
   * Time an async function execution
   * @param label - Label for the timer
   * @param fn - Async function to time
   * @param context - Optional context
   * @returns Result of the function and duration in ms
   */
  async time<T>(
    label: string,
    fn: () => Promise<T>,
    context?: LogContext,
  ): Promise<{ result: T; duration: number }> {
    const timerId = this.startTimer(label, context);
    try {
      const result = await fn();
      const duration = this.stopTimer(timerId) ?? 0;
      return { result, duration };
    } catch (error) {
      this.stopTimer(timerId, { error: true });
      throw error;
    }
  }

  /**
   * Time a synchronous function execution
   * @param label - Label for the timer
   * @param fn - Function to time
   * @param context - Optional context
   * @returns Result of the function and duration in ms
   */
  timeSync<T>(
    label: string,
    fn: () => T,
    context?: LogContext,
  ): { result: T; duration: number } {
    const timerId = this.startTimer(label, context);
    try {
      const result = fn();
      const duration = this.stopTimer(timerId) ?? 0;
      return { result, duration };
    } catch (error) {
      this.stopTimer(timerId, { error: true });
      throw error;
    }
  }

  /**
   * Get all active timers (useful for debugging)
   */
  getActiveTimers(): { label: string; elapsedMs: number }[] {
    const now = performance.now();
    return Array.from(this.activeTimers.values()).map((timer) => ({
      label: timer.label,
      elapsedMs: now - timer.start,
    }));
  }

  // Database Logging Methods
  async logActivity(data: ActivityLogInput) {
    this.info(
      `[ACTIVITY] ${data.action} ${data.subject}`,
      data as unknown as LogContext,
    );
    try {
      const actor = this.resolveActor(data);
      const { prisma } = await import("@/lib/prisma");

      // Skip DB logging if userId is provided but doesn't exist
      if (actor.userId) {
        const userExists = await prisma.user.findUnique({
          where: { id: actor.userId },
          select: { id: true },
        });

        if (!userExists) {
          this.warn(
            `[ACTIVITY] Skipping DB log - userId not found: ${actor.userId}`,
          );
          return;
        }
      }

      const originalIsSeeding = process.env.IS_SEEDING;
      process.env.IS_SEEDING = "true";

      try {
        await prisma.systemLog.create({
          data: {
            id: randomUUID(),
            type: "ACTIVITY",
            action: data.action,
            subject: data.subject,
            details: data.details ? JSON.stringify(data.details) : null,
            userId: actor.userId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            tenantId: data.tenantId || null,
          },
        });
      } finally {
        process.env.IS_SEEDING = originalIsSeeding;
      }
    } catch (error) {
      this.error("Failed to save activity log to DB", error as Error);
    }
  }

  async logAuth(data: AuthLogInput) {
    this.info(`[AUTH] ${data.action}`, data as unknown as LogContext);
    try {
      const actor = this.resolveActor(data);
      const { prisma } = await import("@/lib/prisma");

      // Skip DB logging if userId is provided but doesn't exist
      if (actor.userId) {
        const userExists = await prisma.user.findUnique({
          where: { id: actor.userId },
          select: { id: true },
        });

        if (!userExists) {
          this.warn(
            `[AUTH] Skipping DB log - userId not found: ${actor.userId}`,
          );
          return;
        }
      }

      const originalIsSeeding = process.env.IS_SEEDING;
      process.env.IS_SEEDING = "true";

      try {
        await prisma.systemLog.create({
          data: {
            id: randomUUID(),
            type: "AUTH",
            action: data.action,
            subject: "Auth",
            details: data.details ? JSON.stringify(data.details) : null,
            userId: actor.userId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            tenantId: data.tenantId || null,
          },
        });
      } finally {
        process.env.IS_SEEDING = originalIsSeeding;
      }
    } catch (error) {
      this.error("Failed to save auth log to DB", error as Error);
    }
  }
}

// Export singleton instance
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
);

/**
 * Fire-and-forget activity logging helper.
 */
export function logActivitySafe(data: ActivityLogInput): void {
  logger
    .logActivity(data)
    .catch((error) => logger.error("Logging failed", error as Error));
}

// Export class untuk testing
export { Logger };
