import { beforeEach, describe, expect, it, vi } from "vitest";

const finance = vi.hoisted(() => ({ findRawById: vi.fn() }));

vi.mock("@/modules/finance", async () => {
  const note = await import("@/modules/finance/services/saldo-kredit-note");
  return {
    FinanceRepositoryFacade: {
      createInvoiceRepository: () => ({ findRawById: finance.findRawById }),
    },
    readSaldoKreditUsed: note.readSaldoKreditUsed,
  };
});

import { FinanceInvoicePaymentStatusReader } from "@/modules/reseller/services/finance-invoice-status-reader";

/**
 * Finance menyimpan saldo kredit terpakai dan diskon admin di kolom yang sama
 * (`discountAmount`); pembaca memisahkannya lewat catatan invoice agar dasar
 * komisi (DPP) tidak mengurangkan saldo kredit.
 */
describe("FinanceInvoicePaymentStatusReader.findPaidAmounts", () => {
  const reader = new FinanceInvoicePaymentStatusReader();

  beforeEach(() => vi.clearAllMocks());

  it("membaca saldo kredit terpakai dari catatan invoice", async () => {
    finance.findRawById.mockResolvedValueOnce({
      status: "PAID",
      totalAmount: 61000n,
      taxAmount: 11000n,
      discountAmount: 50000n,
      notes: "Saldo kredit terpakai: Rp 50000",
    });

    expect(await reader.findPaidAmounts("invoice-1")).toEqual({
      totalAmount: 61000,
      taxAmount: 11000,
      saldoKreditUsed: 50000,
    });
  });

  it("diskon admin tanpa catatan saldo bukan saldo kredit", async () => {
    finance.findRawById.mockResolvedValueOnce({
      status: "PAID",
      totalAmount: 99900n,
      taxAmount: 9900n,
      discountAmount: 10000n,
      notes: null,
    });

    expect(await reader.findPaidAmounts("invoice-1")).toMatchObject({
      saldoKreditUsed: 0,
    });
  });

  it("null untuk invoice yang tidak lunas", async () => {
    finance.findRawById.mockResolvedValueOnce({
      status: "UNPAID",
      totalAmount: 111000n,
      taxAmount: 11000n,
      discountAmount: 0n,
    });

    expect(await reader.findPaidAmounts("invoice-1")).toBeNull();
  });
});
