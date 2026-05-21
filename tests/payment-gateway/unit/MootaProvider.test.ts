import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import { MootaProvider } from "@/modules/payment-gateway/services/providers/moota-provider";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("MootaProvider", () => {
  let provider: MootaProvider;

  beforeEach(() => {
    provider = new MootaProvider();
  });

  describe("verifyWebhook", () => {
    it("should reject webhook if apiSecret is not configured", () => {
      provider.initialize({ apiKey: "test-key", isProduction: false });

      const result = provider.verifyWebhook({}, "some-signature", "raw-body");

      expect(result).toBe(false);
    });

    it("should reject webhook if signature is missing", () => {
      provider.initialize({
        apiKey: "test-key",
        apiSecret: "test-secret",
        isProduction: false,
      });

      const result = provider.verifyWebhook({}, undefined, "raw-body");

      expect(result).toBe(false);
    });

    it("should reject webhook if rawBody is missing", () => {
      provider.initialize({
        apiKey: "test-key",
        apiSecret: "test-secret",
        isProduction: false,
      });

      const result = provider.verifyWebhook({}, "some-signature", undefined);

      expect(result).toBe(false);
    });

    it("should verify valid HMAC SHA-256 signature", () => {
      const secret = "my-webhook-secret";
      const rawBody = '{"mutation_id":"123","amount":50000}';
      const expectedHash = createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      provider.initialize({
        apiKey: "test-key",
        apiSecret: secret,
        isProduction: false,
      });

      const result = provider.verifyWebhook({}, expectedHash, rawBody);

      expect(result).toBe(true);
    });

    it("should reject invalid signature", () => {
      provider.initialize({
        apiKey: "test-key",
        apiSecret: "my-webhook-secret",
        isProduction: false,
      });

      const result = provider.verifyWebhook(
        {},
        "invalid-signature",
        '{"mutation_id":"123"}',
      );

      expect(result).toBe(false);
    });
  });

  describe("processWebhook", () => {
    it("should extract mutation data from array payload", async () => {
      provider.initialize({ apiKey: "test-key", isProduction: false });

      const payload = [
        {
          mutation_id: "mut-123",
          amount: 150000,
          type: "CR",
          date: "2026-05-21T10:00:00Z",
        },
      ];

      const result = await provider.processWebhook(payload);

      expect(result.status).toBe("PAID");
      expect(result.amount).toBe(150000);
      expect(result.transactionId).toBe("mut-123");
      expect(result.paymentMethod).toBe("BANK_TRANSFER");
      expect(result.orderId).toBe("");
    });

    it("should return PENDING for debit mutations", async () => {
      provider.initialize({ apiKey: "test-key", isProduction: false });

      const payload = [
        {
          mutation_id: "mut-456",
          amount: 50000,
          type: "DB",
          date: "2026-05-21T10:00:00Z",
        },
      ];

      const result = await provider.processWebhook(payload);

      expect(result.status).toBe("PENDING");
    });
  });
});
