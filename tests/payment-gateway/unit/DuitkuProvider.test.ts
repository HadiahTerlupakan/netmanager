import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock(
  "@/modules/payment-gateway/services/providers/fetch-with-timeout",
  () => ({ fetchWithTimeout: palsu.fetch }),
);

import { DuitkuProvider } from "@/modules/payment-gateway/services/providers/duitku-provider";

const CONFIG = {
  apiKey: "kunci-uji",
  merchantId: "DS123",
  isProduction: false,
};
const hmac = (s: string) =>
  crypto.createHmac("sha256", CONFIG.apiKey).update(s).digest("hex");

function provider() {
  const p = new DuitkuProvider();
  p.initialize(CONFIG as never);
  return p;
}

/**
 * Menurut docs.duitku.com/api/en: transaksi dibuat lewat
 * webapi/.../merchant/v2/inquiry dan semua tanda tangan HMAC-SHA256 berkunci
 * API Key (MD5 usang sejak April 2026). Kode lama memanggil createinvoice di
 * webapi dan menandatangani dengan MD5.
 */
describe("DuitkuProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.fetch.mockResolvedValue({
      status: 200,
      text: async () =>
        JSON.stringify({
          statusCode: "00",
          paymentUrl: "https://sandbox.duitku.com/pay/1",
          reference: "D1",
        }),
    });
  });

  it("membuat transaksi lewat v2/inquiry dengan tanda tangan HMAC", async () => {
    const result = await provider().createPayment({
      orderId: "PAY-1",
      amount: 100000,
      customerName: "Pelanggan Dengan Nama Sangat Panjang",
      customerEmail: "a@b.c",
      customerPhone: "08",
      description: "Tagihan",
      paymentMethods: ["BC"],
    } as never);

    const [url, init] = palsu.fetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(url).toBe(
      "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry",
    );
    expect(body.signature).toBe(hmac("DS123PAY-1100000"));
    expect(body.customerVaName.length).toBeLessThanOrEqual(20);
    expect(result).toMatchObject({ success: true, transactionId: "D1" });
  });

  // Penolakan Duitku dulu tercatat "Failed to create payment" saja karena
  // hanya statusMessage yang dibaca.
  it.each([
    [
      JSON.stringify({ Message: "Minimum Payment 10000 IDR" }),
      "Minimum Payment 10000 IDR",
    ],
    ["Merchant not found", "Merchant not found"],
  ])("meneruskan alasan penolakan Duitku (%s)", async (body, reason) => {
    palsu.fetch.mockResolvedValue({ status: 400, text: async () => body });

    const result = await provider().createPayment({
      orderId: "PAY-1",
      amount: 1110,
      customerName: "Budi",
      customerEmail: "a@b.c",
      customerPhone: "08",
      description: "Tagihan",
      paymentMethods: ["BC"],
    } as never);

    expect(result.success).toBe(false);
    expect(result.error).toContain(reason);
    expect(result.error).toContain("400");
  });

  describe("callback", () => {
    const callback = (signature: string) => ({
      merchantCode: "DS123",
      amount: "100000",
      merchantOrderId: "PAY-1",
      resultCode: "00",
      signature,
    });

    it("menerima tanda tangan HMAC-SHA256", () => {
      expect(provider().verifyWebhook(callback(hmac("DS123100000PAY-1")))).toBe(
        true,
      );
    });

    it("masih menerima tanda tangan MD5 lama", () => {
      const md5 = crypto
        .createHash("md5")
        .update(`DS123100000PAY-1${CONFIG.apiKey}`)
        .digest("hex");
      expect(provider().verifyWebhook(callback(md5))).toBe(true);
    });

    it("menolak tanda tangan yang salah", () => {
      expect(provider().verifyWebhook(callback(hmac("DS123999PAY-1")))).toBe(
        false,
      );
    });
  });
});
