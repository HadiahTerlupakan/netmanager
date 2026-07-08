import { describe, it, expect, beforeEach, vi } from "vitest";
import { PaymentGatewayManager } from "@/modules/payment-gateway/services/PaymentGatewayService";
import type { PaymentGatewayConfigRepository } from "@/modules/payment-gateway/repositories/PaymentGatewayConfigRepository";

vi.mock("@/lib/utils/encryption", () => ({
  decryptApiKey: (key: string) => `decrypted_${key}`,
}));

describe("PaymentGatewayManager", () => {
  let manager: PaymentGatewayManager;
  let mockConfigRepository: PaymentGatewayConfigRepository;

  beforeEach(() => {
    mockConfigRepository = {
      findEnabled: vi.fn(),
      findByProvider: vi.fn(),
    } as unknown as PaymentGatewayConfigRepository;

    manager = new PaymentGatewayManager(mockConfigRepository);
  });

  describe("createPayment - amount validation", () => {
    it("should throw error if amount is zero", async () => {
      await expect(
        manager.createPayment({
          orderId: "order-1",
          amount: 0,
          customerName: "Test",
          customerEmail: "test@test.com",
          customerPhone: "08123456789",
          description: "Test payment",
        }),
      ).rejects.toThrow("Payment amount must be greater than zero");
    });

    it("should throw error if amount is negative", async () => {
      await expect(
        manager.createPayment({
          orderId: "order-1",
          amount: -10000,
          customerName: "Test",
          customerEmail: "test@test.com",
          customerPhone: "08123456789",
          description: "Test payment",
        }),
      ).rejects.toThrow("Payment amount must be greater than zero");
    });

    it("should proceed if amount is positive", async () => {
      vi.mocked(mockConfigRepository.findEnabled).mockResolvedValue([]);

      await expect(
        manager.createPayment({
          orderId: "order-1",
          amount: 50000,
          customerName: "Test",
          customerEmail: "test@test.com",
          customerPhone: "08123456789",
          description: "Test payment",
        }),
      ).rejects.toThrow("No payment gateway enabled.");
    });

    it("should scope enabled provider selection to the payment tenant", async () => {
      vi.mocked(mockConfigRepository.findEnabled).mockResolvedValue([]);

      await expect(
        manager.createPayment({
          orderId: "order-tenant",
          amount: 50000,
          customerName: "Tenant Customer",
          customerEmail: "tenant@test.com",
          customerPhone: "08123456789",
          description: "Tenant payment",
          tenantId: "tenant-1",
        }),
      ).rejects.toThrow("No payment gateway enabled.");

      expect(mockConfigRepository.findEnabled).toHaveBeenCalledWith("tenant-1");
    });
  });

  describe("createPaymentWithProvider - amount validation", () => {
    it("should throw error if amount is zero", async () => {
      await expect(
        manager.createPaymentWithProvider("XENDIT", {
          orderId: "order-1",
          amount: 0,
          customerName: "Test",
          customerEmail: "test@test.com",
          customerPhone: "08123456789",
          description: "Test payment",
        }),
      ).rejects.toThrow("Payment amount must be greater than zero");
    });

    it("should throw error if amount is negative", async () => {
      await expect(
        manager.createPaymentWithProvider("MIDTRANS", {
          orderId: "order-1",
          amount: -1,
          customerName: "Test",
          customerEmail: "test@test.com",
          customerPhone: "08123456789",
          description: "Test payment",
        }),
      ).rejects.toThrow("Payment amount must be greater than zero");
    });
  });

  describe("getProviderInstance - API key validation", () => {
    it("should throw error if API key is empty after decryption", async () => {
      vi.mocked(mockConfigRepository.findByProvider).mockResolvedValue({
        id: "config-1",
        provider: "XENDIT",
        apiKey: "",
        apiSecret: null,
        clientKey: null,
        merchantId: null,
        isEnabled: true,
        isProduction: false,
        settings: null,
        priority: 1,
        tenantId: "tenant-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        manager.getProviderInstance("XENDIT", "tenant-1"),
      ).rejects.toThrow("has no API key configured");
    });

    it("should throw error if provider is disabled", async () => {
      vi.mocked(mockConfigRepository.findByProvider).mockResolvedValue({
        id: "config-1",
        provider: "XENDIT",
        apiKey: "encrypted_key",
        apiSecret: null,
        clientKey: null,
        merchantId: null,
        isEnabled: false,
        isProduction: false,
        settings: null,
        priority: 1,
        tenantId: "tenant-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        manager.getProviderInstance("XENDIT", "tenant-1"),
      ).rejects.toThrow("Provider XENDIT is disabled");
    });

    it("should throw error if provider not configured", async () => {
      vi.mocked(mockConfigRepository.findByProvider).mockResolvedValue(null);

      await expect(
        manager.getProviderInstance("XENDIT", "tenant-1"),
      ).rejects.toThrow("Provider XENDIT not configured");
    });
  });
});
