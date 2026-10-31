import { describe, expect, it } from "vitest";
import { BILLING_TEMPLATES } from "@/modules/notification/templates/billing-templates";

const template = BILLING_TEMPLATES.paymentRedirected;
const base = {
  customerName: "Budi",
  invoiceNumber: "INV/2026/10/28-LAMA",
  amountDue: 100000,
};

/**
 * Uang yang datang untuk tagihan yang sudah dibatalkan: tanpa kabar ini
 * pelanggan melihat tagihan barunya lunas atau saldonya bertambah tanpa tahu
 * dari mana.
 */
describe("template pembayaran dialihkan", () => {
  it("menyebut tagihan pengganti dan sisa yang menjadi saldo", () => {
    const params = {
      ...base,
      replacementInvoiceNumber: "INV/2026/10/31-BARU",
      appliedAmount: 60000,
      creditedAmount: 40000,
    };

    expect(template.inApp(params)).toBe(
      "Pembayaran Rp 100.000 untuk tagihan INV/2026/10/28-LAMA yang sudah dibatalkan kami pakai untuk tagihan pengganti INV/2026/10/31-BARU (Rp 60.000). Sisa Rp 40.000 disimpan sebagai saldo kredit dan otomatis memotong tagihan berikutnya.",
    );
    expect(template.whatsapp(params)).toContain("dikembalikan");
    expect(template.push(params)).toBe(
      "Pembayaran Rp 100.000 dipakai untuk tagihan INV/2026/10/31-BARU",
    );
  });

  it("tanpa sisa tidak menyebut saldo", () => {
    const params = {
      ...base,
      replacementInvoiceNumber: "INV/2026/10/31-BARU",
      appliedAmount: 100000,
      creditedAmount: 0,
    };

    expect(template.inApp(params)).not.toMatch(/saldo/i);
    expect(template.email(params).body).not.toMatch(/saldo/i);
  });

  it("tanpa tagihan pengganti seluruhnya menjadi saldo kredit", () => {
    const params = { ...base, appliedAmount: 0, creditedAmount: 100000 };

    expect(template.inApp(params)).toBe(
      "Pembayaran Rp 100.000 untuk tagihan INV/2026/10/28-LAMA yang sudah dibatalkan kami simpan sebagai saldo kredit dan otomatis memotong tagihan berikutnya.",
    );
    expect(template.push(params)).toBe(
      "Pembayaran Rp 100.000 disimpan sebagai saldo kredit",
    );
  });
});
