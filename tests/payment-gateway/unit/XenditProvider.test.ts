import { describe, it, expect, vi } from "vitest";
import { XenditProvider } from "@/modules/payment-gateway/services/providers/xendit-provider";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("xendit-node", () => ({
  default: class MockXendit {
    Invoice = {
      createInvoice: vi.fn().mockResolvedValue({
        invoice_url: "https://xendit.co/pay/123",
        id: "inv-123",
        expiry_date: "2026-05-22T00:00:00Z",
      }),
      getInvoices: vi.fn().mockResolvedValue([]),
      expireInvoice: vi.fn().mockResolvedValue(undefined),
    };
    constructor(_config: unknown) {}
  },
}));

describe("XenditProvider", () => {
  describe("initialize", () => {
    it("should be synchronous (no async/await needed by caller)", () => {
      const provider = new XenditProvider();
      const result = provider.initialize({
        apiKey: "test-key",
        isProduction: false,
      });

      // initialize returns void (not a Promise)
      expect(result).toBeUndefined();
    });
  });

  describe("lazy SDK loading", () => {
    it("should load SDK lazily on first createPayment call", async () => {
      const provider = new XenditProvider();
      provider.initialize({ apiKey: "test-key", isProduction: false });

      const result = await provider.createPayment({
        orderId: "order-1",
        amount: 50000,
        customerName: "Test User",
        customerEmail: "test@test.com",
        customerPhone: "08123456789",
        description: "Test payment",
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe("https://xendit.co/pay/123");
      expect(result.transactionId).toBe("inv-123");
    });

    it("should not throw if initialize is not awaited", async () => {
      const provider = new XenditProvider();
      provider.initialize({ apiKey: "test-key", isProduction: false });

      // Immediately call createPayment without awaiting initialize
      const result = await provider.createPayment({
        orderId: "order-2",
        amount: 100000,
        customerName: "Test",
        customerEmail: "test@test.com",
        customerPhone: "08123456789",
        description: "Test",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("verifyWebhook", () => {
    it("should return false if payload is not an object", () => {
      const provider = new XenditProvider();
      provider.initialize({ apiKey: "test-key", isProduction: false });

      expect(provider.verifyWebhook(null)).toBe(false);
      expect(provider.verifyWebhook("string")).toBe(false);
    });
  });

  describe("testConnection", () => {
    it("should return error if not initialized", async () => {
      const provider = new XenditProvider();

      const result = await provider.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe("Provider not initialized");
    });
  });
});
