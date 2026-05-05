import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebhookIdempotencyService } from "@/modules/payment-gateway/services/WebhookIdempotencyService";
import type { WebhookEventRepository } from "@/modules/payment-gateway/repositories/WebhookEventRepository";
import type { WebhookEvent } from "@/modules/payment-gateway/domain/entities/WebhookEvent";

describe("WebhookIdempotencyService", () => {
  let service: WebhookIdempotencyService;
  let mockRepository: WebhookEventRepository;

  beforeEach(() => {
    mockRepository = {
      findByIdempotencyKey: vi.fn(),
      save: vi.fn(),
      markAsProcessed: vi.fn(),
      markAsFailed: vi.fn(),
    } as unknown as WebhookEventRepository;

    service = new WebhookIdempotencyService(mockRepository);
  });

  describe("generateIdempotencyKey", () => {
    it("should generate key with transactionId", () => {
      const key = service.generateIdempotencyKey("XENDIT", "txn-123", null);
      expect(key).toBe("XENDIT:txn-123");
    });

    it("should generate key with orderId if no transactionId", () => {
      const key = service.generateIdempotencyKey("MIDTRANS", null, "order-456");
      expect(key).toBe("MIDTRANS:order-456");
    });

    it("should generate key with UUID if no identifiers", () => {
      const key = service.generateIdempotencyKey("DUITKU", null, null);
      expect(key).toMatch(/^DUITKU:[a-f0-9-]{36}$/);
    });
  });

  describe("checkIdempotency", () => {
    it("should return null if no existing event", async () => {
      vi.mocked(mockRepository.findByIdempotencyKey).mockResolvedValue(null);

      const result = await service.checkIdempotency("XENDIT:txn-123");

      expect(result).toBeNull();
      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith(
        "XENDIT:txn-123",
      );
    });

    it("should return event if already processed", async () => {
      const mockEvent: WebhookEvent = {
        id: "evt-1",
        idempotencyKey: "XENDIT:txn-123",
        provider: "XENDIT",
        payload: {},
        status: "PROCESSED",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockRepository.findByIdempotencyKey).mockResolvedValue(
        mockEvent,
      );

      const result = await service.checkIdempotency("XENDIT:txn-123");

      expect(result).toEqual(mockEvent);
    });

    it("should return null if event exists but not processed", async () => {
      const mockEvent: WebhookEvent = {
        id: "evt-1",
        idempotencyKey: "XENDIT:txn-123",
        provider: "XENDIT",
        payload: {},
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockRepository.findByIdempotencyKey).mockResolvedValue(
        mockEvent,
      );

      const result = await service.checkIdempotency("XENDIT:txn-123");

      expect(result).toBeNull();
    });
  });

  describe("recordWebhookEvent", () => {
    it("should save webhook event with all fields", async () => {
      const params = {
        idempotencyKey: "XENDIT:txn-123",
        provider: "XENDIT" as const,
        payload: { amount: 100000 },
        signature: "sig-abc",
        rawBody: '{"amount":100000}',
        orderId: "order-1",
        transactionId: "txn-123",
        tenantId: "tenant-1",
      };

      await service.recordWebhookEvent(params);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: params.idempotencyKey,
          provider: params.provider,
          payload: params.payload,
          signature: params.signature,
          rawBody: params.rawBody,
          orderId: params.orderId,
          transactionId: params.transactionId,
          tenantId: params.tenantId,
          status: "PENDING",
        }),
      );
    });
  });

  describe("markAsProcessed", () => {
    it("should mark event as processed", async () => {
      await service.markAsProcessed("evt-1");

      expect(mockRepository.markAsProcessed).toHaveBeenCalledWith("evt-1");
    });
  });

  describe("markAsFailed", () => {
    it("should mark event as failed with error", async () => {
      await service.markAsFailed("evt-1", "Payment not found");

      expect(mockRepository.markAsFailed).toHaveBeenCalledWith(
        "evt-1",
        "Payment not found",
      );
    });
  });
});
