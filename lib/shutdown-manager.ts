import { logger } from "./logger";

type ShutdownHandler = () => Promise<void> | void;

class ShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private listenersRegistered = false;

  /**
   * Register a shutdown handler.
   * Handlers are called in reverse order (LIFO) during shutdown.
   */
  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
    this.ensureListeners();
  }

  /**
   * Ensure process listeners are registered only once.
   */
  private ensureListeners(): void {
    if (this.listenersRegistered) return;

    process.once("SIGTERM", () => this.shutdown("SIGTERM"));
    process.once("SIGINT", () => this.shutdown("SIGINT"));

    this.listenersRegistered = true;
    logger.info("[ShutdownManager] Process listeners registered");
  }

  /**
   * Execute all registered handlers in reverse order.
   */
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn(
        `[ShutdownManager] Already shutting down, ignoring ${signal}`,
      );
      return;
    }

    this.isShuttingDown = true;
    logger.info(
      `[ShutdownManager] Received ${signal}, starting graceful shutdown...`,
    );

    // Execute handlers in reverse order (LIFO)
    const handlersToRun = [...this.handlers].reverse();

    for (const handler of handlersToRun) {
      try {
        await handler();
      } catch (error) {
        logger.error("[ShutdownManager] Handler error:", error);
      }
    }

    logger.info("[ShutdownManager] Graceful shutdown complete");
    process.exit(0);
  }

  /**
   * Get number of registered handlers (for debugging).
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }
}

export const shutdownManager = new ShutdownManager();
