/**
 * Simple Throttler for WhatsApp Messages
 * Ensures messages are sent sequentially with a delay to prevent anti-spam blocking.
 *
 * Limitation: state in-memory per-process. Pada deployment multi-instance
 * (multiple Node workers atau horizontal scaling), throttling tidak terkoordinasi
 * lintas instance. Migrasi ke Redis-based rate limiter (token bucket per nomor
 * pengirim) bila scale-out diperlukan.
 */
class WhatsAppThrottler {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  // Minimum delay between messages in ms (3-7 seconds is safe)
  private minDelay = 3000;
  private maxDelay = 6000;

  /**
   * Add a task to the queue and wait for it to complete
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      this.queue.push(wrappedTask);
      this.processQueue();
    });
  }

  /**
   * Process the queue sequentially with random delays
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        // Calculate wait time based on last request
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        const delay = Math.floor(
          Math.random() * (this.maxDelay - this.minDelay + 1) + this.minDelay,
        );

        const waitTime = Math.max(0, delay - timeSinceLast);

        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        await task();
        this.lastRequestTime = Date.now();
      }
    }

    this.isProcessing = false;
  }
}

// Export a singleton instance
export const whatsAppThrottler = new WhatsAppThrottler();
