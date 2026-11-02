import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import { prismaMock } from "../../setup";

vi.mock("@/lib/firebase/messaging", () => ({
  sendFCMNotification: vi.fn().mockResolvedValue(undefined),
  getAdminTokens: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn().mockResolvedValue({
    tenantId: "t1",
    isSuperAdmin: false,
  }),
}));

import { handlePaymentReviewRequired } from "@/modules/notification/services/event-handlers/payment-review.handler";

function job(payload: Record<string, unknown>) {
  return {
    data: { eventName: "billing:payment.review_required", payload },
  } as unknown as Job;
}

const AMOUNT_MISMATCH = {
  provider: "DUITKU",
  orderId: "PAY-1",
  paymentId: "pay-1",
  reason: "AMOUNT_MISMATCH",
  expected: "100000",
  received: "60000",
  tenantId: "t1",
};

/**
 * Callback gateway yang nominal atau nomor transaksinya tidak cocok dulu
 * hanya tersimpan di WebhookEvent: tidak ada yang tahu ada uang yang tidak
 * dilunasi. Kini staf yang bisa membuka Transaksi Payment Gateway diberi tahu.
 */
describe("pemberitahuan pembayaran yang perlu diperiksa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([
      { id: "staf-1" },
      { id: "staf-2" },
    ]);
    prismaMock.notifications.findFirst.mockResolvedValue(null);
    prismaMock.notifications.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: `notif-${String(data.userId)}`,
        createdAt: new Date(),
        ...data,
      }),
    );
  });

  it("memberi tahu staf payment_gateway:read di tenant itu dengan nominal keduanya", async () => {
    await handlePaymentReviewRequired(job(AMOUNT_MISMATCH));

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          tenantId: "t1",
          role: {
            permission: {
              some: { resource: "payment_gateway", action: "read" },
            },
          },
        },
      }),
    );
    expect(prismaMock.notifications.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "staf-1",
        type: "ALERT",
        priority: "HIGH",
        title: "Pembayaran perlu diperiksa",
        message:
          "Pembayaran DUITKU untuk PAY-1 menyebut Rp 60.000, padahal checkout-nya Rp 100.000. Tagihannya tidak dilunasi otomatis; periksa di Transaksi Payment Gateway.",
        link: "/admin/finance/payment-gateway",
        sourceType: "PaymentReview",
        sourceId: "PAY-1:AMOUNT_MISMATCH",
      }),
    });
  });

  it("nomor transaksi yang berbeda disebut apa adanya", async () => {
    await handlePaymentReviewRequired(
      job({
        ...AMOUNT_MISMATCH,
        reason: "TRANSACTION_MISMATCH",
        expected: "DREF-LAMA",
        received: "DREF-BARU",
      }),
    );

    expect(prismaMock.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message:
          "Pembayaran DUITKU untuk PAY-1 membawa nomor transaksi DREF-BARU, berbeda dengan catatan DREF-LAMA. Tagihannya tidak dilunasi otomatis; periksa di Transaksi Payment Gateway.",
      }),
    });
  });

  // Handler event berjalan at-least-once.
  it("staf yang sudah diberi tahu tidak diberi tahu lagi", async () => {
    prismaMock.notifications.findFirst.mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        where.userId === "staf-1" ? { id: "lama" } : null,
    );

    await handlePaymentReviewRequired(job(AMOUNT_MISMATCH));

    expect(prismaMock.notifications.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "staf-2" }),
    });
  });

  // Tanpa tenant, penerimanya bisa staf tenant lain.
  it("tanpa tenant tidak ada yang diberi tahu", async () => {
    await handlePaymentReviewRequired(
      job({ ...AMOUNT_MISMATCH, tenantId: undefined }),
    );

    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.notifications.create).not.toHaveBeenCalled();
  });
});
