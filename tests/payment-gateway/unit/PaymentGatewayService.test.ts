import { describe, it, expect, beforeEach, vi } from "vitest";

const palsuProvider = vi.hoisted(() => ({
  initialize: vi.fn(),
  createPayment: vi.fn(),
  checkStatus: vi.fn(),
  cancelPayment: vi.fn(),
  verifyWebhook: vi.fn(),
  processWebhook: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock("@/modules/payment-gateway/services/provider-factory", () => ({
  ProviderFactory: {
    createProvider: () => ({ name: "Palsu", ...palsuProvider }),
  },
}));

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

  // Mematikan konfigurasi dulu juga menolak callback dan cek status VA/QR
  // yang sudah diberikan ke pelanggan: uang yang tetap masuk tidak pernah
  // dibukukan.
  describe("transaksi yang sudah terbit setelah konfigurasi dimatikan", () => {
    const disabledDuitku = () =>
      vi.mocked(mockConfigRepository.findByProvider).mockResolvedValue({
        id: "config-1",
        provider: "DUITKU",
        apiKey: "encrypted_key",
        apiSecret: null,
        clientKey: null,
        merchantId: "D123",
        isEnabled: false,
        isProduction: false,
        settings: null,
        priority: 1,
        tenantId: "tenant-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    beforeEach(() => {
      disabledDuitku();
      palsuProvider.checkStatus.mockResolvedValue({
        orderId: "PAY-1",
        status: "PAID",
      });
      palsuProvider.verifyWebhook.mockReturnValue(true);
      palsuProvider.processWebhook.mockResolvedValue({
        orderId: "PAY-1",
        status: "PAID",
      });
    });

    it("cek status tetap ditanyakan ke gateway", async () => {
      await expect(
        manager.checkPaymentStatus("DUITKU", "PAY-1", "tenant-1"),
      ).resolves.toMatchObject({ status: "PAID" });
      expect(palsuProvider.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "decrypted_encrypted_key" }),
      );
    });

    it("callback tetap diverifikasi dan diproses", async () => {
      await expect(
        manager.processWebhook(
          "DUITKU",
          { merchantOrderId: "PAY-1" },
          undefined,
          "raw",
          "tenant-1",
        ),
      ).resolves.toMatchObject({ status: "PAID" });
      expect(palsuProvider.verifyWebhook).toHaveBeenCalled();
    });

    it("callback bertanda tangan salah tetap ditolak", async () => {
      palsuProvider.verifyWebhook.mockReturnValue(false);

      await expect(
        manager.processWebhook("DUITKU", {}, undefined, "raw", "tenant-1"),
      ).rejects.toThrow("Invalid webhook signature");
    });

    it("checkout baru tetap ditolak", async () => {
      await expect(
        manager.createPaymentWithProvider("DUITKU", {
          orderId: "PAY-2",
          amount: 10000,
          customerName: "Budi",
          customerEmail: "b@example.com",
          customerPhone: "08",
          description: "Tagihan",
        }),
      ).rejects.toThrow("Provider DUITKU is disabled");
      expect(palsuProvider.createPayment).not.toHaveBeenCalled();
    });
  });
});
