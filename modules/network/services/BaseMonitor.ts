/**
 * BaseMonitor - Abstract base class for all monitoring services
 * Provides proper interval management with exponential backoff and error handling
 */

import { type Server as SocketIOServer } from 'socket.io';

export abstract class BaseMonitor {
  protected io: SocketIOServer;
  protected interval: ReturnType<typeof setTimeout> | null = null;
  protected isRunning: boolean = false;
  protected errorCount: number = 0;
  protected readonly maxErrors: number = 5;
  protected backoffMultiplier: number = 1;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Override in subclass to define poll interval in ms
   */
  protected getPollInterval(): number {
    return 30000; // Default 30 seconds
  }

  /**
   * Override in subclass with the actual polling logic
   */
  protected abstract poll(): Promise<void>;

  /**
   * Get monitor name for logging
   */
  protected abstract getMonitorName(): string;

  /**
   * Start the monitoring service
   */
  start(): void {
    if (this.isRunning) {
      console.log(`[${this.getMonitorName()}] Already running`);
      return;
    }

    console.log(`[${this.getMonitorName()}] Starting...`);
    this.isRunning = true;
    this.errorCount = 0;
    this.backoffMultiplier = 1;

    // Initial poll
    this.runPoll();

    // Schedule next poll
    this.scheduleNextPoll();
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log(`[${this.getMonitorName()}] Stopping...`);
    this.isRunning = false;

    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
  }

  /**
   * Schedule the next poll with backoff
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    const interval = this.getPollInterval() * this.backoffMultiplier;
    
    this.interval = setTimeout(async () => {
      await this.runPoll();
      this.scheduleNextPoll();
    }, interval);
  }

  /**
   * Execute the poll with error handling
   */
  private async runPoll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.poll();
      
      // Reset error count and backoff on success
      this.errorCount = 0;
      this.backoffMultiplier = 1;
      
    } catch (error) {
      this.errorCount++;
      console.error(
        `[${this.getMonitorName()}] Poll error (${this.errorCount}/${this.maxErrors}):`,
        error
      );

      // Exponential backoff after 2 consecutive errors
      if (this.errorCount > 2) {
        this.backoffMultiplier = Math.min(2 ** (this.errorCount - 2), 8);
        console.log(
          `[${this.getMonitorName()}] Backoff multiplier: ${this.backoffMultiplier}x`
        );
      }

      // Stop after max errors
      if (this.errorCount >= this.maxErrors) {
        console.error(
          `[${this.getMonitorName()}] Stopping due to too many consecutive errors`
        );
        this.stop();
      }
    }
  }

  /**
   * Get current status for monitoring
   */
  getStatus(): {
    isRunning: boolean;
    errorCount: number;
    backoffMultiplier: number;
  } {
    return {
      isRunning: this.isRunning,
      errorCount: this.errorCount,
      backoffMultiplier: this.backoffMultiplier,
    };
  }
}
