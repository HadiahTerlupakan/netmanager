import { describe, expect, it } from "vitest";
import { createRouteServiceError } from "@/lib/api/route-service-error";
import {
  describeInvoiceActionFailure,
  describeKeptInvoices,
} from "@/modules/pelanggan/services/invoice-action-outcome";

describe("hasil aksi tagihan di respons simpan pelanggan", () => {
  it("semua tagihan diganti: tidak ada pesan", () => {
    expect(describeKeptInvoices([])).toEqual({});
  });

  it("tagihan yang tidak dibatalkan disebut beserta akibatnya", () => {
    expect(
      describeKeptInvoices([
        { message: "Tagihan INV/1 tidak dibatalkan karena A." },
        { message: "Tagihan INV/2 tidak dibatalkan karena B." },
      ]),
    ).toEqual({
      invoiceActionMessage:
        "Tagihan INV/1 tidak dibatalkan karena A. Tagihan INV/2 tidak dibatalkan karena B. Tagihan baru tidak dibuat; ulangi setelah pembayarannya selesai atau kedaluwarsa.",
    });
  });

  // Kunci checkout dipegang pelanggan yang sedang membuat pembayaran.
  it("kunci checkout yang sibuk dijelaskan sebagai pelanggan sedang membayar", () => {
    expect(
      describeInvoiceActionFailure(createRouteServiceError("sibuk", 409)),
    ).toEqual({
      invoiceActionFailed: true,
      invoiceActionMessage:
        "Data pelanggan tersimpan, tetapi tagihan tidak diganti karena pelanggan sedang membuat pembayaran. Coba lagi sebentar lagi.",
    });
  });

  it("galat lain tetap ditandai gagal", () => {
    expect(describeInvoiceActionFailure(new Error("db down"))).toMatchObject({
      invoiceActionFailed: true,
      invoiceActionMessage: expect.stringContaining("gagal dibuat"),
    });
  });
});
