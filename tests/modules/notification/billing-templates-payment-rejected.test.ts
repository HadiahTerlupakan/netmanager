import { describe, expect, it } from "vitest";
import { BILLING_TEMPLATES } from "@/modules/notification/templates/billing-templates";

const template = BILLING_TEMPLATES.paymentRejected;
const base = {
  customerName: "Budi",
  invoiceNumber: "INV/2026/10/28-AAA",
  amountDue: 100000,
};

/**
 * Dulu pelanggan hanya menerima push "Pembayaran Anda ditolak" tanpa alasan,
 * tidak lewat in-app, WhatsApp, atau email.
 */
describe("template bukti transfer ditolak", () => {
  it("menyebut tagihan, nominal, dan alasan admin di semua kanal", () => {
    const params = { ...base, rejectionReason: "Nominal tidak sesuai" };

    expect(template.inApp(params)).toBe(
      "Bukti transfer untuk tagihan INV/2026/10/28-AAA (Rp 100.000) ditolak: Nominal tidak sesuai. Silakan unggah ulang bukti yang benar atau pilih metode pembayaran lain.",
    );
    expect(template.whatsapp(params)).toContain("Alasan: Nominal tidak sesuai");
    expect(template.email(params).body).toContain(
      "Alasan: Nominal tidak sesuai",
    );
    expect(template.push(params)).toBe(
      "Bukti transfer untuk tagihan INV/2026/10/28-AAA (Rp 100.000) ditolak: Nominal tidak sesuai.",
    );
  });

  it("tanpa alasan tetap memberi tahu penolakannya", () => {
    expect(template.push(base)).toBe(
      "Bukti transfer untuk tagihan INV/2026/10/28-AAA (Rp 100.000) ditolak.",
    );
    expect(template.whatsapp(base)).not.toContain("Alasan");
  });
});
