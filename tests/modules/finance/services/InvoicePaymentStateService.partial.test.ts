import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  onInvoicePaid: vi.fn(async () => {}),
  onInvoicePartiallyPaid: vi.fn(async () => {}),
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: palsu.onInvoicePaid,
    onInvoicePartiallyPaid: palsu.onInvoicePartiallyPaid,
  },
}));
vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(),
}));

import { InvoicePaymentStateService } from "@/modules/finance/services/InvoicePaymentStateService";

function repoDengan(paidAmount: bigint, amounts: bigint[]) {
  const invoice = {
    id: "inv-1",
    pelangganId: "pel-1",
    status: paidAmount > 0n ? "PARTIAL_PAID" : "SENT",
    totalAmount: 100000n,
    paidAmount,
    payment: amounts.map((amount) => ({
      amount,
      discountAmount: 0n,
      gatewayStatus: null,
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
    expect(palsu.onInvoicePartiallyPaid).not.toHaveBeenCalled();
  });
});
