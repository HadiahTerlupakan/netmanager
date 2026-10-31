import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock(
  "@/modules/payment-gateway/services/providers/fetch-with-timeout",
  () => ({ fetchWithTimeout: palsu.fetch }),
);

import { GatewayTransactionNotFoundError } from "@/modules/payment-gateway/services/provider-interface";
import { TripayProvider } from "@/modules/payment-gateway/services/providers/tripay-provider";

function tripay() {
  const provider = new TripayProvider();
  provider.initialize({
    apiKey: "kunci-uji",
    apiSecret: "rahasia-uji",
    merchantId: "T0001",
    isProduction: false,
  } as never);
  return provider;
}

const transaksi = (overrides: Record<string, unknown> = {}) => ({
  reference: "T0001000000000000006",
  merchant_ref: "PAY-1",
  payment_method: "BRIVA",
  amount: 100000,
  fee_customer: 0,
  status: "PAID",
  paid_at: 1761980000,
  ...overrides,
});

function daftarTransaksi(data: unknown[]) {
  palsu.fetch.mockResolvedValue({
    status: 200,
    json: async () => ({ success: true, message: "Success", data }),
  });
}

const urlPermintaan = () => new URL(String(palsu.fetch.mock.calls[0][0]));

/**
 * orderId kita dikirim ke Tripay sebagai merchant_ref. Cek status dulu
 * menanyakannya ke `transaction/detail?reference=`, yang hanya mengenal
 * reference milik Tripay (T…): setiap checkout Tripay terbaca "tidak
 * ditemukan", sehingga penyapu menutup checkout yang sudah dibayar.
 */
describe("cek status Tripay", () => {
  beforeEach(() => {
    palsu.fetch.mockReset();
  });

  it("mencari lewat daftar transaksi merchant dengan merchant_ref = orderId", async () => {
    daftarTransaksi([transaksi()]);

    const status = await tripay().checkStatus("PAY-1");

    expect({
      path: urlPermintaan().pathname,
      merchantRef: urlPermintaan().searchParams.get("merchant_ref"),
      reference: urlPermintaan().searchParams.get("reference"),
    }).toEqual({
      path: "/api-sandbox/merchant/transactions",
      merchantRef: "PAY-1",
      reference: null,
    });
    expect(status).toEqual({
      orderId: "PAY-1",
      status: "PAID",
      paidAt: new Date(1761980000 * 1000),
      paymentMethod: "BRIVA",
      amount: 100000,
      transactionId: "T0001000000000000006",
    });
  });

  it("transaksi yang belum dibayar terbaca menunggu", async () => {
    daftarTransaksi([transaksi({ status: "UNPAID", paid_at: null })]);

    await expect(tripay().checkStatus("PAY-1")).resolves.toMatchObject({
      status: "PENDING",
    });
  });

  it("paid_at berupa teks tetap dibaca sebagai detik", async () => {
    daftarTransaksi([transaksi({ paid_at: "1761980000" })]);

    await expect(tripay().checkStatus("PAY-1")).resolves.toMatchObject({
      paidAt: new Date(1761980000 * 1000),
    });
  });

  it.each([
    ["tidak ada transaksi", []],
    ["hanya merchant_ref lain", [transaksi({ merchant_ref: "PAY-10" })]],
  ])("%s: tidak ditemukan", async (_kasus, data) => {
    daftarTransaksi(data);

    await expect(tripay().checkStatus("PAY-1")).rejects.toBeInstanceOf(
      GatewayTransactionNotFoundError,
    );
  });

  it("orderId di-encode di URL", async () => {
    daftarTransaksi([transaksi({ merchant_ref: "PAY 1&status=PAID" })]);

    await tripay().checkStatus("PAY 1&status=PAID");

    expect(urlPermintaan().searchParams.get("merchant_ref")).toBe(
      "PAY 1&status=PAID",
    );
    expect(urlPermintaan().searchParams.get("status")).toBeNull();
  });
});
