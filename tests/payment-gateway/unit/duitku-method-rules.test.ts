import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aturan per kanal Duitku (docs.duitku.com/api/id, dibaca 2026-10-31):
 * - expiryPeriod maksimum: ShopeePay Apps (SA) dan QRIS 60 menit, QRIS Nobu
 *   (NQ), DANA, dan OVO 1440 menit; LinkAja Apps selalu 24 menit dan kartu
 *   kredit 30 menit, apa pun yang diminta.
 * - Ritel: FT = Pegadaian / ALFA / Pos, IR = Indomaret.
 *
 * Berasal dari probe audit pembayaran 2026-10-31: portal menghitung mundur
 * 24 jam untuk QRIS yang ditutup Duitku setelah satu jam, dan metode
 * "Alfamart / Indomaret" tidak bisa dibayar di Indomaret.
 */

const fake = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock(
  "@/modules/payment-gateway/services/providers/fetch-with-timeout",
  () => ({ fetchWithTimeout: fake.fetch }),
);

import { DuitkuProvider } from "@/modules/payment-gateway/services/providers/duitku-provider";
import {
  findPaymentMethodByCode,
  getCustomerPaymentMethodsByProvider,
} from "@/modules/payment-gateway/services/payment-method-catalog";

function provider() {
  const instance = new DuitkuProvider();
  instance.initialize({
    apiKey: "audit-key",
    merchantId: "DAUDIT",
    isProduction: false,
  } as never);
  return instance;
}

async function requestFor(paymentMethod: string, expiryHours?: number) {
  const startedAt = Date.now();
  const result = await provider().createPayment({
    orderId: `PAY-AUDIT-${paymentMethod}`,
    amount: 11100,
    customerName: "Pelanggan Audit",
    customerEmail: "audit@example.com",
    customerPhone: "081200000000",
    description: "Pembayaran Tagihan NetManager",
    paymentMethods: [paymentMethod],
    expiryHours,
  } as never);
  const [, init] = fake.fetch.mock.calls[0] as [string, { body: string }];
  return {
    sentExpiryPeriod: (JSON.parse(init.body) as { expiryPeriod: number })
      .expiryPeriod,
    portalCountdownMinutes: Math.round(
      ((result.expiresAt?.getTime() ?? 0) - startedAt) / 60000,
    ),
  };
}

describe("aturan per kanal Duitku", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.fetch.mockResolvedValue({
      status: 200,
      text: async () =>
        JSON.stringify({ statusCode: "00", reference: "D1", qrString: "x" }),
    });
  });

  it.each([
    ["SA", 60],
    ["SP", 60],
    ["NQ", 1440],
    ["DA", 1440],
    ["OV", 1440],
    ["BC", 1440],
    ["FT", 1440],
    ["IR", 1440],
  ])(
    "%s: expiryPeriod yang dikirim sama dengan expiresAt yang disimpan (%i menit)",
    async (paymentMethod, minutes) => {
      await expect(requestFor(paymentMethod)).resolves.toEqual({
        sentExpiryPeriod: minutes,
        portalCountdownMinutes: minutes,
      });
    },
  );

  // Duitku memakai masa berlaku bawaan kanal ini dan mengabaikan permintaan;
  // yang disimpan harus yang benar-benar dipakai Duitku.
  it.each([
    ["LA", 24],
    ["VC", 30],
  ])("%s: masa berlaku tetap %i menit", async (paymentMethod, minutes) => {
    await expect(requestFor(paymentMethod, 48)).resolves.toEqual({
      sentExpiryPeriod: minutes,
      portalCountdownMinutes: minutes,
    });
  });

  it("permintaan masa berlaku lebih panjang dipotong di batas kanal", async () => {
    await expect(requestFor("SP", 3)).resolves.toEqual({
      sentExpiryPeriod: 60,
      portalCountdownMinutes: 60,
    });
  });

  it("FT tidak menjanjikan Indomaret, dan Indomaret punya kanal IR sendiri", () => {
    const duitkuCodes = getCustomerPaymentMethodsByProvider("DUITKU").map(
      (method) => method.code,
    );

    expect({
      ftLabel: findPaymentMethodByCode("FT")?.name,
      irLabel: findPaymentMethodByCode("IR")?.name,
      offersIndomaretChannelIR: duitkuCodes.includes("IR"),
    }).toEqual({
      ftLabel: "Alfamart / Pegadaian / Pos",
      irLabel: "Indomaret",
      offersIndomaretChannelIR: true,
    });
  });
});
