import { describe, expect, it } from "vitest";

import { buildDuitkuWebhookResult } from "@/modules/payment-gateway/services/providers/duitku-provider-helpers";
import { buildDanaCreatePayload } from "@/modules/payment-gateway/services/providers/dana-provider-helpers";
import { TripayProvider } from "@/modules/payment-gateway/services/providers/tripay-provider";

describe("callback Duitku", () => {
  // resultCode "01" di callback berarti gagal; dulu dipetakan PENDING
  // karena pemetaannya dipakai bersama dengan cek status (di sana "01" =
  // diproses), sehingga pembayaran gagal menggantung selamanya.
  it.each([
    ["00", "PAID"],
    ["01", "FAILED"],
  ])("resultCode %s menjadi %s", (resultCode, status) => {
    expect(
      buildDuitkuWebhookResult({ merchantOrderId: "PAY-1", resultCode }).status,
    ).toBe(status);
  });
});

describe("URL DANA", () => {
  const { payload } = buildDanaCreatePayload(
    {
      orderId: "PAY-1",
      amount: 1000,
      customerName: "Budi",
      customerEmail: "b@example.com",
      customerPhone: "08",
      description: "Tagihan",
    } as never,
    "merchant-1",
  );

  it("mengirim callback ke rute webhook yang ada", () => {
    expect(payload.callbackUrl).toMatch(/\/api\/webhooks\/dana$/);
  });

  // /payment/success tidak pernah ada; pelanggan mendarat di 404.
  it("mengembalikan pelanggan ke halaman tagihan portal", () => {
    expect(payload.returnUrl).toBe("https://pelanggan.radpro.id/tagihan");
  });
});

describe("callback Tripay", () => {
  // total_amount sudah termasuk fee_customer; dulu dicocokkan langsung
  // dengan tagihan sehingga setiap pembayaran berbiaya pelanggan ditolak.
  it("nominal yang dicocokkan adalah tagihan, tanpa biaya pelanggan", async () => {
    const result = await new TripayProvider().processWebhook({
      merchant_ref: "PAY-1",
      reference: "T1",
      status: "PAID",
      total_amount: 104250,
      fee_customer: 4250,
    });

    expect(result.amount).toBe(100000);
  });
});
