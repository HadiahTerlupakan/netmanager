import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
  restoreUsage: vi.fn(),
  checkStatus: vi.fn(),
  cancelPayment: vi.fn(),
  providerFor: vi.fn(),
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

import {
  handleInvoicePaidCheckoutCleanup,
  replacePendingGatewayCheckouts,
  withCustomerCheckoutLock,
} from "@/modules/payment-gateway/services/pending-checkout-replacement";

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

    expect(palsu.checkStatus).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "CANCELLED" },
    });
    expect(palsu.cancelPayment).toHaveBeenCalledWith("PAY-1");
  });
});
