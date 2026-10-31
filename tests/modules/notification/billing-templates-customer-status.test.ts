import { describe, expect, it } from "vitest";
import {
  BILLING_TEMPLATES,
  type BillingTemplate,
  type BillingTemplateKey,
} from "@/modules/notification/templates/billing-templates";

const params = { customerName: "Budi" };

const template = (key: BillingTemplateKey): BillingTemplate =>
  BILLING_TEMPLATES[key];

function semuaKanal(key: BillingTemplateKey, p = params) {
  const t = template(key);
  return [
    t.title,
    t.inApp(p),
    t.whatsapp(p),
    t.email(p).subject,
    t.email(p).body,
    t.push(p),
  ];
}

describe("template status layanan pelanggan", () => {
  it("isolir oleh admin tanpa tagihan tidak menyebut tunggakan atau pembayaran", () => {
    for (const teks of semuaKanal("customerIsolatedByAdmin")) {
      expect(teks).not.toMatch(/tunggakan|bayar|tagihan/i);
    }
    expect(template("customerIsolatedByAdmin").inApp(params)).toMatch(
      /admin/i,
    );
  });

  it("isolir karena tunggakan menyebut nomor dan sisa tagihan", () => {
    const tunggakan = {
      customerName: "Budi",
      invoiceNumber: "INV/2026/10/0001",
      amountDue: 150000,
    };
    for (const teks of [
      BILLING_TEMPLATES.customerIsolated.inApp(tunggakan),
      BILLING_TEMPLATES.customerIsolated.whatsapp(tunggakan),
      BILLING_TEMPLATES.customerIsolated.email(tunggakan).body,
    ]) {
      expect(teks).toMatch(/tunggakan/i);
      expect(teks).toContain("INV/2026/10/0001");
      expect(teks).toContain("Rp 150.000");
    }
  });

  it("aktif kembali tidak mengaku menerima pembayaran", () => {
    for (const teks of semuaKanal("customerActivated")) {
      expect(teks).not.toMatch(/bayar/i);
    }
  });

  it.each([
    ["customerDeactivated", /nonaktif/i],
    ["customerMaintenance", /pemeliharaan/i],
    ["customerDismantled", /berhenti berlangganan/i],
  ] as const)("%s menjelaskan statusnya di semua kanal", (key, pola) => {
    const t = template(key);
    expect(t.inApp(params)).toMatch(pola);
    expect(t.whatsapp(params)).toMatch(pola);
    expect(t.email(params).body).toMatch(pola);
    expect(t.whatsapp(params)).toContain("Budi");
  });

  it("dismantle memakai kalimat yang sama dengan pesan login", () => {
    expect(template("customerDismantled").inApp(params)).toContain(
      "Hubungi admin bila ini keliru.",
    );
  });
});
