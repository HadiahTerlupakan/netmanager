import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  onInvoicePaid: vi.fn(),
  onInvoicePartiallyPaid: vi.fn(),
  cancelInvoiceBillingSchedules: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(),
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: palsu.onInvoicePaid,
    onInvoicePartiallyPaid: palsu.onInvoicePartiallyPaid,
  },
}));

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: palsu.cancelInvoiceBillingSchedules,
  syncInvoiceBillingSchedules: palsu.syncInvoiceBillingSchedules,
}));

import { InvoicePaymentStateService } from "@/modules/finance/services/InvoicePaymentStateService";

const PAID_IN_FULL = [
  { amount: 100000n, discountAmount: 0n, gatewayStatus: "PAID" },
];

function repoDengan(status: string) {
  const invoice = {
    id: "inv-1",
    pelangganId: "pel-1",
    status,
    totalAmount: 100000n,
    paidAmount: 0n,
    dueDate: new Date(2026, 10, 5),
    payment: PAID_IN_FULL,
  };
  return {
    findWithPayment: vi.fn().mockResolvedValue(invoice),
    claimPaidTransition: vi.fn().mockResolvedValue(true),
    updatePaymentStatus: vi.fn(
      async (_id: string, data: { status: string; paidAmount: bigint }) => ({
        ...invoice,
        ...data,
      }),
    ),
  };
}

/**
 * VA tagihan yang sudah diganti ("Batalkan & Buat Tagihan Baru") tetap bisa
 * dibayar. Dulu pembayaran itu memindahkan tagihan CANCELLED ke PAID dan
 * mengirim INVOICE_PAID untuk tagihan yang sudah tidak berlaku.
 */
describe("InvoicePaymentStateService.recompute — tagihan dibatalkan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tidak melunasi tagihan CANCELLED walau uangnya sudah diterima", async () => {
    const repo = repoDengan("CANCELLED");

    const hasil = await new InvoicePaymentStateService(repo as never).recompute(
      "inv-1",
    );

    expect(hasil).toMatchObject({
      invoice: { status: "CANCELLED" },
      becamePaid: false,
    });
    expect(repo.claimPaidTransition).not.toHaveBeenCalled();
    expect(repo.updatePaymentStatus).not.toHaveBeenCalled();
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();
    expect(palsu.onInvoicePartiallyPaid).not.toHaveBeenCalled();
  });

  it("tagihan yang dibatalkan di tengah hitung ulang tetap CANCELLED", async () => {
    const repo = repoDengan("SENT");
    // Pembatalan menang: peralihan ke PAID dan penulisan status sama-sama
    // ditolak oleh kondisi status-nya.
    repo.claimPaidTransition.mockResolvedValue(false);
    repo.updatePaymentStatus.mockResolvedValue(null as never);

    const hasil = await new InvoicePaymentStateService(repo as never).recompute(
      "inv-1",
    );

    expect(hasil).toMatchObject({
      invoice: { status: "CANCELLED" },
      becamePaid: false,
    });
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();
    expect(palsu.cancelInvoiceBillingSchedules).not.toHaveBeenCalled();
    expect(palsu.syncInvoiceBillingSchedules).not.toHaveBeenCalled();
  });
});
