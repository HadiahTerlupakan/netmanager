import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
  restoreUsage: vi.fn(),
  checkStatus: vi.fn(),
  cancelPayment: vi.fn(),
  providerFor: vi.fn(),
}));

vi.mock("@/modules/coupons", () => ({
  couponService: {
    releaseUsage: palsu.releaseUsage,
    restoreUsage: palsu.restoreUsage,
  },
}));

vi.mock("@/modules/payment-gateway/services/PaymentGatewayService", () => ({
  PaymentGatewayManager: class {
    checkPaymentStatus = (provider: string, orderId: string) => {
      palsu.providerFor(provider);
      return palsu.checkStatus(orderId);
    };
    getProviderInstance = async () => ({
      cancelPayment: palsu.cancelPayment,
    });
  },
}));

import { replacePendingGatewayCheckouts } from "@/modules/payment-gateway/services/pending-checkout-replacement";

const VA_LAMA = {
  id: "p1",
  checkoutId: "c1",
  reference: "PAY-1",
  gatewayProvider: "BC",
  couponUsageId: "u1",
  tenantId: "t1",
};
const INPUT = { customerId: "cust-1", invoiceIds: ["inv-1"], tenantId: "t1" };

/**
 * Dulu pelanggan yang sudah memilih VA tidak bisa pindah ke QRIS: portal
 * menyembunyikan tombol bayar sampai VA kedaluwarsa, dan backend menumpuk
 * checkout baru di samping yang lama tanpa menutupnya.
 */
describe("ganti metode pembayaran", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.findMany.mockResolvedValue([VA_LAMA]);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    palsu.checkStatus.mockResolvedValue({ status: "PENDING" });
  });

  it("menutup checkout gateway lama, mengembalikan kupon, membatalkan di gateway", async () => {
    const closed = await replacePendingGatewayCheckouts(INPUT);

    expect(closed).toBe(1);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "CANCELLED" },
    });
    expect(palsu.releaseUsage).toHaveBeenCalledWith("u1");
    expect(palsu.providerFor).toHaveBeenCalledWith("DUITKU");
    expect(palsu.cancelPayment).toHaveBeenCalledWith("PAY-1");
  });

  it("transfer manual (tanpa expiresAt) tidak dicari untuk ditutup", async () => {
    await replacePendingGatewayCheckouts(INPUT);

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pelangganId: "cust-1",
          invoiceId: { in: ["inv-1"] },
          gatewayStatus: "PENDING",
          expiresAt: { not: null },
        }),
      }),
    );
  });

  it("checkout lama yang sudah dibayar menolak ganti metode tanpa menutupnya", async () => {
    palsu.checkStatus.mockResolvedValue({ status: "PAID" });

    await expect(replacePendingGatewayCheckouts(INPUT)).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.releaseUsage).not.toHaveBeenCalled();
  });

  it("status gateway yang tidak terbaca tidak menahan pelanggan", async () => {
    palsu.checkStatus.mockRejectedValue(new Error("timeout"));

    await expect(replacePendingGatewayCheckouts(INPUT)).resolves.toBe(1);
  });

  it("tanpa checkout menunggu tidak ada yang diubah", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);

    await expect(replacePendingGatewayCheckouts(INPUT)).resolves.toBe(0);
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(palsu.checkStatus).not.toHaveBeenCalled();
  });
});
