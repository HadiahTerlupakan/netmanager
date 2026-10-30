import { describe, expect, it } from "vitest";
import { BILLING_TEMPLATES } from "@/modules/notification/templates/billing-templates";

const params = {
  customerName: "Budi",
  invoiceNumber: "INV/2026/10/30-A47FC1A7D3F4",
  amountDue: 11100,
};

describe("template kelebihan bayar", () => {
  it.each([
    ["in-app", BILLING_TEMPLATES.overpaymentCredited.inApp(params)],
    ["WhatsApp", BILLING_TEMPLATES.overpaymentCredited.whatsapp(params)],
    ["email", BILLING_TEMPLATES.overpaymentCredited.email(params).body],
  ])(
    "pesan %s menyebut nominal dan bahwa uangnya menjadi saldo",
    (_kanal, teks) => {
      expect(teks).toContain("Rp 11.100");
      expect(teks).toMatch(/saldo/i);
      expect(teks).toMatch(/tagihan berikutnya/i);
    },
  );
});
