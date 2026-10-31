import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock(
  "@/modules/payment-gateway/services/providers/fetch-with-timeout",
  () => ({ fetchWithTimeout: palsu.fetch }),
);

import { GatewayTransactionNotFoundError } from "@/modules/payment-gateway/services/provider-interface";
import { DANAProvider } from "@/modules/payment-gateway/services/providers/dana-provider";
import { MidtransProvider } from "@/modules/payment-gateway/services/providers/midtrans-provider";
import { TripayProvider } from "@/modules/payment-gateway/services/providers/tripay-provider";
import { XenditProvider } from "@/modules/payment-gateway/services/providers/xendit-provider";

const CONFIG = {
  apiKey: "kunci-uji",
  apiSecret: "rahasia-uji",
  merchantId: "M1",
  isProduction: false,
};

function initialized<T extends { initialize(config: never): unknown }>(
  provider: T,
) {
  provider.initialize(CONFIG as never);
  return provider;
}

const failure = (provider: { checkStatus(id: string): Promise<unknown> }) =>
  provider.checkStatus("PAY-1").catch((error: Error) => error);

/**
 * Penyapu checkout hanya menutup checkout yang menurut gateway belum dibayar.
 * "Order tidak dikenal" adalah jawaban seperti itu; galat lain (kunci salah,
 * gateway mati) tidak, dan checkout-nya dibiarkan untuk putaran berikutnya.
 */
describe("order yang tidak dikenal gateway", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    palsu.fetch.mockReset();
  });

  it("Xendit: tanpa invoice untuk external id ini", async () => {
    const provider = initialized(new XenditProvider());
    vi.spyOn(
      provider as unknown as { getInvoiceApi: () => Promise<unknown> },
      "getInvoiceApi",
    ).mockResolvedValue({ getInvoices: async (): Promise<unknown[]> => [] });

    expect(await failure(provider)).toBeInstanceOf(
      GatewayTransactionNotFoundError,
    );
  });

  it.each([
    ["404", true],
    ["500", false],
  ])(
    "Midtrans: status_code %s dari Core API → tidak ditemukan=%s",
    async (statusCode, isNotFound) => {
      const provider = initialized(new MidtransProvider());
      vi.spyOn(
        provider as unknown as { getCoreTransactionApi: () => unknown },
        "getCoreTransactionApi",
      ).mockReturnValue({
        status: async () => {
          throw Object.assign(
            new Error("Midtrans API is returning API error"),
            {
              httpStatusCode: statusCode,
            },
          );
        },
      });

      const error = await failure(provider);
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof GatewayTransactionNotFoundError).toBe(isNotFound);
    },
  );

  it.each([
    [404, { success: false, message: "Transaction not found" }, true],
    [401, { success: false, message: "Invalid API key" }, false],
  ])(
    "Tripay: HTTP %i %j → tidak ditemukan=%s",
    async (status, body, isNotFound) => {
      palsu.fetch.mockResolvedValue({ status, json: async () => body });

      const error = await failure(initialized(new TripayProvider()));
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof GatewayTransactionNotFoundError).toBe(isNotFound);
    },
  );

  it.each([
    [404, true],
    [500, false],
  ])("DANA: HTTP %i → tidak ditemukan=%s", async (status, isNotFound) => {
    palsu.fetch.mockResolvedValue({
      status,
      ok: false,
      json: async () => ({ resultInfo: { resultStatus: "F" } }),
    });

    const error = await failure(initialized(new DANAProvider()));
    expect(error).toBeInstanceOf(Error);
    expect(error instanceof GatewayTransactionNotFoundError).toBe(isNotFound);
  });
});
