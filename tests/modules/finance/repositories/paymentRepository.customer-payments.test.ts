import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  invoice: { findUnique: vi.fn() },
  payment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/modules/database", () => ({
  prismaBilling: {
    ...tx,
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  },
  prismaBillingAuth: {},
}));

import {
  attachReceiptToPayments,
  cancelPendingManualPayments,
  createCustomerPaymentsForInvoices,
  findPendingManualCheckout,
  markCustomerCheckoutFailed,
  resolveCustomerPaymentMethod,
} from "@/modules/finance/repositories/paymentRepository.customer-payments";
import { normalizePaymentMethod } from "@/modules/payment-gateway/services/webhook-utils";

describe("createCustomerPaymentsForInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.payment.create.mockImplementation(({ data }) => Promise.resolve(data));
  });

  it("invoice PARTIAL_PAID dibayar sebesar sisa tagihan, bukan total", async () => {
    tx.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      status: "PARTIAL_PAID",
      totalAmount: BigInt(150000),
      paidAmount: BigInt(50000),
    });

    const [payment] = await createCustomerPaymentsForInvoices({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      discountAmount: 10000,
      paymentMethod: "MANUAL_bank-1",
    });

    expect(Number(payment.amount)).toBe(90000);
  });

  it("potongan dibagi berurutan tanpa melebihi sisa tiap invoice", async () => {
    const sisa: Record<string, bigint> = { kecil: 10000n, besar: 100000n };
    tx.invoice.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        id: where.id,
        totalAmount: sisa[where.id],
        paidAmount: 0n,
      }),
    );

    const payments = await createCustomerPaymentsForInvoices({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["kecil", "besar"],
      discountAmount: 50000,
      paymentMethod: "QRIS",
    });

    expect(
      payments.map((p) => [
        Number(p.amount),
        Number(p.discountAmount),
        p.gatewayStatus,
      ]),
    ).toEqual([
      [0, 10000, "PAID"],
      [60000, 40000, "PENDING"],
    ]);
  });

  it("semua payment satu checkout berbagi checkoutId", async () => {
    tx.invoice.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.id, totalAmount: 1000n, paidAmount: 0n }),
    );

    const payments = await createCustomerPaymentsForInvoices({
      customerId: "cust-1",
      invoiceIds: ["a", "b"],
      discountAmount: 0,
      paymentMethod: "QRIS",
    });

    const ids = payments.map((p) => (p as { checkoutId?: string }).checkoutId);
    expect(ids[0]).toEqual(expect.any(String));
    expect(ids[1]).toBe(ids[0]);
  });
});

// Kode kanal dulu jatuh ke OTHER karena hanya nama enum yang dikenali;
// kode kanalnya sendiri tetap di gatewayProvider.
describe("metode pembayaran billing untuk kode kanal", () => {
  it.each([
    ["MANUAL_bank-1", "BANK_TRANSFER"],
    ["BC", "BANK_TRANSFER"],
    ["SP", "E_WALLET"],
    ["OV", "E_WALLET"],
    ["FT", "OTHER"],
    ["CASH", "CASH"],
  ])("saat checkout dibuat: %s → %s", (code, method) => {
    expect(resolveCustomerPaymentMethod(code)).toBe(method);
  });

  it.each([
    ["BC", "BANK_TRANSFER"],
    ["SP", "E_WALLET"],
    ["VA", "BANK_TRANSFER"],
    ["FT", undefined],
  ])("saat callback melunasi: paymentCode %s → %s", (code, method) => {
    expect(normalizePaymentMethod(code)).toBe(method);
  });
});

describe("checkout transfer manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Dulu yang dicari paymentMethod BANK_TRANSFER, yang kini juga dipakai VA.
  it("dikenali dari rekening tujuan dan diambil seluruh invoice checkout-nya", async () => {
    tx.payment.findFirst.mockResolvedValue({ id: "p1", checkoutId: "c1" });
    tx.payment.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    const checkout = await findPendingManualCheckout({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
    });

    const pendingManual: Record<string, unknown> = {
      pelangganId: "cust-1",
      gatewayStatus: "PENDING",
      accountId: { not: null },
      verifiedAt: null,
    };
    expect(tx.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...pendingManual, invoiceId: "inv-1" },
      }),
    );
    expect(tx.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...pendingManual, checkoutId: "c1" },
      }),
    );
    expect(checkout.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("tanpa transfer manual menunggu hasilnya kosong", async () => {
    tx.payment.findFirst.mockResolvedValue(null);

    await expect(
      findPendingManualCheckout({ invoiceId: "inv-1", pelangganId: "cust-1" }),
    ).resolves.toEqual([]);
    expect(tx.payment.findMany).not.toHaveBeenCalled();
  });

  it("yang sudah diverifikasi admin tidak bisa dibatalkan atau ditimpa buktinya", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 1 });

    await cancelPendingManualPayments(["p1"]);
    await attachReceiptToPayments({
      receiptUrl: "/uploads/tenants/t1/payment-proofs/bukti.webp",
      payments: [{ id: "p1", notes: "catatan" }],
    });

    const guard: Record<string, unknown> = {
      gatewayStatus: "PENDING",
      verifiedAt: null,
    };
    expect(tx.payment.updateMany.mock.calls).toEqual([
      [
        {
          where: { id: { in: ["p1"] }, ...guard },
          data: { gatewayStatus: "CANCELLED" },
        },
      ],
      [
        {
          where: { id: "p1", ...guard },
          data: {
            receiptUrl: "/uploads/tenants/t1/payment-proofs/bukti.webp",
            notes: "catatan",
          },
        },
      ],
    ]);
  });
});

describe("checkout yang ditolak gateway", () => {
  it("menyimpan alasan gateway dan melepas pemesanan kupon dari payment-nya", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 1 });

    await markCustomerCheckoutFailed(["p1"], "x".repeat(600));

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
      data: {
        gatewayStatus: "FAILED",
        failureReason: "x".repeat(500),
        couponUsageId: null,
      },
    });
  });
});
