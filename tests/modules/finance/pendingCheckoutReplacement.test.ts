import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "../../setup";

// Tidak terdaftar di tipe MockPrismaClient; dipasang per tes.
const payments = prismaMock.payment as unknown as {
  updateManyAndReturn: Mock;
};

/**
 * Baris menunggu yang ditemukan pencarian checkout lama; pertanyaan
 * "siapa yang masih memegang kupon" (where.couponUsageId) menjawab kosong.
 */
function pendingRows<T extends { id: string }>(rows: T[]) {
  prismaMock.payment.findMany.mockImplementation(
    async (args: { where?: { couponUsageId?: unknown } }) =>
      args?.where?.couponUsageId ? [] : rows,
  );
  payments.updateManyAndReturn = vi
    .fn()
    .mockResolvedValue(rows.map(({ id }) => ({ id })));
}

const palsu = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
  restoreUsage: vi.fn(),
  reconcile: vi.fn(),
  cancelPayment: vi.fn(),
  acquireLock: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/distributed-lock", () => ({ acquireLock: palsu.acquireLock }));

vi.mock("@/modules/coupons", () => ({
  couponService: {
    releaseUsage: palsu.releaseUsage,
    restoreUsage: palsu.restoreUsage,
  },
}));

vi.mock(
  "@/modules/payment-gateway/services/checkout-reconciliation",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/payment-gateway/services/checkout-reconciliation")
    >()),
    reconcileCheckout: palsu.reconcile,
  }),
);

vi.mock("@/modules/payment-gateway/services/PaymentGatewayService", () => ({
  PaymentGatewayManager: class {
    getIssuedTransactionProvider = async () => ({
      cancelPayment: palsu.cancelPayment,
    });
  },
}));

import {
  closeReplacedCheckouts,
  findReplaceableCheckouts,
  handleInvoicePaidCheckoutCleanup,
  withCustomerCheckoutLock,
} from "@/modules/payment-gateway/services/pending-checkout-replacement";

const VA_LAMA = {
  id: "p1",
  checkoutId: "c1",
  reference: "PAY-1",
  gatewayProvider: "BC",
  couponUsageId: "u1",
  couponId: "kupon-1",
  tenantId: "t1",
  accountId: null as string | null,
  receiptUrl: null as string | null,
  expiresAt: new Date("2026-11-01T00:00:00Z") as Date | null,
};
const TRANSFER_MANUAL = {
  id: "p9",
  checkoutId: "c9",
  reference: "PAY-9",
  gatewayProvider: null as string | null,
  couponUsageId: null as string | null,
  couponId: null as string | null,
  tenantId: "t1",
  accountId: "rekening-1" as string | null,
  receiptUrl: null as string | null,
  expiresAt: null as Date | null,
};
const INPUT = { customerId: "cust-1", invoiceIds: ["inv-1"] };

/**
 * Ganti metode dulu menutup checkout lama sebelum kupon diverifikasi dan
 * checkout baru dibuat. Saat Duitku menolak metode baru (produksi
 * 2026-10-31: DANA, ShopeePay, FT menjawab 502), pelanggan tidak lagi
 * melihat VA/QR lama yang sebenarnya masih bisa dibayar.
 */
