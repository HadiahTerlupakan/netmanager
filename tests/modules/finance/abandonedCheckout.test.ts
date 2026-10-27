import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({ releaseUsage: vi.fn() }));

vi.mock("@/modules/coupons", () => ({
  couponService: { releaseUsage: palsu.releaseUsage },
}));

import {
  expireStaleGatewayPayments,
  releaseCheckoutCoupons,
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
      { id: "p1", couponUsageId: "u1", tenantId: "t1" },
      { id: "p2", couponUsageId: "u1", tenantId: "t1" },
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
});
