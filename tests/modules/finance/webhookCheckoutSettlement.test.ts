/**
 * Webhook gateway dulu menulis INVOICE_PAID ke tabel OutboxEvent lewat
 * transaksi database billing, padahal tabel itu hanya ada di database utama:
 * setiap webhook PAID gagal dan rollback, sehingga pelanggan yang membayar
 * lewat gateway tidak pernah lunas. Checkout beberapa invoice juga hanya
 * mencocokkan payment pertama dengan total seluruh checkout.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const mockFns = vi.hoisted(() => ({
  processWebhook: vi.fn(),
  checkIdempotency: vi.fn(),
  recordWebhookEvent: vi.fn(),
  markAsProcessed: vi.fn(),
  markAsFailed: vi.fn(),
  generateIdempotencyKey: vi.fn(),
  findCheckoutPayments: vi.fn(),
  settleCheckoutInvoices: vi.fn(),
  releaseCheckoutCoupons: vi.fn(),
  restoreReleasedCoupons: vi.fn(),
  creditCheckoutOverpayment: vi.fn(),
}));

vi.mock("@/modules/payment-gateway/services/overpayment-credit", () => ({
  creditCheckoutOverpayment: mockFns.creditCheckoutOverpayment,
}));

vi.mock(
  "@/modules/payment-gateway/services/abandoned-checkout",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    releaseCheckoutCoupons: mockFns.releaseCheckoutCoupons,
    restoreReleasedCoupons: mockFns.restoreReleasedCoupons,
  }),
);

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
    markAsFailed = mockFns.markAsFailed;
  },
}));

vi.mock(
  "@/modules/payment-gateway/services/WebhookVerificationService",
  () => ({
    WebhookVerificationService: class {
      extractSignature = vi.fn().mockReturnValue("sig");
      verifySignature = vi.fn();
    },
    WebhookVerificationError: class extends Error {},
  }),
);

vi.mock(
  "@/modules/payment-gateway/services/webhook-checkout-settlement",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    findCheckoutPayments: mockFns.findCheckoutPayments,
    settleCheckoutInvoices: mockFns.settleCheckoutInvoices,
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

const PAYMENT = {
  id: "pay-1",
  reference: "PAY-1",
  amount: BigInt(60000),
  tenantId: "tenant-a",
  transactionId: null as string | null,
  gatewayStatus: "PENDING",
  invoiceId: "inv-1",
  notes: null as string | null,
};

const CHECKOUT = [
  {
    id: "pay-1",
    amount: BigInt(60000),
    invoiceId: "inv-1",
    tenantId: "tenant-a",
  },
  {
    id: "pay-2",
    amount: BigInt(40000),
    invoiceId: "inv-2",
    tenantId: "tenant-a",
  },
];

function webhook(status: string, amount = 100000) {
  mockFns.processWebhook.mockResolvedValue({
    orderId: "PAY-1",
    status,
    amount,
    transactionId: "tx-1",
  });
  return new WebhookProcessingService().process({
    providerType: "TRIPAY",
    rawBody: JSON.stringify({ merchant_ref: "PAY-1" }),
    headers: new Headers({ "x-callback-signature": "sig" }),
    tenantId: null,
  });
}

describe("WebhookProcessingService — pelunasan checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.$transaction.mockImplementation(async (callback: unknown) =>
      typeof callback === "function" ? callback(prismaMock) : callback,
    );
    prismaMock.payment.findFirst.mockResolvedValue(PAYMENT);
    prismaMock.payment.findUnique.mockResolvedValue(PAYMENT);
    mockFns.checkIdempotency.mockResolvedValue(null);
    mockFns.recordWebhookEvent.mockResolvedValue({ id: "event-1" });
    mockFns.generateIdempotencyKey.mockReturnValue("TRIPAY:tx-1:PAID");
    mockFns.findCheckoutPayments.mockResolvedValue(CHECKOUT);
  });

  it("PAID melunasi semua payment checkout lalu menghitung ulang invoicenya", async () => {
    const result = await webhook("PAID");

    expect(result).toEqual({ status: 200, body: { status: "ok" } });
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pay-1", "pay-2"] }, gatewayStatus: { not: "PAID" } },
      data: expect.objectContaining({ gatewayStatus: "PAID" }),
    });
    expect(mockFns.restoreReleasedCoupons).toHaveBeenCalledWith(CHECKOUT);
    expect(mockFns.settleCheckoutInvoices).toHaveBeenCalledWith(CHECKOUT);
    const { webhookEvent } = prismaMock as unknown as {
      webhookEvent: { update: ReturnType<typeof vi.fn> };
    };
    expect(webhookEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({ status: "PROCESSED" }),
    });
  });

  // Checkout yang ditutup karena pelanggan ganti metode tetap bisa dibayar
  // lewat VA lamanya (Duitku tidak bisa menutup VA lebih awal).
  it("PAID untuk checkout yang dibatalkan saat ganti metode tetap melunasi", async () => {
    const cancelled = { ...PAYMENT, gatewayStatus: "CANCELLED" };
    prismaMock.payment.findFirst.mockResolvedValue(cancelled);
    prismaMock.payment.findUnique.mockResolvedValue(cancelled);

    await webhook("PAID");

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gatewayStatus: "PAID" }),
      }),
    );
    expect(mockFns.settleCheckoutInvoices).toHaveBeenCalledWith(CHECKOUT);
    // Invoice-nya bisa sudah lunas oleh metode pengganti: kelebihannya
    // menjadi saldo, bukan diterima diam-diam.
    expect(mockFns.creditCheckoutOverpayment).toHaveBeenCalledWith(CHECKOUT);
  });

  it("nominal dicocokkan dengan total checkout, bukan payment pertama", async () => {
    const result = await webhook("PAID", 60000);

    expect(result.body.message).toContain("mismatch");
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(mockFns.settleCheckoutInvoices).not.toHaveBeenCalled();
  });

  it("retry setelah payment PAID tetap menghitung ulang invoice", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      ...PAYMENT,
      gatewayStatus: "PAID",
    });

    await webhook("PAID");

    expect(mockFns.settleCheckoutInvoices).toHaveBeenCalledWith(CHECKOUT);
    expect(mockFns.creditCheckoutOverpayment).toHaveBeenCalledWith(CHECKOUT);
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it("webhook ganda yang tidak lagi memindahkan payment tidak melunasi ulang", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 0 });

    await webhook("PAID");

    expect(mockFns.settleCheckoutInvoices).not.toHaveBeenCalled();
  });

  it("EXPIRED hanya mengubah status payment tanpa melunasi invoice", async () => {
    await webhook("EXPIRED");

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gatewayStatus: "EXPIRED" }),
      }),
    );
    expect(mockFns.settleCheckoutInvoices).not.toHaveBeenCalled();
    // Checkout yang tidak dibayar dulu menghabiskan kuota kupon pelanggan.
    expect(mockFns.releaseCheckoutCoupons).toHaveBeenCalledWith(CHECKOUT);
  });

  it("PAID tidak mengembalikan kupon", async () => {
    await webhook("PAID");

    expect(mockFns.releaseCheckoutCoupons).not.toHaveBeenCalled();
  });
});
