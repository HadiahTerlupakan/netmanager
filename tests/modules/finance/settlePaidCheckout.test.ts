import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  restoreReleasedCoupons: vi.fn(),
  settleInvoices: vi.fn(),
  creditOverpaid: vi.fn(),
}));

vi.mock("@/modules/payment-gateway/services/abandoned-checkout", () => ({
  restoreReleasedCoupons: palsu.restoreReleasedCoupons,
}));
vi.mock("@/modules/finance", () => ({
  settleInvoicesOfReceivedPayments: palsu.settleInvoices,
  creditOverpaidPayments: palsu.creditOverpaid,
}));

import {
  settlePaidCheckout,
  type CheckoutPayment,
} from "@/modules/payment-gateway/services/webhook-checkout-settlement";

const CHECKOUT: CheckoutPayment[] = [
  {
    id: "pay-1",
    amount: 100000n,
    invoiceId: "inv-1",
    tenantId: "t1",
    couponUsageId: null,
    couponId: "kupon-1",
    pelangganId: "pel-1",
  },
];

/**
 * Satu jalur setelah gateway menyatakan checkout PAID, dipakai webhook dan
 * cek status gateway, supaya aturan pelunasan (tagihan batal, kelebihan
 * bayar) tidak bisa berbeda antarjalur.
 */
describe("settlePaidCheckout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checkout yang baru dipindah ke PAID: kupon dicatat ulang, invoice dilunasi, kelebihan dikreditkan", async () => {
    await settlePaidCheckout(CHECKOUT, { justMarkedPaid: true });

    expect(palsu.restoreReleasedCoupons).toHaveBeenCalledWith(CHECKOUT);
    expect(palsu.settleInvoices).toHaveBeenCalledWith(CHECKOUT);
    expect(palsu.creditOverpaid).toHaveBeenCalledWith(CHECKOUT);
    expect(
      palsu.restoreReleasedCoupons.mock.invocationCallOrder[0],
    ).toBeLessThan(palsu.settleInvoices.mock.invocationCallOrder[0]);
    expect(palsu.settleInvoices.mock.invocationCallOrder[0]).toBeLessThan(
      palsu.creditOverpaid.mock.invocationCallOrder[0],
    );
  });

  // Retry untuk payment yang sudah PAID: kupon sudah dicatat saat itu.
  it("checkout yang sudah PAID tidak mencatat ulang kupon", async () => {
    await settlePaidCheckout(CHECKOUT, { justMarkedPaid: false });

    expect(palsu.restoreReleasedCoupons).not.toHaveBeenCalled();
    expect(palsu.settleInvoices).toHaveBeenCalledWith(CHECKOUT);
    expect(palsu.creditOverpaid).toHaveBeenCalledWith(CHECKOUT);
  });
});
