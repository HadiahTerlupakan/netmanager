import { describe, expect, it } from "vitest";
import { BILLING_TEMPLATES } from "@/modules/notification/templates/billing-templates";

/**
 * Notifikasi tagihan dulu tidak menyebut saldo kredit sama sekali: tagihan
 * yang dipotong saldo terbaca seolah nominal penuh, tagihan yang lunas dengan
 * saldo terbaca "Pembayaran Rp 0 berhasil", dan notifikasi lunas menyebut
 * total tagihan walau sebagiannya ditutup kupon.
 */
describe("template tagihan dengan saldo kredit dan kupon", () => {
  it("tagihan baru yang dipotong saldo menyebut saldo terpakai dan sisa yang dibayar", () => {
    const params = {
      customerName: "Budi",
      invoiceNumber: "INV/1",
      amountDue: 61000,
      grossAmount: 111000,
      creditApplied: 50000,
    };

    expect(BILLING_TEMPLATES.invoiceCreated.inApp(params)).toBe(
      "Tagihan INV/1 sebesar Rp 111.000 telah dibuat. Saldo kredit Rp 50.000 terpakai, sisa yang perlu dibayar Rp 61.000.",
    );
    expect(BILLING_TEMPLATES.invoiceCreated.whatsapp(params)).toContain(
      "Saldo kredit terpakai: Rp 50.000\nSisa yang perlu dibayar: Rp 61.000",
    );
    expect(BILLING_TEMPLATES.invoiceCreated.push(params)).toBe(
      "Tagihan INV/1: Rp 61.000 setelah saldo kredit Rp 50.000",
    );
  });

  it("tagihan baru tanpa saldo tetap memakai kalimat lama", () => {
    expect(
      BILLING_TEMPLATES.invoiceCreated.inApp({
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 111000,
      }),
    ).toBe("Tagihan INV/1 sebesar Rp 111.000 telah dibuat.");
  });

  it("pelunasan menyebut uang yang dibayar serta kupon dan saldo yang ikut melunasi", () => {
    const params = {
      customerName: "Budi",
      invoiceNumber: "INV/1",
      amountDue: 95000,
      amountPaid: 85000,
      couponDiscount: 10000,
      saldoUsed: 5000,
    };

    expect(BILLING_TEMPLATES.invoicePaid.inApp(params)).toBe(
      "Pembayaran INV/1 sebesar Rp 85.000 berhasil. Potongan kupon Rp 10.000 dan saldo kredit Rp 5.000 ikut melunasi tagihan ini. Terima kasih.",
    );
    expect(BILLING_TEMPLATES.invoicePaid.email(params).body).toContain(
      "sebesar Rp 85.000 telah diterima",
    );
  });

  // Event INVOICE_PAID yang terbit sebelum rincian ini ada di payload.
  it("event lama tanpa rincian tetap menyebut nominal tagihan", () => {
    expect(
      BILLING_TEMPLATES.invoicePaid.inApp({
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      }),
    ).toBe("Pembayaran INV/1 sebesar Rp 100.000 berhasil. Terima kasih.");
  });

  it("tagihan yang lunas dengan saldo berkata 'dibayar dengan saldo', bukan Rp 0", () => {
    const params = {
      customerName: "Budi",
      invoiceNumber: "INV/1",
      amountDue: 0,
      amountPaid: 0,
      saldoUsed: 111000,
    };
    const template = BILLING_TEMPLATES.invoicePaidWithSaldo;

    expect(template.title).toBe("Tagihan dibayar dengan saldo");
    expect(template.inApp(params)).toBe(
      "Tagihan INV/1 sebesar Rp 111.000 lunas dibayar dengan saldo kredit. Tidak ada yang perlu dibayar.",
    );
    expect(template.push(params)).toBe(
      "Tagihan INV/1 dibayar dengan saldo kredit",
    );
    expect(template.whatsapp(params)).not.toContain("Rp 0");
  });
});
