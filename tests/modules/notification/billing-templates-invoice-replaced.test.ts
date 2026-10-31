import { describe, expect, it } from "vitest";
import { BILLING_TEMPLATES } from "@/modules/notification/templates/billing-templates";

// Produksi: pelanggan menerima "Tagihan baru dibuat ... Rp 22.200" lalu
// "Tagihan baru dibuat ... Rp 11.100" untuk siklus yang sama dalam semenit,
// tanpa keterangan bahwa tagihan pertama sudah diganti.
const params = {
  customerName: "Budi",
  invoiceNumber: "INV/2026/10/31-BBBBBBBBBBBB",
  amountDue: 22200,
  dueDate: "2026-10-31T17:00:00.000Z",
  replacesInvoiceNumber: "INV/2026/10/28-AAAAAAAAAAAA",
};

describe("billing templates tagihan pengganti", () => {
  it("perubahan paket: menyebut tagihan diperbarui dan nomor yang digantikan", () => {
    const template = BILLING_TEMPLATES.invoiceRepriced;

    expect(template.title).toBe("Tagihan diperbarui");
    expect(template.inApp(params)).toBe(
      "Tagihan jatuh tempo 1 Nov 2026 diperbarui ke Rp 22.200 mengikuti perubahan paket (menggantikan INV/2026/10/28-AAAAAAAAAAAA).",
    );
  });

  it("perubahan paket dibatalkan: menyebut tagihan dikembalikan", () => {
    const template = BILLING_TEMPLATES.invoiceRepriceReverted;

    expect(template.title).toBe("Tagihan diperbarui");
    expect(template.inApp({ ...params, amountDue: 11100 })).toBe(
      "Tagihan jatuh tempo 1 Nov 2026 dikembalikan ke Rp 11.100 karena perubahan paket dibatalkan (menggantikan INV/2026/10/28-AAAAAAAAAAAA).",
    );
  });

  it.each([
    ["invoiceRepriced", "mengikuti perubahan paket"],
    ["invoiceRepriceReverted", "perubahan paket dibatalkan"],
  ] as const)(
    "%s: WhatsApp dan email memberi nomor baru dan bahwa tagihan lama tidak berlaku",
    (key, reason) => {
      const template = BILLING_TEMPLATES[key];
      for (const text of [
        template.whatsapp(params),
        template.email(params).body,
      ]) {
        expect(text).toContain(reason);
        expect(text).toContain("INV/2026/10/31-BBBBBBBBBBBB");
        expect(text).toContain("INV/2026/10/28-AAAAAAAAAAAA");
        expect(text).toContain("tidak perlu dibayar");
        expect(text).toContain("1 Nov 2026");
        expect(text).not.toContain("Tagihan baru");
      }
      expect(template.push(params)).not.toContain("Tagihan baru");
    },
  );

  it("tagihan biasa tetap memakai kalimat tagihan baru", () => {
    expect(BILLING_TEMPLATES.invoiceCreated.title).toBe("Tagihan baru dibuat");
    expect(BILLING_TEMPLATES.invoiceCreated.inApp(params)).toBe(
      "Tagihan INV/2026/10/31-BBBBBBBBBBBB sebesar Rp 22.200 telah dibuat. Jatuh tempo 1 Nov 2026.",
    );
  });
});
