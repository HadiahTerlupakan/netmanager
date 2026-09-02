import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { cancelOutstandingInvoices } from "@/modules/finance/services/outstanding-invoice.helpers";

function createInvoiceRepo(
  invoices: Array<{ id: string; status: string; paidAmount: bigint }>,
) {
  return {
    findUnpaidInvoices: vi.fn().mockResolvedValue(invoices),
    update: vi.fn().mockImplementation(async (id: string) => ({ id })),
  };
}

describe("cancelOutstandingInvoices", () => {
  // Regresi: opsi UI "Batalkan & Buat Tagihan Baru" (VOID_AND_CREATE_NEW)
  // hanya membuat invoice baru — invoice lama tidak pernah dibatalkan,
  // sehingga pelanggan berakhir dengan dua tagihan hidup.
  it("membatalkan invoice yang belum dibayar", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-1", status: "SENT", paidAmount: 0n },
    ]);

    const cancelled = await cancelOutstandingInvoices({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
    });

    expect(cancelled).toEqual(["inv-1"]);
    expect(invoiceRepo.update).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ status: "CANCELLED" }),
    );
  });

  it("membatalkan invoice yang sudah lewat jatuh tempo", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-1", status: "OVERDUE", paidAmount: 0n },
    ]);

    const cancelled = await cancelOutstandingInvoices({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
    });

    expect(cancelled).toEqual(["inv-1"]);
  });

  // Uang yang sudah masuk tidak boleh digantung: membatalkan invoice yang
  // sudah dibayar sebagian akan membuat payment-nya yatim.
  it("tidak menyentuh invoice yang sudah dibayar sebagian", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-1", status: "PARTIAL_PAID", paidAmount: 50000n },
    ]);

    const cancelled = await cancelOutstandingInvoices({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
    });

    expect(cancelled).toEqual([]);
    expect(invoiceRepo.update).not.toHaveBeenCalled();
  });

  it("tidak menyentuh invoice yang punya pembayaran walau status masih SENT", async () => {
    const invoiceRepo = createInvoiceRepo([
      { id: "inv-1", status: "SENT", paidAmount: 25000n },
    ]);

    const cancelled = await cancelOutstandingInvoices({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
    });

    expect(cancelled).toEqual([]);
  });

  it("hanya mencari invoice milik pelanggan tersebut", async () => {
    const invoiceRepo = createInvoiceRepo([]);

    await cancelOutstandingInvoices({
      pelangganId: "cust-9",
      invoiceRepo: invoiceRepo as never,
    });

    expect(invoiceRepo.findUnpaidInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ pelangganId: "cust-9" }),
      expect.anything(),
    );
  });

  it("mengembalikan daftar kosong saat tidak ada tagihan hidup", async () => {
    const invoiceRepo = createInvoiceRepo([]);

    const cancelled = await cancelOutstandingInvoices({
      pelangganId: "cust-1",
      invoiceRepo: invoiceRepo as never,
    });

    expect(cancelled).toEqual([]);
  });
});