describe("ganti metode pembayaran", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingRows([VA_LAMA]);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    palsu.reconcile.mockResolvedValue({
      outcome: "UNPAID",
      gatewayStatus: "PENDING",
    });
  });

  it("mencari checkout lama tanpa menutupnya", async () => {
    const previous = await findReplaceableCheckouts(INPUT);

    expect(previous).toEqual({
      payments: [VA_LAMA],
      heldCoupon: { couponId: "kupon-1", couponUsageId: "u1" },
    });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
  });

  it("checkout gateway dan transfer manual sama-sama bisa diganti", async () => {
    await findReplaceableCheckouts(INPUT);

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pelangganId: "cust-1",
          invoiceId: { in: ["inv-1"] },
          gatewayStatus: "PENDING",
          OR: [{ expiresAt: { not: null } }, { accountId: { not: null } }],
        }),
      }),
    );
  });

  it("bukti transfer yang sedang diverifikasi menolak checkout baru", async () => {
    pendingRows([
      { ...TRANSFER_MANUAL, receiptUrl: "/uploads/tenants/t1/bukti.webp" },
    ]);

    await expect(findReplaceableCheckouts(INPUT)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/sedang diverifikasi/),
    });
  });

  it("status checkout gateway lama ditanyakan dengan batas waktu pendek", async () => {
    pendingRows([VA_LAMA, TRANSFER_MANUAL]);

    await findReplaceableCheckouts(INPUT);

    expect(palsu.reconcile).toHaveBeenCalledTimes(1);
    expect(palsu.reconcile).toHaveBeenCalledWith([VA_LAMA], {
      timeoutMs: 10_000,
    });
  });

  it("checkout lama yang sudah dibayar menolak ganti metode tanpa menutupnya", async () => {
    palsu.reconcile.mockResolvedValue({ outcome: "PAID" });

    await expect(findReplaceableCheckouts(INPUT)).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
  });

  it("status gateway yang tidak terbaca tidak menahan pelanggan", async () => {
    palsu.reconcile.mockResolvedValue({ outcome: "UNKNOWN" });

    await expect(findReplaceableCheckouts(INPUT)).resolves.toMatchObject({
      payments: [VA_LAMA],
    });
  });

  it("setelah pengganti berhasil: checkout lama ditutup, kupon dikembalikan, dibatalkan di gateway", async () => {
    pendingRows([VA_LAMA, TRANSFER_MANUAL]);
    const previous = await findReplaceableCheckouts(INPUT);

    await closeReplacedCheckouts(previous, { keptCouponUsageId: null });

    expect(payments.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p9"] }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "CANCELLED" },
      select: { id: true },
    });
    expect(palsu.releaseUsage).toHaveBeenCalledWith("u1");
    expect(palsu.cancelPayment.mock.calls).toEqual([["PAY-1"]]);
  });

  // Kupon berkuota satu: pemesanannya pindah ke checkout baru, bukan
  // dikembalikan lalu dipesan ulang.
  it("kupon yang dipindah ke checkout baru tidak dikembalikan", async () => {
    const previous = await findReplaceableCheckouts(INPUT);

    await closeReplacedCheckouts(previous, { keptCouponUsageId: "u1" });

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] }, couponUsageId: "u1" },
      data: { couponUsageId: null },
    });
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
  });

  // Callback bisa melunasi VA lama di antara pencarian dan penutupan.
  it("checkout lama yang lunas di tengah jalan tidak dilepas kuponnya", async () => {
    const previous = await findReplaceableCheckouts(INPUT);
    payments.updateManyAndReturn.mockResolvedValue([]);

    await expect(
      closeReplacedCheckouts(previous, { keptCouponUsageId: null }),
    ).resolves.toBe(0);
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
    expect(palsu.cancelPayment).not.toHaveBeenCalled();
  });

  it("tanpa checkout menunggu tidak ada yang diubah", async () => {
    pendingRows([]);

    const previous = await findReplaceableCheckouts(INPUT);
    await expect(
      closeReplacedCheckouts(previous, { keptCouponUsageId: null }),
    ).resolves.toBe(0);
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.reconcile).not.toHaveBeenCalled();
  });

  it("kunci checkout dipegang per pelanggan selama checkout dibuat", async () => {
    palsu.acquireLock.mockResolvedValue(palsu.release);
    const task = vi.fn().mockResolvedValue("checkout");

    await expect(withCustomerCheckoutLock("cust-1", task)).resolves.toBe(
      "checkout",
    );

    expect(palsu.acquireLock).toHaveBeenCalledWith(
      "checkout:cust-1",
      expect.objectContaining({ ttlSeconds: 120 }),
    );
    expect(palsu.release).toHaveBeenCalledTimes(1);
  });

  it("kunci dilepas walau pembuatan checkout gagal", async () => {
    palsu.acquireLock.mockResolvedValue(palsu.release);

    await expect(
      withCustomerCheckoutLock("cust-1", () =>
        Promise.reject(new Error("gateway")),
      ),
    ).rejects.toThrow("gateway");
    expect(palsu.release).toHaveBeenCalledTimes(1);
  });

  it("kunci yang sedang dipegang perangkat lain menolak dengan 409", async () => {
    palsu.acquireLock.mockResolvedValue(null);
    const task = vi.fn();

    await expect(
      withCustomerCheckoutLock("cust-1", task),
    ).rejects.toMatchObject({ status: 409 });
    expect(task).not.toHaveBeenCalled();
  });

  // VA lama dibayar setelah pelanggan sudah membuat QRIS: QRIS-nya ditutup
  // agar tidak dibayar juga.
  it("invoice lunas menutup checkout gateway lain yang masih menunggu", async () => {
    await handleInvoicePaidCheckoutCleanup({
      data: {
        eventName: "billing:invoice.paid",
        payload: { invoiceId: "inv-1", pelangganId: "cust-1" },
      },
    } as never);

    expect(palsu.reconcile).not.toHaveBeenCalled();
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expiresAt: { not: null } }),
      }),
    );
    expect(payments.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "CANCELLED" },
      select: { id: true },
    });
    expect(palsu.cancelPayment).toHaveBeenCalledWith("PAY-1");
  });
});
