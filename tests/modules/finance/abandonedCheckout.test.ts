import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "../../setup";

// Tidak terdaftar di tipe MockPrismaClient; dipasang per tes.
const payments = prismaMock.payment as unknown as {
  updateManyAndReturn: Mock;
};

const palsu = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
  restoreUsage: vi.fn(),
  onPaymentFailed: vi.fn(),
  reconcile: vi.fn(),
  acquireLock: vi.fn(),
}));

vi.mock("@/modules/payment-gateway/services/checkout-reconciliation", () => ({
  reconcileCheckout: palsu.reconcile,
}));

vi.mock("@/lib/distributed-lock", () => ({ acquireLock: palsu.acquireLock }));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onPaymentFailed: palsu.onPaymentFailed },
}));

vi.mock("@/modules/coupons", () => ({
  couponService: {
    releaseUsage: palsu.releaseUsage,
    restoreUsage: palsu.restoreUsage,
  },
}));

import {
  expireStaleGatewayPayments,
  releaseCheckoutCoupons,
  restoreReleasedCoupons,
} from "@/modules/payment-gateway/services/abandoned-checkout";

/**
 * Checkout gateway yang ditinggalkan pelanggan tidak pernah mengirim
 * notifikasi; dulu payment-nya PENDING selamanya dan kuponnya tetap terpakai.
 */
const STALE = [
  {
    id: "p1",
    couponUsageId: "u1",
    tenantId: "t1",
    checkoutId: "c1",
    pelangganId: "cust-1",
    invoiceId: "inv-1",
    amount: 6000n,
    invoice: { dueDate: new Date("2026-10-27T17:00:00Z") },
  },
  {
    id: "p2",
    couponUsageId: "u1",
    tenantId: "t1",
    checkoutId: "c1",
    pelangganId: "cust-1",
    invoiceId: "inv-2",
    amount: 5100n,
    invoice: { dueDate: new Date("2026-10-27T17:00:00Z") },
  },
];

