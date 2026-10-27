import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  recompute: vi.fn(),
  konteks: [] as unknown[],
}));

// Setup global me-mock tenant-context; tes ini justru tentang konteksnya.
vi.mock("@/lib/tenant-context", async (importOriginal) => importOriginal());

vi.mock("@/modules/finance", () => ({
  recomputeInvoicePaymentState: palsu.recompute,
}));

import { getTenantIdFromContext } from "@/lib/tenant-context";
import { settleCheckoutInvoices } from "@/modules/payment-gateway/services/webhook-checkout-settlement";

/**
 * Webhook datang tanpa konteks tenant; recompute membaca invoice lewat klien
 * billing yang fail-closed tanpa tenant, jadi konteksnya harus dari payment.
 */
describe("settleCheckoutInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.konteks = [];
    palsu.recompute.mockImplementation(async () => {
      palsu.konteks.push(await getTenantIdFromContext());
    });
  });

  it("menghitung ulang tiap invoice sekali, dalam konteks tenant payment", async () => {
    await settleCheckoutInvoices([
      {
        id: "p1",
        amount: 1n,
        invoiceId: "inv-1",
        tenantId: "t1",
        couponUsageId: null,
        couponId: null,
        pelangganId: "pel-1",
      },
      {
        id: "p2",
        amount: 1n,
        invoiceId: "inv-1",
        tenantId: "t1",
        couponUsageId: null,
        couponId: null,
        pelangganId: "pel-1",
      },
      {
        id: "p3",
        amount: 1n,
        invoiceId: "inv-2",
        tenantId: "t1",
        couponUsageId: null,
        couponId: null,
        pelangganId: "pel-1",
      },
    ]);

    expect(palsu.recompute.mock.calls).toEqual([["inv-1"], ["inv-2"]]);
    expect(palsu.konteks).toEqual([
      expect.objectContaining({ tenantId: "t1", isSuperAdmin: false }),
      expect.objectContaining({ tenantId: "t1", isSuperAdmin: false }),
    ]);
  });
});
