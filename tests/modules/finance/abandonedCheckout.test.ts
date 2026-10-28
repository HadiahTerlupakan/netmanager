import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
  restoreUsage: vi.fn(),
  onPaymentFailed: vi.fn(),
}));

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
describe("checkout gateway yang ditinggalkan", () => {
  const NOW = new Date("2026-10-27T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.findMany.mockResolvedValue([
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
    ]);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 2 });
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
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "EXPIRED" },
    });
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
