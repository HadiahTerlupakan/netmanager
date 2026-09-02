import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(),
}));

import { replaceOutstandingInvoiceForCustomer } from "@/modules/finance/services/outstanding-invoice.helpers";

function createInvoiceRepo(
  invoices: Array<{ id: string; status: string; paidAmount: bigint }> = [],
) {
  return {
    findUnpaidInvoices: vi.fn().mockResolvedValue(invoices),
    update: vi.fn().mockImplementation(async (id: string) => ({ id })),
  };
}

describe("replaceOutstandingInvoiceForCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regresi: aksi "Batalkan & Buat Tagihan Baru" hanya membuat tagihan baru,
  // tagihan lama tetap hidup sehingga pelanggan punya dua tagihan.
  it("membatalkan tagihan lama sebelum membuat yang baru", async () => {
    const callOrder: string[] = [];
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-lama", status: "SENT", paidAmount: 0n },
    ]);
    invoiceRepo.update.mockImplementation(async (id: string) => {
      callOrder.push(`cancel:${id}`);
      return { id };
    });

    await replaceOutstandingInvoiceForCustomer({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
      createInvoice: async () => {
        callOrder.push("create");
        return { id: "inv-baru" };
      },
    });

    expect(callOrder).toEqual(["cancel:inv-lama", "create"]);
  });

  it("melaporkan tagihan yang dibatalkan dan tagihan penggantinya", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-lama", status: "OVERDUE", paidAmount: 0n },
    ]);

    const result = await replaceOutstandingInvoiceForCustomer({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
      createInvoice: async () => ({ id: "inv-baru" }),
    });

    expect(result.cancelledInvoiceIds).toEqual(["inv-lama"]);
    expect(result.invoice).toEqual({ id: "inv-baru" });
  });

  it("tidak membuat tagihan baru bila pembatalan gagal", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-lama", status: "SENT", paidAmount: 0n },
    ]);
    invoiceRepo.update.mockRejectedValue(new Error("db down"));
    const createInvoice = vi.fn();

    await expect(
      replaceOutstandingInvoiceForCustomer({
        pelangganId: "cust-1",
        invoiceRepo: invoiceRepo as never,
        createInvoice,
      }),
    ).rejects.toThrow("db down");
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("tetap membuat tagihan baru saat tidak ada tagihan lama", async () => {
    const invoiceRepo = createInvoiceRepo([]);
    const createInvoice = vi.fn().mockResolvedValue({ id: "inv-baru" });

    const result = await replaceOutstandingInvoiceForCustomer({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
      createInvoice,
    });

    expect(result.cancelledInvoiceIds).toEqual([]);
    expect(createInvoice).toHaveBeenCalledOnce();
  });

  // Uang yang sudah masuk tidak boleh digantung.
  it("tidak membatalkan tagihan yang sudah menyerap pembayaran", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-lama", status: "PARTIAL_PAID", paidAmount: 50000n },
    ]);

    const result = await replaceOutstandingInvoiceForCustomer({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
      createInvoice: async () => ({ id: "inv-baru" }),
    });

    expect(result.cancelledInvoiceIds).toEqual([]);
    expect(invoiceRepo.update).not.toHaveBeenCalled();
  });
});
