/**
 * Webhook gateway dulu punya aturan pelunasannya sendiri, berbeda dari cek
 * status dan penyapu checkout: "sudah diproses" dibaca dari satu payment
 * (payment Rp 0 yang PAID sejak dibuat membuat checkout lain tak pernah
 * lunas), payment REFUNDED/FAILED ikut dipindah, dan kupon seluruh checkout
 * dilepas walau sebagian payment-nya sudah ditutup lebih dulu. Kini PAID
 * memakai `settleCheckoutPaidAtGateway` yang sama (aturannya diuji di
 * gatewayStatusSettlement.test.ts); di sini yang diuji hanya peran webhook.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "../../setup";

// Tidak terdaftar di tipe MockPrismaClient; dipasang per tes.
const payments = prismaMock.payment as unknown as {
  updateManyAndReturn: Mock;
};

const mockFns = vi.hoisted(() => ({
  processWebhook: vi.fn(),
  checkIdempotency: vi.fn(),
  recordWebhookEvent: vi.fn(),
  markAsProcessed: vi.fn(),
  markAsFailed: vi.fn(),
  generateIdempotencyKey: vi.fn(),
  findCheckoutPayments: vi.fn(),
  settleCheckoutPaidAtGateway: vi.fn(),
  releaseUnusedCheckoutCoupons: vi.fn(),
  acquireLock: vi.fn(),
}));

vi.mock("@/lib/distributed-lock", () => ({ acquireLock: mockFns.acquireLock }));

vi.mock(
  "@/modules/payment-gateway/services/abandoned-checkout",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    releaseUnusedCheckoutCoupons: mockFns.releaseUnusedCheckoutCoupons,
  }),
);

vi.mock("@/modules/payment-gateway/services/gateway-status-settlement", () => ({
  findCheckoutPayments: mockFns.findCheckoutPayments,
  settleCheckoutPaidAtGateway: mockFns.settleCheckoutPaidAtGateway,
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
    pelangganId: "cust-1",
  },
  {
    id: "pay-2",
    amount: BigInt(40000),
    invoiceId: "inv-2",
    pelangganId: "cust-1",
  },
];

function webhook(status: string) {
  const result = {
    orderId: "PAY-1",
    status,
    amount: 100000,
    transactionId: "tx-1",
  };
  mockFns.processWebhook.mockResolvedValue(result);
  const response = new WebhookProcessingService().process({
    providerType: "TRIPAY",
    rawBody: JSON.stringify({ merchant_ref: "PAY-1" }),
    headers: new Headers({ "x-callback-signature": "sig" }),
    tenantId: null,
  });
  return { result, response };
}

describe("WebhookProcessingService — pelunasan checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.findFirst.mockResolvedValue(PAYMENT);
    prismaMock.payment.findUnique.mockResolvedValue(PAYMENT);
    mockFns.checkIdempotency.mockResolvedValue(null);
    mockFns.recordWebhookEvent.mockResolvedValue({ id: "event-1" });
    mockFns.generateIdempotencyKey.mockReturnValue("TRIPAY:tx-1:PAID");
    mockFns.findCheckoutPayments.mockResolvedValue(CHECKOUT);
    mockFns.settleCheckoutPaidAtGateway.mockResolvedValue({
      outcome: "SETTLED",
    });
    payments.updateManyAndReturn = vi.fn().mockResolvedValue([]);
    mockFns.acquireLock.mockResolvedValue(async (): Promise<void> => undefined);
  });

  it("PAID dilunasi lewat jalur yang sama dengan cek status dan penyapu checkout", async () => {
    const { result, response } = webhook("PAID");

    expect(await response).toEqual({ status: 200, body: { status: "ok" } });
    expect(mockFns.settleCheckoutPaidAtGateway).toHaveBeenCalledWith({
      paymentId: "pay-1",
      provider: "TRIPAY",
      status: result,
    });
    expect(mockFns.markAsProcessed).toHaveBeenCalledWith("event-1");
  });

  it("callback untuk checkout yang sudah lunas dijawab sudah diproses", async () => {
    mockFns.settleCheckoutPaidAtGateway.mockResolvedValue({
      outcome: "ALREADY_PAID",
    });

    expect(await webhook("PAID").response).toEqual({
      status: 200,
      body: { status: "ok", message: "Already processed" },
    });
    expect(mockFns.markAsProcessed).toHaveBeenCalledWith("event-1");
  });

  // Tetap 200 (retry tidak mengubah datanya); staf diberi tahu oleh jalur
  // pelunasan, event ditandai gagal beserta alasannya.
  it.each([
    [
      "AMOUNT_MISMATCH",
      "100000",
      "60000",
      "Amount mismatch: expected 100000, received 60000",
      "Payment amount mismatch - flagged for review",
    ],
    [
      "TRANSACTION_MISMATCH",
      "tx-lain",
      "tx-1",
      "Transaction mismatch: expected tx-lain, received tx-1",
      "Payment transaction mismatch - flagged for review",
    ],
  ])(
    "%s tidak dilunasi dan event-nya ditandai gagal",
    async (outcome, expected, received, failure, message) => {
      mockFns.settleCheckoutPaidAtGateway.mockResolvedValue({
        outcome,
        expected,
        received,
      });

      expect(await webhook("PAID").response).toEqual({
        status: 200,
        body: { status: "ok", message },
      });
      expect(mockFns.markAsFailed).toHaveBeenCalledWith("event-1", failure);
      expect(mockFns.markAsProcessed).not.toHaveBeenCalled();
    },
  );

  // Event dulu ditandai PROCESSED di transaksi payment, sebelum invoice
  // dilunasi: retry gateway setelah proses mati dianggap duplikat.
  it("pelunasan yang gagal di tengah jalan tidak menandai event selesai", async () => {
    mockFns.settleCheckoutPaidAtGateway.mockRejectedValue(
      new Error("billing db terputus"),
    );

    expect((await webhook("PAID").response).status).toBe(500);
    expect(mockFns.markAsProcessed).not.toHaveBeenCalled();
    expect(mockFns.markAsFailed).toHaveBeenCalledWith(
      "event-1",
      "billing db terputus",
    );
  });

  it("EXPIRED menutup payment yang masih menunggu dan mengembalikan kupon yang benar-benar ditutup", async () => {
    const closed = [
      {
        id: "pay-2",
        couponUsageId: "use-1",
        couponId: "kupon-1",
        pelangganId: "cust-1",
        tenantId: "tenant-a",
      },
    ];
    payments.updateManyAndReturn.mockResolvedValue(closed);

    expect(await webhook("EXPIRED").response).toEqual({
      status: 200,
      body: { status: "ok" },
    });
    expect(payments.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["pay-1", "pay-2"] }, gatewayStatus: "PENDING" },
        data: { gatewayStatus: "EXPIRED" },
      }),
    );
    expect(mockFns.releaseUnusedCheckoutCoupons).toHaveBeenCalledWith(closed);
    expect(mockFns.settleCheckoutPaidAtGateway).not.toHaveBeenCalled();
    expect(mockFns.markAsProcessed).toHaveBeenCalledWith("event-1");
  });

  // Ganti metode memindah pemesanan kupon checkout lama sebelum baris
  // checkout barunya ada; notifikasi yang menutup checkout lama di antaranya
  // melepas kupon yang akan dipakai checkout baru.
  it("checkout yang tidak dibayar ditutup di bawah kunci checkout pelanggannya", async () => {
    await webhook("EXPIRED").response;

    expect(mockFns.acquireLock.mock.calls).toEqual([
      ["checkout:cust-1", expect.objectContaining({ ttlSeconds: 120 })],
    ]);
  });

  it("kunci yang sedang dipegang: 500 agar gateway mengulang, tanpa menutup apa pun", async () => {
    mockFns.acquireLock.mockResolvedValue(null);

    expect((await webhook("EXPIRED").response).status).toBe(500);
    expect(payments.updateManyAndReturn).not.toHaveBeenCalled();
    expect(mockFns.releaseUnusedCheckoutCoupons).not.toHaveBeenCalled();
    expect(mockFns.markAsProcessed).not.toHaveBeenCalled();
    expect(mockFns.markAsFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
    );
  });

  // Dulu notifikasi pending memindahkan payment EXPIRED atau CANCELLED
  // checkout itu kembali ke PENDING.
  it("notifikasi PENDING tidak mengubah payment apa pun", async () => {
    await webhook("PENDING").response;

    expect(payments.updateManyAndReturn).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(mockFns.releaseUnusedCheckoutCoupons).not.toHaveBeenCalled();
  });

  // Percobaan bayar yang ditolak bernomor transaksi lain dari percobaan yang
  // berhasil; menyimpannya membuat callback lunas sesudahnya dianggap tidak
  // cocok.
  it("notifikasi tanpa uang tidak menyimpan nomor transaksinya", async () => {
    await webhook("FAILED").response;

    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it("notifikasi gagal bernomor transaksi lain tidak menutup checkout", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      ...PAYMENT,
      transactionId: "tx-lain",
    });

    expect(await webhook("FAILED").response).toEqual({
      status: 200,
      body: { status: "ok", message: "Payment transaction mismatch - ignored" },
    });
    expect(payments.updateManyAndReturn).not.toHaveBeenCalled();
    expect(mockFns.markAsFailed).toHaveBeenCalledWith(
      "event-1",
      "Transaction mismatch: expected tx-lain, received tx-1",
    );
  });
});
