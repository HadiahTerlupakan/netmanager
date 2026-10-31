import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  onPaymentReviewRequired: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onPaymentReviewRequired: palsu.onPaymentReviewRequired,
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: palsu.error, warn: vi.fn(), info: vi.fn() },
}));

import { flagPaymentForReview } from "@/modules/payment-gateway/services/payment-review";

const MISMATCH = {
  provider: "DUITKU",
  orderId: "PAY-1",
  paymentId: "pay-1",
  tenantId: "t1",
  reason: "AMOUNT_MISMATCH" as const,
  expected: "100000",
  received: "60000",
};

describe("flagPaymentForReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencatat error dan meneruskan ke staf keuangan", async () => {
    await flagPaymentForReview(MISMATCH);

    expect(palsu.error).toHaveBeenCalledWith(
      expect.stringContaining("AMOUNT_MISMATCH pada DUITKU PAY-1"),
    );
    expect(palsu.onPaymentReviewRequired).toHaveBeenCalledWith(MISMATCH);
  });

  it("payment tanpa tenant dikirim tanpa tenantId", async () => {
    await flagPaymentForReview({ ...MISMATCH, tenantId: null });

    expect(palsu.onPaymentReviewRequired).toHaveBeenCalledWith({
      ...MISMATCH,
      tenantId: undefined,
    });
  });

  // Callback tetap harus dijawab 200 walau pemberitahuannya gagal.
  it("pemberitahuan yang gagal tidak menggagalkan pemanggilnya", async () => {
    palsu.onPaymentReviewRequired.mockRejectedValue(new Error("redis mati"));

    await expect(flagPaymentForReview(MISMATCH)).resolves.toBeUndefined();
  });
});