describe("checkout gateway yang ditinggalkan", () => {
  const NOW = new Date("2026-10-27T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    // Pertanyaan pertama: payment yang lewat batas waktu; sesudahnya:
    // payment hidup yang masih memegang kupon (tidak ada).
    prismaMock.payment.findMany
      .mockResolvedValueOnce(STALE)
      .mockResolvedValue([]);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    payments.updateManyAndReturn = vi
      .fn()
      .mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    palsu.reconcile.mockResolvedValue({
      outcome: "UNPAID",
      gatewayStatus: "EXPIRED",
    });
    palsu.acquireLock.mockResolvedValue(async (): Promise<void> => undefined);
  });

  it("hanya payment PENDING yang lewat batas waktu + jeda yang ditutup", async () => {
    const expired = await expireStaleGatewayPayments(NOW);

    expect(expired).toBe(2);
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          gatewayStatus: "PENDING",
          expiresAt: { lt: new Date("2026-10-27T11:00:00Z") },
        },
      }),
    );
    expect(payments.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "EXPIRED" },
      select: { id: true },
    });
  });

  // Callback bisa melunasi checkout di antara pertanyaan ke gateway dan
  // penutupan; kuponnya dipakai pembayaran itu.
  it("payment yang lunas di tengah jalan tidak dilepas kuponnya maupun diberi tahu gagal", async () => {
    payments.updateManyAndReturn.mockResolvedValue([]);

    await expect(expireStaleGatewayPayments(NOW)).resolves.toBe(0);
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
    expect(palsu.onPaymentFailed).not.toHaveBeenCalled();
  });

  it("kupon yang masih dipegang payment hidup lain tidak dilepas", async () => {
    prismaMock.payment.findMany
      .mockReset()
      .mockResolvedValueOnce(STALE)
      .mockResolvedValue([{ couponUsageId: "u1" }]);

    await expireStaleGatewayPayments(NOW);

    expect(palsu.releaseUsage).not.toHaveBeenCalled();
  });

  // Callback yang hilang dulu berakhir sebagai "pembayaran gagal" walau uang
  // pelanggan sudah masuk.
  it("satu checkout ditanyakan sekali ke gateway sebelum ditutup", async () => {
    await expireStaleGatewayPayments(NOW);

    expect(palsu.reconcile).toHaveBeenCalledTimes(1);
    expect(
      palsu.reconcile.mock.calls[0][0].map((p: { id: string }) => p.id),
    ).toEqual(["p1", "p2"]);
  });

  it("checkout yang ternyata dibayar tidak ditutup dan pelanggan tidak diberi tahu gagal", async () => {
    palsu.reconcile.mockResolvedValue({ outcome: "PAID" });

    await expect(expireStaleGatewayPayments(NOW)).resolves.toBe(0);
    expect(payments.updateManyAndReturn).not.toHaveBeenCalled();
    expect(palsu.onPaymentFailed).not.toHaveBeenCalled();
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
  });

  // Ganti metode memindah pemesanan kupon checkout lama sebelum baris
  // checkout barunya ada; menutup checkout lama di antaranya melepas kupon
  // yang akan dipakai checkout baru.
  it("checkout ditutup di bawah kunci checkout pelanggannya", async () => {
    await expireStaleGatewayPayments(NOW);

    expect(palsu.acquireLock.mock.calls).toEqual([
      ["checkout:cust-1", expect.objectContaining({ ttlSeconds: 120 })],
    ]);
  });

  it("pelanggan yang sedang membuat checkout dilewati sampai putaran berikutnya", async () => {
    palsu.acquireLock.mockResolvedValue(null);

    await expect(expireStaleGatewayPayments(NOW)).resolves.toBe(0);
    expect(payments.updateManyAndReturn).not.toHaveBeenCalled();
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
    expect(palsu.onPaymentFailed).not.toHaveBeenCalled();
  });

  it("status yang tidak terbaca dibiarkan untuk putaran berikutnya", async () => {
    palsu.reconcile.mockResolvedValue({ outcome: "UNKNOWN" });

    await expect(expireStaleGatewayPayments(NOW)).resolves.toBe(0);
    expect(payments.updateManyAndReturn).not.toHaveBeenCalled();
    expect(palsu.onPaymentFailed).not.toHaveBeenCalled();
  });

  it("pelanggan diberi tahu sekali per checkout, dengan total nominalnya", async () => {
    await expireStaleGatewayPayments(NOW);

    expect(palsu.onPaymentFailed).toHaveBeenCalledTimes(1);
    expect(palsu.onPaymentFailed).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      amount: 11100,
      dueDate: "2026-10-27T17:00:00.000Z",
      tenantId: "t1",
    });
  });

  it("kupon satu checkout dikembalikan sekali", async () => {
    await expireStaleGatewayPayments(NOW);

    expect(palsu.releaseUsage.mock.calls).toEqual([["u1"]]);
  });

  it("kupon yang gagal dikembalikan tidak menahan kupon lain", async () => {
    palsu.releaseUsage.mockRejectedValueOnce(new Error("db"));

    await releaseCheckoutCoupons([
      { couponUsageId: "u1", tenantId: "t1" },
      { couponUsageId: "u2", tenantId: "t1" },
    ]);

    expect(palsu.releaseUsage.mock.calls).toEqual([["u1"], ["u2"]]);
  });

  it("kupon yang dikembalikan ditandai di payment checkout-nya", async () => {
    await releaseCheckoutCoupons([{ couponUsageId: "u1", tenantId: "t1" }]);

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { couponUsageId: "u1" },
      data: { couponUsageId: null },
    });
  });

  // Checkout kedaluwarsa (kupon sudah dikembalikan) yang ternyata dibayar
  // dulu dilunasi dengan potongan tanpa pemakaian kupon tercatat.
  it("checkout yang kuponnya sudah dikembalikan lalu dibayar mencatat ulang kupon", async () => {
    palsu.restoreUsage.mockResolvedValue("u-baru");

    await restoreReleasedCoupons([
      {
        id: "p1",
        couponUsageId: null,
        couponId: "c1",
        pelangganId: "pel-1",
        tenantId: "t1",
      },
    ]);

    expect(palsu.restoreUsage).toHaveBeenCalledWith("c1", "pel-1");
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] }, couponId: "c1", couponUsageId: null },
      data: { couponUsageId: "u-baru" },
    });
  });

  it("checkout yang kuponnya masih dipesan tidak mencatat ulang", async () => {
    await restoreReleasedCoupons([
      {
        id: "p1",
        couponUsageId: "u1",
        couponId: "c1",
        pelangganId: "pel-1",
        tenantId: "t1",
      },
    ]);

    expect(palsu.restoreUsage).not.toHaveBeenCalled();
  });
});
