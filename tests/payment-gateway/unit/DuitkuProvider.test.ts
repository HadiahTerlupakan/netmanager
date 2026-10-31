import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock(
  "@/modules/payment-gateway/services/providers/fetch-with-timeout",
  () => ({ fetchWithTimeout: palsu.fetch }),
);

import { DuitkuProvider } from "@/modules/payment-gateway/services/providers/duitku-provider";
import { GatewayTransactionNotFoundError } from "@/modules/payment-gateway/services/provider-interface";

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

  // Sandbox menolak HMAC dengan "Wrong signature" untuk merchant yang belum
  // dipindahkan Duitku (2026-10-27); MD5 lama harus dicoba sesudahnya.
  // Respons nyata sandbox 2026-10-28: QRIS (SP) membawa qrString, VA
  // membawa vaNumber; portal menggambar keduanya sendiri.
  it("meneruskan qrString dan vaNumber dari Duitku", async () => {
    palsu.fetch.mockResolvedValue({
      status: 200,
      text: async () =>
        JSON.stringify({
          statusCode: "00",
          paymentUrl: "https://sandbox.duitku.com/pay/1",
          reference: "D1",
          qrString: "00020101021226610016ID.CO.SHOPEE.WWW",
          vaNumber: "7007014001179806",
        }),
    });

    const result = await provider().createPayment({
      orderId: "PAY-1",
      amount: 11100,
      customerName: "Uji",
      customerEmail: "a@b.c",
      customerPhone: "08",
      description: "Tagihan",
      paymentMethods: ["SP"],
    } as never);

    expect(result).toMatchObject({
      qrString: "00020101021226610016ID.CO.SHOPEE.WWW",
      vaNumber: "7007014001179806",
    });
  });

  it("mengulang dengan tanda tangan MD5 bila HMAC ditolak", async () => {
    palsu.fetch.mockResolvedValueOnce({
      status: 401,
      text: async () => JSON.stringify({ Message: "Wrong signature" }),
    });

    const result = await provider().createPayment({
      orderId: "PAY-1",
      amount: 100000,
      customerName: "Uji",
      customerEmail: "a@b.c",
      customerPhone: "08",
      description: "Tagihan",
      paymentMethods: ["BC"],
    } as never);

    const signatures = palsu.fetch.mock.calls.map(
      ([, init]) => JSON.parse((init as { body: string }).body).signature,
    );
    expect(signatures).toEqual([
      hmac("DS123PAY-1100000"),
      crypto
        .createHash("md5")
        .update(`DS123PAY-1100000${CONFIG.apiKey}`)
        .digest("hex"),
    ]);
    expect(result).toMatchObject({ success: true, transactionId: "D1" });
  });

  // Respons nyata sandbox 2026-10-28: kredensial benar dijawab 404
  // "Transaction not found" untuk order uji; dulu itu dilaporkan "Respon
  // tidak valid", sementara "Wrong signature" justru dianggap berhasil.
  it.each([
    [404, { Message: "Transaction not found" }, true],
    [401, { Message: "Wrong signature" }, false],
    [404, { Message: "Merchant not found" }, false],
  ])("tes koneksi HTTP %i %j → berhasil=%s", async (status, body, ok) => {
    palsu.fetch.mockResolvedValue({
      status,
      text: async () => JSON.stringify(body),
    });

    const result = await provider().testConnection();

    expect(result.success).toBe(ok);
    if (!ok) expect(result.message).toContain(body.Message);
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

  it("mengembalikan pelanggan ke returnUrl yang diminta, bila ada", async () => {
    await provider().createPayment({
      orderId: "PAY-1",
      amount: 100000,
      customerName: "Uji",
      customerEmail: "a@b.c",
      customerPhone: "08",
      description: "Tagihan",
      paymentMethods: ["SA"],
      returnUrl: "https://pelanggan.radpro.id/pembayaran/kembali?ke=app",
    } as never);

    const [, init] = palsu.fetch.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body).returnUrl).toBe(
      "https://pelanggan.radpro.id/pembayaran/kembali?ke=app",
    );
  });

  // Percobaan MD5 sesudah HMAC ditolak dulu mendapat 30 detik sendiri, jadi
  // satu panggilan bisa memakan 60 detik di dalam kunci checkout 120 detik.
  it("percobaan ulang tanda tangan memakai sisa batas waktu yang sama", async () => {
    vi.useFakeTimers();
    try {
      palsu.fetch.mockImplementationOnce(async () => {
        // HMAC ditolak setelah tujuh detik.
        vi.advanceTimersByTime(7_000);
        return {
          status: 401,
          text: async () => JSON.stringify({ Message: "Wrong signature" }),
        };
      });

      await provider().checkStatus("PAY-1", { timeoutMs: 10_000 });
    } finally {
      vi.useRealTimers();
    }

    const timeouts = palsu.fetch.mock.calls.map(
      ([, init]) => (init as { timeoutMs: number }).timeoutMs,
    );
    expect(timeouts).toEqual([10_000, 3_000]);
  });

  describe("cek status", () => {
    it("lunas membawa nominal dan biaya sebagai angka", async () => {
      palsu.fetch.mockResolvedValue({
        status: 200,
        text: async () =>
          JSON.stringify({
            merchantOrderId: "PAY-1",
            reference: "D1",
            amount: "100000",
            fee: "4000",
            statusCode: "00",
          }),
      });

      await expect(provider().checkStatus("PAY-1")).resolves.toMatchObject({
        status: "PAID",
        amount: 100000,
        fee: 4000,
        transactionId: "D1",
      });
    });

    it.each([
      ["01", "PENDING"],
      ["02", "EXPIRED"],
    ])("statusCode %s menjadi %s", async (statusCode, status) => {
      palsu.fetch.mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ statusCode }),
      });

      await expect(provider().checkStatus("PAY-1")).resolves.toMatchObject({
        status,
      });
    });

    // Jawaban tanpa status yang dikenal dulu dianggap FAILED, sehingga
    // penyapu bisa menutup checkout yang sebenarnya sudah dibayar.
    it("order yang tidak dikenal Duitku dilaporkan sebagai tidak ditemukan", async () => {
      palsu.fetch.mockResolvedValue({
        status: 404,
        text: async () => JSON.stringify({ Message: "Transaction not found" }),
      });

      await expect(provider().checkStatus("PAY-2")).rejects.toBeInstanceOf(
        GatewayTransactionNotFoundError,
      );
    });

    it.each([
      [401, { Message: "Merchant not found" }],
      [500, { Message: "Internal Server Error" }],
      [200, { statusCode: "99" }],
    ])("jawaban HTTP %i %j bukan status pembayaran", async (status, body) => {
      palsu.fetch.mockResolvedValue({
        status,
        text: async () => JSON.stringify(body),
      });

      const error = await provider()
        .checkStatus("PAY-1")
        .catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(GatewayTransactionNotFoundError);
    });
  });

  describe("kanal aktif (getpaymentmethod)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // 31 Okt 2026 22:30:15 WIB.
      vi.setSystemTime(new Date("2026-10-31T15:30:15.000Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("mengirim nominal dan waktu WIB bertanda tangan HMAC, lalu membaca kodenya", async () => {
      palsu.fetch.mockResolvedValue({
        status: 200,
        text: async () =>
          JSON.stringify({
            paymentFee: [
              { paymentMethod: "BC", paymentName: "BCA VA", totalFee: "4000" },
              { paymentMethod: "SP", paymentName: "QRIS", totalFee: "0" },
            ],
            responseCode: "00",
            responseMessage: "SUCCESS",
          }),
      });

      const codes = await provider().getActivePaymentMethods(11100);

      const [url, init] = palsu.fetch.mock.calls[0] as [
        string,
        { body: string },
      ];
      expect(url).toBe(
        "https://sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod",
      );
      expect(JSON.parse(init.body)).toEqual({
        merchantcode: "DS123",
        amount: 11100,
        datetime: "2026-10-31 22:30:15",
        signature: hmac("DS12311100" + "2026-10-31 22:30:15"),
      });
      expect(codes).toEqual(["BC", "SP"]);
    });

    it("jawaban selain sukses tidak dianggap daftar kanal kosong", async () => {
      palsu.fetch.mockResolvedValue({
        status: 401,
        text: async () => JSON.stringify({ Message: "Merchant not found" }),
      });

      await expect(provider().getActivePaymentMethods(11100)).rejects.toThrow(
        /Merchant not found/,
      );
    });
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
