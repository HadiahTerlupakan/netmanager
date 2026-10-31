import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "../../setup";

// Tidak terdaftar di tipe MockPrismaClient; dipasang per tes.
const payments = prismaMock.payment as unknown as {
  updateManyAndReturn: Mock;
};

import {
  claimPendingCheckout,
  type VerifiablePayment,
} from "@/modules/finance/repositories/manualPaymentVerification.repository";

const transfer = (id: string): VerifiablePayment => ({
  id,
  checkoutId: "co-1",
  invoiceId: `inv-${id}`,
  pelangganId: "cust-1",
  tenantId: "t1",
  amount: 100000n,
  gatewayStatus: "PENDING",
  accountId: "rek-bca",
  notes: "OCR",
  couponUsageId: null,
  couponId: null,
  invoice: { invoiceNumber: `INV-${id}`, status: "SENT" },
});

const CHECKOUT = [transfer("p1"), transfer("p2")];
const APPROVE = { gatewayStatus: "PAID" as const };

/**
 * Persetujuan dulu memindahkan payment checkout satu per satu dan menerima
 * hasil sebagian: pembatalan pelanggan yang commit di tengahnya meninggalkan
 * checkout yang separuh disetujui.
 */
describe("claimPendingCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: unknown) =>
      typeof callback === "function" ? callback(prismaMock) : callback,
    );
    payments.updateManyAndReturn = vi
      .fn()
      .mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
  });

  it("memindahkan seluruh checkout dalam satu pernyataan bersyarat", async () => {
    await expect(claimPendingCheckout(CHECKOUT, APPROVE)).resolves.toBe(true);

    expect(payments.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: { in: ["p1", "p2"] },
        gatewayStatus: "PENDING",
        verifiedAt: null,
      },
      data: APPROVE,
      select: { id: true },
    });
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it("catatan per payment ditulis di transaksi yang sama", async () => {
    await claimPendingCheckout(CHECKOUT, APPROVE, (p) => `${p.notes} + admin`);

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { notes: "OCR + admin" },
    });
  });

  it("checkout yang sebagian sudah berubah tidak diklaim sama sekali", async () => {
    payments.updateManyAndReturn.mockResolvedValue([{ id: "p1" }]);

    await expect(
      claimPendingCheckout(CHECKOUT, APPROVE, (p) => p.notes),
    ).resolves.toBe(false);
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  // Postgres membatalkan salah satu transaksi yang saling menunggu
  // (40P01, oleh Prisma dilaporkan P2034).
  it("deadlock dengan pembatalan pelanggan berarti checkout berubah", async () => {
    payments.updateManyAndReturn.mockRejectedValue(
      Object.assign(new Error("deadlock"), { code: "P2034" }),
    );

    await expect(claimPendingCheckout(CHECKOUT, APPROVE)).resolves.toBe(false);
  });

  it("galat lain tetap dilempar", async () => {
    payments.updateManyAndReturn.mockRejectedValue(new Error("koneksi putus"));

    await expect(claimPendingCheckout(CHECKOUT, APPROVE)).rejects.toThrow(
      "koneksi putus",
    );
  });
});
