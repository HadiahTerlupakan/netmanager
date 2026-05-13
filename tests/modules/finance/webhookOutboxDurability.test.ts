/**
 * Test: Webhook Outbox Durability (Phase 4)
 *
 * Verifikasi bahwa INVOICE_PAID di-emit ke outbox secara atomik
 * dalam payment transaction, bukan post-commit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const mockFns = vi.hoisted(() => ({
  processWebhook: vi.fn(),
  saveToOutboxTx: vi.fn(),
  checkIdempotency: vi.fn(),
  recordWebhookEvent: vi.fn(),
  markAsProcessed: vi.fn(),
  generateIdempotencyKey: vi.fn(),
}));

vi.mock("@/lib/event-bus/outbox", () => ({
  saveToOutboxTx: (...args: unknown[]) => mockFns.saveToOutboxTx(...args),
}));

vi.mock("@/modules/payment-gateway/services/PaymentGatewayService", () => ({
  PaymentGatewayManager: class {
    processWebhook = mockFns.processWebhook;
  },
}));

vi.mock("@/modules/payment-gateway/services/WebhookIdempotencyService", () => ({
  WebhookIdempotencyService: class {
    generateIdempotencyKey = mockFns.generateIdempotencyKey;
    checkIdempotency = mockFns.checkIdempotency;
    recordWebhookEvent = mockFns.recordWebhookEvent;
    markAsProcessed = mockFns.markAsProcessed;
    markAsFailed = vi.fn();
  },
}));

vi.mock(
  "@/modules/payment-gateway/services/WebhookVerificationService",
  () => ({
    WebhookVerificationService: class {
      extractSignature = vi.fn().mockReturnValue("sig");
      verifySignature = vi.fn();
    },
    WebhookVerificationError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "WebhookVerificationError";
      }
    },
  }),
);

vi.mock("@/modules/payment-gateway/services/PaymentGatewayMetrics", () => ({
  getPaymentGatewayMetrics: () => ({
    recordWebhookReceived: vi.fn(),
    recordWebhookProcessed: vi.fn(),
    recordWebhookFailed: vi.fn(),
  }),
}));

import { WebhookProcessingService } from "@/modules/payment-gateway/services/webhook-processing-service";

const BASE_PAYMENT = {
  id: "pay-1",
  reference: "INV-1",
  amount: BigInt(100000),
  tenantId: "tenant-a",
  transactionId: null as string | null,
  gatewayStatus: "PENDING",
  invoiceId: "inv-1",
  notes: null as string | null,
};

const BASE_INVOICE = {
  id: "inv-1",
  pelangganId: "pel-1",
  totalAmount: BigInt(100000),
  status: "PAID",
  tenantId: "tenant-a",
  payment: [{ amount: BigInt(100000), gatewayStatus: "PAID" }],
};

describe("WebhookProcessingService — outbox durability (Phase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return callback;
    });
    mockFns.saveToOutboxTx.mockResolvedValue("outbox-id-1");
    mockFns.checkIdempotency.mockResolvedValue(null);
    mockFns.recordWebhookEvent.mockResolvedValue({ id: "event-1" });
    mockFns.markAsProcessed.mockResolvedValue(undefined);
    mockFns.generateIdempotencyKey.mockReturnValue("TRIPAY:tx-1");
  });

  it("insert INVOICE_PAID ke outbox dalam payment transaction saat gateway return PAID", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue(BASE_PAYMENT);
    prismaMock.payment.findUnique.mockResolvedValue({
      id: "pay-1",
      transactionId: null,
      gatewayStatus: "PENDING",
      invoiceId: "inv-1",
    });
    prismaMock.payment.update.mockResolvedValue({ id: "pay-1" });
    prismaMock.invoice.findUnique.mockResolvedValue(BASE_INVOICE);
    prismaMock.invoice.update.mockResolvedValue({ id: "inv-1" });

    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
      transactionId: "tx-1",
      paidAt: new Date("2026-05-13T10:00:00Z"),
      paymentMethod: "BANK_TRANSFER",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    expect(result).toEqual({ status: 200, body: { status: "ok" } });

    // saveToOutboxTx harus dipanggil dengan tx (prismaMock) dan payload INVOICE_PAID
    expect(mockFns.saveToOutboxTx).toHaveBeenCalledOnce();
    const [txArg, inputArg] = mockFns.saveToOutboxTx.mock.calls[0] as [
      unknown,
      {
        eventName: string;
        payload: Record<string, unknown>;
        priority: number;
        category: string;
        aggregateId: string;
        aggregateType: string;
      },
    ];

    // tx harus prismaMock (bukan undefined)
    expect(txArg).toBeDefined();

    expect(inputArg.eventName).toBe("billing:invoice.paid");
    expect(inputArg.payload).toMatchObject({
      invoiceId: "inv-1",
      pelangganId: "pel-1",
      amount: 100000,
      paidAt: "2026-05-13T10:00:00.000Z",
      paymentMethod: "BANK_TRANSFER",
      tenantId: "tenant-a",
    });
    expect(inputArg.priority).toBe(1); // CRITICAL
    expect(inputArg.category).toBe("billing");
    expect(inputArg.aggregateId).toBe("inv-1");
    expect(inputArg.aggregateType).toBe("Invoice");
  });

  it("idempotent — webhook kedua setelah payment PAID tidak emit outbox lagi", async () => {
    const service = new WebhookProcessingService();

    // Payment sudah PAID sebelum masuk tx
    prismaMock.payment.findFirst.mockResolvedValue({
      ...BASE_PAYMENT,
      gatewayStatus: "PAID",
    });
    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
      transactionId: "tx-1",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    expect(result).toEqual({
      status: 200,
      body: { status: "ok", message: "Already processed" },
    });
    expect(mockFns.saveToOutboxTx).not.toHaveBeenCalled();
  });

  it("tidak emit INVOICE_PAID outbox kalau gatewayStatus bukan PAID (FAILED)", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue(BASE_PAYMENT);
    prismaMock.payment.findUnique.mockResolvedValue({
      id: "pay-1",
      transactionId: null,
      gatewayStatus: "PENDING",
    });
    prismaMock.payment.update.mockResolvedValue({ id: "pay-1" });

    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "FAILED",
      amount: 100000,
      transactionId: "tx-1",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    expect(result).toEqual({ status: 200, body: { status: "ok" } });
    expect(mockFns.saveToOutboxTx).not.toHaveBeenCalled();
  });

  it("tidak emit outbox kalau invoice belum PAID setelah update (partial payment)", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue(BASE_PAYMENT);
    prismaMock.payment.findUnique.mockResolvedValue({
      id: "pay-1",
      transactionId: null,
      gatewayStatus: "PENDING",
      invoiceId: "inv-1",
    });
    prismaMock.payment.update.mockResolvedValue({ id: "pay-1" });

    // Invoice masih PARTIAL_PAID setelah update
    prismaMock.invoice.findUnique.mockResolvedValue({
      ...BASE_INVOICE,
      status: "PARTIAL_PAID",
    });
    prismaMock.invoice.update.mockResolvedValue({ id: "inv-1" });

    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
      transactionId: "tx-1",
    });

    await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    // Invoice belum PAID → outbox tidak boleh di-insert
    expect(mockFns.saveToOutboxTx).not.toHaveBeenCalled();
  });
});
