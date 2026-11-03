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

type Payment = {
  amount: bigint;
  discountAmount: bigint;
  gatewayStatus: string | null;
};

function repoDengan(invoice: {
  totalAmount: bigint;
  discountAmount: bigint;
  notes: string | null;
  payment: Payment[];
}) {
  const row = {
    id: "inv-1",
    tenantId: "tenant-1",
    pelangganId: "pel-1",
    status: "SENT",
    paidAmount: 0n,
    dueDate: new Date(2026, 10, 5),
    ...invoice,
  };
  return {
    findWithPayment: vi.fn().mockResolvedValue(row),
    claimPaidTransition: vi.fn().mockResolvedValue(true),
    updatePaymentStatus: vi.fn(async (_id: string, data: object) => ({
      ...row,
      ...data,
    })),
  };
}

/**
 * INVOICE_PAID dulu membawa total tagihan saja, dan notifikasinya menyebut
 * total itu sebagai uang yang dibayar: pelanggan berkupon membaca nominal
 * yang tidak pernah ia bayar, dan tagihan yang lunas dengan saldo terbaca
 * "Pembayaran Rp 0 berhasil". Total tetap di `amount` (dasar komisi).
 */
describe("InvoicePaymentStateService.recompute — rincian INVOICE_PAID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.onInvoicePaid.mockResolvedValue(undefined);
  });

  it("memisahkan uang yang dibayar, potongan kupon, dan saldo kredit", async () => {
    const repo = repoDengan({
      totalAmount: 95000n,
      discountAmount: 5000n,
      notes: "Saldo kredit terpakai: Rp 5000",
      payment: [
        { amount: 85000n, discountAmount: 10000n, gatewayStatus: "PAID" },
        { amount: 95000n, discountAmount: 0n, gatewayStatus: "EXPIRED" },
      ],
    });

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePaid).toHaveBeenCalledWith(
      "inv-1",
      "pel-1",
      95000,
      { amountPaid: 85000, couponDiscount: 10000, saldoUsed: 5000 },
      "tenant-1",
    );
  });

  // Kelebihan bayar punya pemberitahuannya sendiri (saldo kredit).
  it("uang yang dibayar tidak melebihi tagihan", async () => {
    const repo = repoDengan({
      totalAmount: 100000n,
      discountAmount: 0n,
      notes: null,
      payment: [
        { amount: 100000n, discountAmount: 0n, gatewayStatus: "PAID" },
        { amount: 100000n, discountAmount: 0n, gatewayStatus: null },
      ],
    });

    await new InvoicePaymentStateService(repo as never).recompute("inv-1");

    expect(palsu.onInvoicePaid).toHaveBeenCalledWith(
      "inv-1",
      "pel-1",
      100000,
      { amountPaid: 100000, couponDiscount: 0, saldoUsed: 0 },
      "tenant-1",
    );
  });

  // Event yang gagal dikirim tidak membatalkan pelunasan yang sudah tersimpan.
  it("dispatcher yang gagal tidak menggagalkan hitung ulang", async () => {
    palsu.onInvoicePaid.mockImplementation(() => {
      throw new Error("outbox mati");
    });
    const repo = repoDengan({
      totalAmount: 100000n,
      discountAmount: 0n,
      notes: null,
      payment: [{ amount: 100000n, discountAmount: 0n, gatewayStatus: "PAID" }],
    });

    const hasil = await new InvoicePaymentStateService(repo as never).recompute(
      "inv-1",
    );

    expect(hasil?.becamePaid).toBe(true);
  });

  // Rekonsiliasi outbox: event yang hilang dikirim ulang dengan rincian sama.
  it("replayInvoicePaid mengirim ulang INVOICE_PAID hanya untuk invoice PAID", async () => {
    const repo = repoDengan({
      totalAmount: 100000n,
      discountAmount: 0n,
      notes: null,
      payment: [{ amount: 100000n, discountAmount: 0n, gatewayStatus: "PAID" }],
    });
    const service = new InvoicePaymentStateService(repo as never);

    await expect(service.replayInvoicePaid("inv-1")).resolves.toBe(false);
    expect(palsu.onInvoicePaid).not.toHaveBeenCalled();

    repo.findWithPayment.mockResolvedValue({
      ...(await repo.findWithPayment()),
      status: "PAID",
    });
    await expect(service.replayInvoicePaid("inv-1")).resolves.toBe(true);
    expect(palsu.onInvoicePaid).toHaveBeenCalledWith(
      "inv-1",
      "pel-1",
      100000,
      { amountPaid: 100000, couponDiscount: 0, saldoUsed: 0 },
      "tenant-1",
    );
    expect(repo.claimPaidTransition).not.toHaveBeenCalled();
  });
});
