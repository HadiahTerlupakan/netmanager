import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  invoice: {
    id: "inv-1",
    tenantId: "tenant-1",
    invoiceNumber: "INV-1",
    pelangganId: "pel-1",
    status: "PAID",
    totalAmount: 100000n,
    notes: null as string | null,
    payment: [] as unknown[],
  },
  repo: {
    findUnique: vi.fn(),
    voidInvoiceTransaction: vi.fn(),
  },
  onInvoiceVoided: vi.fn(async () => {}),
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: vi.fn(function InvoiceRepository() {
    return fakes.repo;
  }),
}));
vi.mock("@/modules/finance/services/abandoned-manual-transfer", () => ({
  closeAbandonedManualTransfers: vi.fn(),
}));
vi.mock("@/modules/finance/services/customer-checkout-lock", () => ({
  runAdminActionUnderCustomerCheckoutLock: (
    _pelangganId: string,
    _reason: string,
    task: () => Promise<unknown>,
  ) => task(),
}));
vi.mock("@/modules/finance/services/invoice-cancellation-journals", () => ({
  reverseJournalsOfCancelledInvoice: vi.fn(),
}));
vi.mock("@/modules/finance/services/outstanding-invoice.helpers", () => ({
  refundSaldoKreditUsedBy: vi.fn(),
}));
vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: vi.fn(),
}));
vi.mock("@/modules/finance/pelanggan-registry", () => ({
  getPelangganBillingBridge: () => ({
    findById: vi.fn(async () => null),
    update: vi.fn(),
  }),
}));
vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onInvoiceVoided: fakes.onInvoiceVoided },
  CustomerEventDispatcher: { onIsolated: vi.fn() },
}));

import { reverseJournalsOfCancelledInvoice } from "@/modules/finance/services/invoice-cancellation-journals";
import { VoidInvoiceService } from "@/modules/finance/services/VoidInvoiceService";

/**
 * Audit reseller #13: void invoice PAID dulu tidak menerbitkan sinyal apa pun,
 * sehingga komisi reseller untuknya tetap ACCRUED dan ikut dibayarkan.
 */
describe("VoidInvoiceService — INVOICE_VOIDED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.repo.findUnique.mockResolvedValue(fakes.invoice);
  });

  it("menerbitkan INVOICE_VOIDED dengan tenant tagihan setelah void berhasil", async () => {
    fakes.repo.voidInvoiceTransaction.mockResolvedValue(true);

    await VoidInvoiceService.voidInvoice("inv-1", "Salah tagih", "admin-1");

    expect(fakes.onInvoiceVoided).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "pel-1",
      previousStatus: "PAID",
      voidedAt: expect.any(String),
      tenantId: "tenant-1",
    });
  });

  it("tetap menerbitkan INVOICE_VOIDED bila efek turunan void gagal", async () => {
    fakes.repo.voidInvoiceTransaction.mockResolvedValue(true);
    vi.mocked(reverseJournalsOfCancelledInvoice).mockRejectedValueOnce(
      new Error("jurnal pembalik gagal"),
    );

    await expect(
      VoidInvoiceService.voidInvoice("inv-1", "Salah tagih", "admin-1"),
    ).rejects.toThrow("jurnal pembalik gagal");
    expect(fakes.onInvoiceVoided).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "inv-1", tenantId: "tenant-1" }),
    );
  });

  it("tidak menerbitkan apa pun bila void kalah balapan", async () => {
    fakes.repo.voidInvoiceTransaction.mockResolvedValue(false);

    await expect(
      VoidInvoiceService.voidInvoice("inv-1", "Salah tagih", "admin-1"),
    ).rejects.toThrow("CONFLICT");
    expect(fakes.onInvoiceVoided).not.toHaveBeenCalled();
  });

  it("publish yang gagal tidak menggagalkan void yang sudah tersimpan", async () => {
    fakes.repo.voidInvoiceTransaction.mockResolvedValue(true);
    fakes.onInvoiceVoided.mockRejectedValueOnce(new Error("outbox mati"));

    const result = await VoidInvoiceService.voidInvoice(
      "inv-1",
      "Salah tagih",
      "admin-1",
    );

    expect(result.success).toBe(true);
  });
});
