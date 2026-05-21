import { describe, it, expect, beforeEach } from "vitest";
import { PaymentGatewayMetrics } from "@/modules/payment-gateway/services/PaymentGatewayMetrics";

describe("PaymentGatewayMetrics", () => {
  let metrics: PaymentGatewayMetrics;

  beforeEach(() => {
    metrics = new PaymentGatewayMetrics();
  });

  describe("recordWebhookReceived", () => {
    it("should increment webhook received count", () => {
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("XENDIT");

      const result = metrics.getMetrics("XENDIT");
      expect(result?.webhookReceived).toBe(2);
    });
  });

  describe("recordWebhookProcessed", () => {
    it("should increment processed count and record duration", () => {
      metrics.recordWebhookProcessed("XENDIT", 150);
      metrics.recordWebhookProcessed("XENDIT", 200);

      const result = metrics.getMetrics("XENDIT");
      expect(result?.webhookProcessed).toBe(2);
      expect(result?.processingDuration).toEqual([150, 200]);
    });

    it("should cap processingDuration at 1000 entries (ring buffer)", () => {
      for (let i = 0; i < 1005; i++) {
        metrics.recordWebhookProcessed("XENDIT", i);
      }

      const result = metrics.getMetrics("XENDIT");
      expect(result?.processingDuration.length).toBe(1000);
      expect(result?.processingDuration[0]).toBe(5);
      expect(result?.processingDuration[999]).toBe(1004);
    });
  });

  describe("recordWebhookFailed", () => {
    it("should increment failed count", () => {
      metrics.recordWebhookFailed("XENDIT", "Invalid signature");
      metrics.recordWebhookFailed("XENDIT", "Payment not found");

      const result = metrics.getMetrics("XENDIT");
      expect(result?.webhookFailed).toBe(2);
    });
  });

  describe("getAverageProcessingDuration", () => {
    it("should calculate average duration", () => {
      metrics.recordWebhookProcessed("XENDIT", 100);
      metrics.recordWebhookProcessed("XENDIT", 200);
      metrics.recordWebhookProcessed("XENDIT", 300);

      const avg = metrics.getAverageProcessingDuration("XENDIT");
      expect(avg).toBe(200);
    });

    it("should return 0 if no durations recorded", () => {
      const avg = metrics.getAverageProcessingDuration("XENDIT");
      expect(avg).toBe(0);
    });
  });

  describe("getSuccessRate", () => {
    it("should calculate success rate", () => {
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookProcessed("XENDIT", 100);
      metrics.recordWebhookProcessed("XENDIT", 150);
      metrics.recordWebhookProcessed("XENDIT", 200);

      const rate = metrics.getSuccessRate("XENDIT");
      expect(rate).toBe(75);
    });

    it("should return 0 if no webhooks received", () => {
      const rate = metrics.getSuccessRate("XENDIT");
      expect(rate).toBe(0);
    });
  });

  describe("getAllMetrics", () => {
    it("should return metrics for all providers", () => {
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("MIDTRANS");

      const all = metrics.getAllMetrics();
      expect(all).toHaveProperty("XENDIT");
      expect(all).toHaveProperty("MIDTRANS");
    });
  });

  describe("resetMetrics", () => {
    it("should reset metrics for specific provider", () => {
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("MIDTRANS");

      metrics.resetMetrics("XENDIT");

      expect(metrics.getMetrics("XENDIT")).toBeUndefined();
      expect(metrics.getMetrics("MIDTRANS")).toBeDefined();
    });
  });

  describe("resetAllMetrics", () => {
    it("should reset all metrics", () => {
      metrics.recordWebhookReceived("XENDIT");
      metrics.recordWebhookReceived("MIDTRANS");

      metrics.resetAllMetrics();

      expect(metrics.getMetrics("XENDIT")).toBeUndefined();
      expect(metrics.getMetrics("MIDTRANS")).toBeUndefined();
    });
  });
});
