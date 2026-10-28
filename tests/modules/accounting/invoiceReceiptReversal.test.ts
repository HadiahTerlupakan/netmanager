import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ reverse: vi.fn(), findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { journalEntry: { findMany: palsu.findMany } },
}));

vi.mock("@/modules/accounting/services/journal/JournalReverseService", () => ({
  JournalReverseService: class {
    reverse = palsu.reverse;
  },
}));

import {
  invoiceReceiptRef,
  reverseInvoiceReceiptJournals,
} from "@/modules/accounting/services/journal/invoice-receipt-reversal";

describe("jurnal penerimaan invoice", () => {
  beforeEach(() => vi.clearAllMocks());

  // Kunci jurnal otomatis unik per referensi: dengan id invoice saja, invoice
  // yang dibayar ulang setelah pembatalan tidak pernah mendapat jurnal baru.
  it("referensi membedakan tiap pelunasan", () => {
    expect(invoiceReceiptRef("inv-1", "pay-1")).not.toBe(
      invoiceReceiptRef("inv-1", "pay-2"),
    );
  });

  it("membalik jurnal POSTED invoice, termasuk jurnal lama berreferensi invoice saja", async () => {
    palsu.findMany.mockResolvedValue([{ id: "je-lama" }, { id: "je-baru" }]);

    const count = await reverseInvoiceReceiptJournals({
      tenantId: "t1",
      invoiceId: "inv-1",
      reason: "batal",
      reversedBy: "Admin",
    });

    expect(count).toBe(2);
    expect(palsu.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          source: "AUTO_INVOICE_PAID",
          status: "POSTED",
          OR: [
            { sourceRefId: "inv-1" },
            { sourceRefId: { startsWith: "inv-1:" } },
          ],
        }),
      }),
    );
    expect(palsu.reverse.mock.calls).toEqual([
      ["je-lama", "batal", "Admin"],
      ["je-baru", "batal", "Admin"],
    ]);
  });
});
