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
 * Invoice Rp0 tidak bisa menerima payment (amount minimal 1), jadi recompute
 * satu-satunya jalan menuju PAID. Dulu `totalAmount > 0n` menahannya di SENT
 * dan jadwal overdue/isolir tetap berjalan untuk tagihan yang tidak terutang.
 */
function repoDengan(status: string, totalAmount: bigint) {
  const invoice = {
    id: "inv-0",
    pelangganId: "pel-1",
    status,
    totalAmount,
    dueDate: new Date(2026, 10, 5),
    payment: [] as Array<{ amount: bigint; gatewayStatus: string | null }>,
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

describe("InvoicePaymentStateService.recompute — invoice Rp0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.onInvoicePaid.mockResolvedValue(undefined);
  });

  it("menandai invoice Rp0 PAID dan mengirim INVOICE_PAID sekali", async () => {
    const repo = repoDengan("SENT", 0n);

    const hasil = await new InvoicePaymentStateService(repo as never).recompute(
      "inv-0",
    );

    expect(repo.updatePaymentStatus).toHaveBeenCalledWith(
      "inv-0",
      expect.objectContaining({ status: "PAID", paidAmount: 0n }),
    );
    expect(hasil?.becamePaid).toBe(true);
    expect(palsu.onInvoicePaid).toHaveBeenCalledWith("inv-0", "pel-1", 0);
    expect(palsu.cancelInvoiceBillingSchedules).toHaveBeenCalledWith("inv-0");
  });

  it("membiarkan invoice Rp0 yang dibatalkan tetap CANCELLED", async () => {
    const repo = repoDengan("CANCELLED", 0n);

    await new InvoicePaymentStateService(repo as never).recompute("inv-0");

    expect(repo.updatePaymentStatus).toHaveBeenCalledWith(
      "inv-0",
      expect.objectContaining({ status: "CANCELLED" }),
    );
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();
  });

  it("invoice bernilai tanpa payment tetap belum lunas", async () => {
    const repo = repoDengan("SENT", 150000n);

    await new InvoicePaymentStateService(repo as never).recompute("inv-0");

    expect(repo.updatePaymentStatus).toHaveBeenCalledWith(
      "inv-0",
      expect.objectContaining({ status: "SENT" }),
    );
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();
  });
});
