import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  onInvoicePaid: vi.fn(async () => {}),
  onInvoicePartiallyPaid: vi.fn(async () => {}),
  onInvoicePaymentReverted: vi.fn(async () => {}),
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: palsu.onInvoicePaid,
    onInvoicePartiallyPaid: palsu.onInvoicePartiallyPaid,
    onInvoicePaymentReverted: palsu.onInvoicePaymentReverted,
  },
}));
vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(),
}));

import { InvoicePaymentStateService } from "@/modules/finance/services/InvoicePaymentStateService";

function repoDengan(
  paidAmount: bigint,
  amounts: bigint[],
  status = paidAmount > 0n ? "PARTIAL_PAID" : "SENT",
) {
  const invoice = {
    id: "inv-1",
    tenantId: "tenant-1",
    pelangganId: "pel-1",
    status,
    totalAmount: 100000n,
    paidAmount,
    payment: amounts.map((amount) => ({
      amount,
      discountAmount: 0n,
      gatewayStatus: null as string | null,
    })),
  };
  return {
    findWithPayment: vi.fn().mockResolvedValue(invoice),
    claimPaidTransition: vi.fn().mockResolvedValue(true),
    updatePaymentStatus: vi.fn(async (_id: string, data: object) => ({
      ...invoice,
      ...data,
    })),
  };
}

// Uang dari pembayaran sebagian harus dibukukan; dulu hanya pelunasan yang
// mengirim event dan pembayaran sebagian tidak pernah berjurnal.
describe("InvoicePaymentStateService.recompute — pembayaran sebagian", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengirim INVOICE_PARTIALLY_PAID saat pembayaran sebagian masuk", async () => {
    const repo = repoDengan(0n, [30000n]);

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePartiallyPaid).toHaveBeenCalledWith(
      "inv-1",
      "pel-1",
      30000,
      "tenant-1",
    );
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();
  });

  it("tidak mengirim ulang saat jumlah terbayar tidak bertambah", async () => {
    const repo = repoDengan(30000n, [30000n]);

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePartiallyPaid).not.toHaveBeenCalled();
  });

  it("pelunasan mengirim INVOICE_PAID, bukan pembayaran sebagian", async () => {
    const repo = repoDengan(30000n, [30000n, 70000n]);

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePaid).toHaveBeenCalledTimes(1);
    // Audit reseller #1/#3/#9: tanpa tenantId worker berjalan di system
    // context dan komisi reseller tidak pernah terbit.
    expect(palsu.onInvoicePaid).toHaveBeenCalledWith(
      "inv-1",
      "pel-1",
      100000,
      expect.any(Object),
      "tenant-1",
    );
    expect(palsu.onInvoicePartiallyPaid).not.toHaveBeenCalled();
  });

  // Reviewer reseller: PAID yang turun lagi (payment di-refund/dihapus) dulu
  // tidak menerbitkan sinyal, sehingga komisi reseller ACCRUED tetap disettle.
  it("mengirim INVOICE_PAYMENT_REVERTED saat tagihan PAID turun ke SENT", async () => {
    const repo = repoDengan(100000n, [], "PAID");

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePaymentReverted).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "pel-1",
      nextStatus: "SENT",
      revertedAt: expect.any(String),
      tenantId: "tenant-1",
    });
    expect(palsu.onInvoicePartiallyPaid).not.toHaveBeenCalled();
  });

  it("mengirim INVOICE_PAYMENT_REVERTED saat tagihan PAID turun ke PARTIAL_PAID", async () => {
    const repo = repoDengan(100000n, [40000n], "PAID");

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePaymentReverted).toHaveBeenCalledWith(
      expect.objectContaining({ nextStatus: "PARTIAL_PAID" }),
    );
  });

  it("tidak mengirim INVOICE_PAYMENT_REVERTED selama tagihan tetap PAID", async () => {
    const repo = repoDengan(100000n, [100000n], "PAID");

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePaymentReverted).not.toHaveBeenCalled();
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();
  });
});
