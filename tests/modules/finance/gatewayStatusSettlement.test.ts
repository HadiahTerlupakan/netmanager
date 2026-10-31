/**
 * Aturan pelunasan checkout yang dinyatakan PAID oleh gateway, satu untuk
 * callback, cek status dari portal, dan penyapu checkout. Dulu webhook punya
 * aturan sendiri: "sudah diproses" dibaca dari satu payment, payment
 * REFUNDED/FAILED ikut dipindah, dan cek status hanya mencatat log saat
 * nominal atau nomor transaksinya tidak cocok.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({
  settle: vi.fn(),
  recordFee: vi.fn(),
  restoreCoupons: vi.fn(),
  flag: vi.fn(),
  claimFlag: vi.fn(),
}));

vi.mock("@/modules/finance/services/received-payment-settlement", () => ({
  settleReceivedPayments: palsu.settle,
}));
vi.mock("@/modules/payment-gateway/services/gateway-fee", () => ({
  recordGatewayFee: palsu.recordFee,
}));
vi.mock(
  "@/modules/payment-gateway/services/abandoned-checkout",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    restoreReleasedCoupons: palsu.restoreCoupons,
  }),
);
vi.mock("@/modules/payment-gateway/services/payment-review", () => ({
  flagPaymentForReview: palsu.flag,
}));
vi.mock("@/modules/finance/repositories/paymentReviewFlag.repository", () => ({
  claimPaymentReviewFlag: palsu.claimFlag,
}));

import { settleCheckoutPaidAtGateway } from "@/modules/payment-gateway/services/gateway-status-settlement";

type Row = {
  id: string;
  amount: bigint;
  gatewayStatus: string;
  transactionId?: string | null;
};

const checkoutPayment = (row: Row) => ({
  id: row.id,
  amount: row.amount,
  invoiceId: `inv-${row.id}`,
  tenantId: "t1",
  couponUsageId: null as string | null,
  couponId: null as string | null,
  pelangganId: "cust-1",
  reference: `PAY-${row.id}`,
});

/** Checkout `co-1` dengan baris-baris ini; baris pertama adalah orderId. */
function givenCheckout(rows: Row[]) {
  prismaMock.payment.findUnique.mockResolvedValue({
    ...checkoutPayment(rows[0]),
    checkoutId: "co-1",
  });
  prismaMock.payment.findMany.mockImplementation((async (args: {
    select: { gatewayStatus?: boolean };
  }) =>
    args.select.gatewayStatus
      ? rows.map((row): Row => ({ transactionId: null, ...row }))
      : rows.map(checkoutPayment)) as never);
  return rows.map(checkoutPayment);
}

const settle = (status: Record<string, unknown> = {}) =>
  settleCheckoutPaidAtGateway({
    paymentId: "p1",
    provider: "DUITKU",
    status: { orderId: "PAY-p1", amount: 100000, ...status },
  });

describe("settleCheckoutPaidAtGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: unknown) =>
      typeof callback === "function" ? callback(prismaMock) : callback,
    );
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    palsu.claimFlag.mockResolvedValue(true);
  });

  it("hanya payment yang masih bisa menerima uang yang dijumlah dan dipindah", async () => {
    givenCheckout([
      { id: "p1", amount: 60000n, gatewayStatus: "PENDING" },
      { id: "p2", amount: 40000n, gatewayStatus: "CANCELLED" },
      { id: "p3", amount: 50000n, gatewayStatus: "FAILED" },
      { id: "p4", amount: 25000n, gatewayStatus: "REFUNDED" },
    ]);

    await expect(settle()).resolves.toEqual({ outcome: "SETTLED" });
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["p1", "p2"] },
        gatewayStatus: { in: ["PENDING", "EXPIRED", "CANCELLED"] },
      },
      data: expect.objectContaining({ gatewayStatus: "PAID" }),
    });
  });

  it("nominal yang tidak cocok tidak dilunasi dan diteruskan ke staf keuangan", async () => {
    givenCheckout([
      { id: "p1", amount: 60000n, gatewayStatus: "PENDING" },
      { id: "p2", amount: 40000n, gatewayStatus: "REFUNDED" },
    ]);

    await expect(settle()).resolves.toEqual({
      outcome: "AMOUNT_MISMATCH",
      expected: "60000",
      received: "100000",
    });
    expect(palsu.claimFlag).toHaveBeenCalledWith({
      paymentId: "p1",
      reason: "AMOUNT_MISMATCH",
      expected: "60000",
      received: "100000",
    });
    expect(palsu.flag).toHaveBeenCalledWith({
      provider: "DUITKU",
      orderId: "PAY-p1",
      paymentId: "p1",
      tenantId: "t1",
      reason: "AMOUNT_MISMATCH",
      expected: "60000",
      received: "100000",
    });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.settle).not.toHaveBeenCalled();
  });

  // Penyapu menanyakan checkout yang sama tiap putaran dan portal selama
  // pelanggan menunggu; jawaban yang sama dulu menulis log dan event lagi.
  it("ketidakcocokan yang sudah diteruskan ke staf tidak diteruskan lagi dan tetap tidak dilunasi", async () => {
    givenCheckout([{ id: "p1", amount: 60000n, gatewayStatus: "PENDING" }]);
    palsu.claimFlag.mockResolvedValue(false);

    await expect(settle()).resolves.toEqual({
      outcome: "AMOUNT_MISMATCH",
      expected: "60000",
      received: "100000",
    });
    expect(palsu.flag).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.settle).not.toHaveBeenCalled();
  });

  it("nomor transaksi yang tidak cocok tidak dilunasi dan diteruskan ke staf keuangan", async () => {
    givenCheckout([
      {
        id: "p1",
        amount: 100000n,
        gatewayStatus: "PENDING",
        transactionId: "DREF-LAMA",
      },
    ]);

    await expect(settle({ transactionId: "DREF-BARU" })).resolves.toEqual({
      outcome: "TRANSACTION_MISMATCH",
      expected: "DREF-LAMA",
      received: "DREF-BARU",
    });
    expect(palsu.flag).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "TRANSACTION_MISMATCH",
        expected: "DREF-LAMA",
        received: "DREF-BARU",
      }),
    );
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  // Proses yang mati setelah commit dipulihkan oleh callback atau cek status
  // berikutnya; pelunasannya idempoten.
  it("checkout yang semua payment bernominalnya sudah PAID tidak dipindah lagi, tetapi tetap dilunasi ulang", async () => {
    const checkout = givenCheckout([
      { id: "p1", amount: 60000n, gatewayStatus: "PAID" },
      { id: "p2", amount: 40000n, gatewayStatus: "PAID" },
    ]);

    await expect(settle()).resolves.toEqual({ outcome: "ALREADY_PAID" });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.settle).toHaveBeenCalledWith(checkout);
    expect(palsu.recordFee).not.toHaveBeenCalled();
    expect(palsu.restoreCoupons).not.toHaveBeenCalled();
  });

  // Checkout lama memakai payment Rp 0 (tertutup kupon, PAID sejak dibuat)
  // sebagai orderId; webhook dulu menjawab "sudah diproses" untuknya.
  it("payment Rp 0 yang PAID sebagai orderId tidak membuat checkout dianggap lunas", async () => {
    givenCheckout([
      { id: "p1", amount: 0n, gatewayStatus: "PAID" },
      { id: "p2", amount: 100000n, gatewayStatus: "PENDING" },
    ]);

    await expect(settle()).resolves.toEqual({ outcome: "SETTLED" });
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["p2"] } }),
      }),
    );
  });

  it("biaya gateway dicatat sebelum pelunasan, lalu kupon yang sempat dikembalikan dicatat ulang", async () => {
    const checkout = givenCheckout([
      { id: "p1", amount: 100000n, gatewayStatus: "EXPIRED" },
    ]);

    await settle({ fee: 4000 });

    expect(palsu.recordFee).toHaveBeenCalledWith("DUITKU", checkout[0], 4000);
    expect(palsu.restoreCoupons).toHaveBeenCalledWith(checkout);
    expect(palsu.recordFee.mock.invocationCallOrder[0]).toBeLessThan(
      palsu.settle.mock.invocationCallOrder[0],
    );
  });

  it("callback ganda yang tidak lagi memindahkan apa pun tidak mencatat biaya maupun kupon lagi", async () => {
    givenCheckout([{ id: "p1", amount: 100000n, gatewayStatus: "PENDING" }]);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 0 });

    await expect(settle()).resolves.toEqual({ outcome: "ALREADY_PAID" });
    expect(palsu.recordFee).not.toHaveBeenCalled();
    expect(palsu.restoreCoupons).not.toHaveBeenCalled();
    expect(palsu.settle).toHaveBeenCalled();
  });

  it("waktu bayar dari gateway dipakai bila gateway mengirimnya", async () => {
    givenCheckout([{ id: "p1", amount: 100000n, gatewayStatus: "PENDING" }]);
    const paidAt = new Date("2026-11-01T02:03:04.000Z");

    await settle({ paidAt, transactionId: "DREF-1" });

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentDate: paidAt }),
      }),
    );
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { transactionId: "DREF-1" },
    });
  });
});
