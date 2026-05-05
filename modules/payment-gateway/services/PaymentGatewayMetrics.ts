import { logger } from "@/lib/logger";

export type WebhookMetrics = {
  webhookReceived: number;
  webhookProcessed: number;
  webhookFailed: number;
  processingDuration: number[];
};

export class PaymentGatewayMetrics {
  private metrics: Map<string, WebhookMetrics> = new Map();

  /**
   * Record webhook received
   */
  recordWebhookReceived(provider: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.webhookReceived++;
    logger.debug(`[Metrics] Webhook received for ${provider}`);
  }

  /**
   * Record webhook processed successfully
   */
  recordWebhookProcessed(provider: string, durationMs: number): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.webhookProcessed++;
    metrics.processingDuration.push(durationMs);
    logger.debug(
      `[Metrics] Webhook processed for ${provider} in ${durationMs}ms`,
    );
  }

  /**
   * Record webhook processing failed
   */
  recordWebhookFailed(provider: string, error: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.webhookFailed++;
    logger.warn(`[Metrics] Webhook failed for ${provider}: ${error}`);
  }

  /**
   * Get metrics for a provider
   */
  getMetrics(provider: string): WebhookMetrics | undefined {
    return this.metrics.get(provider);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, WebhookMetrics> {
    const result: Record<string, WebhookMetrics> = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Calculate average processing duration
   */
  getAverageProcessingDuration(provider: string): number {
    const metrics = this.metrics.get(provider);
    if (!metrics || metrics.processingDuration.length === 0) {
      return 0;
    }

    const sum = metrics.processingDuration.reduce((a, b) => a + b, 0);
    return sum / metrics.processingDuration.length;
  }

  /**
   * Calculate success rate
   */
  getSuccessRate(provider: string): number {
    const metrics = this.metrics.get(provider);
    if (!metrics || metrics.webhookReceived === 0) {
      return 0;
    }

    return (metrics.webhookProcessed / metrics.webhookReceived) * 100;
  }

  /**
   * Reset metrics for a provider
   */
  resetMetrics(provider: string): void {
    this.metrics.delete(provider);
    logger.info(`[Metrics] Reset metrics for ${provider}`);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metrics.clear();
    logger.info(`[Metrics] Reset all metrics`);
  }

  private getOrCreateMetrics(provider: string): WebhookMetrics {
    let metrics = this.metrics.get(provider);
    if (!metrics) {
      metrics = {
        webhookReceived: 0,
        webhookProcessed: 0,
        webhookFailed: 0,
        processingDuration: [],
      };
      this.metrics.set(provider, metrics);
    }
    return metrics;
  }
}

// Singleton instance
let metricsInstance: PaymentGatewayMetrics | null = null;

export function getPaymentGatewayMetrics(): PaymentGatewayMetrics {
  if (!metricsInstance) {
    metricsInstance = new PaymentGatewayMetrics();
  }
  return metricsInstance;
}
