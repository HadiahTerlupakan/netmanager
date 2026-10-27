import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  onInvoicePaid: vi.fn(),
  cancelInvoiceBillingSchedules: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(),
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onInvoicePaid: palsu.onInvoicePaid },
}));

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: palsu.cancelInvoiceBillingSchedules,
  syncInvoiceBillingSchedules: palsu.syncInvoiceBillingSchedules,
}));

import { InvoicePaymentStateService } from "@/modules/finance/services/InvoicePaymentStateService";

/**
 * Kupon tidak mengurangi totalAmount invoice; pelanggan hanya membayar
 * amount = sisa − potongan. Dulu recompute menjumlahkan amount saja, jadi
 * invoice yang dibayar penuh dengan kupon tertahan PARTIAL_PAID dan
 * pelanggan isolir tidak pernah aktif kembali.
 */
function repoDengan(
  payment: Array<{
    amount: bigint;
    discountAmount: bigint;
    gatewayStatus: string | null;
  }>,
) {
  const invoice = {
    id: "inv-1",
    pelangganId: "pel-1",
    status: "SENT",
    totalAmount: 100000n,
    dueDate: new Date(2026, 10, 5),
    payment,
  };
  return {
    findWithPayment: vi.fn().mockResolvedValue(invoice),
    updatePaymentStatus: vi.fn(
      async (_id: string, data: { status: string; paidAmount: bigint }) => ({
        ...invoice,
        ...data,
      }),
    ),
  };
}

describe("InvoicePaymentStateService.recompute — kupon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.onInvoicePaid.mockResolvedValue(undefined);
  });

  it("pembayaran berkupon yang lunas melunasi invoice", async () => {
    const repo = repoDengan([
      { amount: 90000n, discountAmount: 10000n, gatewayStatus: "PAID" },
    ]);

    const hasil = await new InvoicePaymentStateService(repo as never).recompute(
      "inv-1",
    );

    expect(repo.updatePaymentStatus).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ status: "PAID", paidAmount: 100000n }),
    );
    expect(hasil?.becamePaid).toBe(true);
  });

  it("potongan pembayaran yang belum lunas tidak dihitung", async () => {
    const repo = repoDengan([
      { amount: 90000n, discountAmount: 10000n, gatewayStatus: "PENDING" },
    ]);

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(repo.updatePaymentStatus).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ status: "SENT", paidAmount: 0n }),
    );
  });
});
