import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  recompute: vi.fn(),
  redirect: vi.fn(),
  credit: vi.fn(),
  konteks: [] as unknown[],
}));

// Setup global me-mock tenant-context; tes ini justru tentang konteksnya.
vi.mock("@/lib/tenant-context", async (importOriginal) => importOriginal());

vi.mock("@/modules/finance/services/InvoicePaymentStateService", () => ({
  InvoicePaymentStateService: class {
    recompute = palsu.recompute;
  },
}));
vi.mock("@/modules/finance/services/cancelled-invoice-payments", () => ({
  redirectPaymentsOfCancelledInvoice: palsu.redirect,
}));
vi.mock("@/modules/finance/services/overpayment-credit", () => ({
  creditOverpaidPayments: palsu.credit,
}));

import { getTenantIdFromContext } from "@/lib/tenant-context";
import { settleReceivedPayments } from "@/modules/finance/services/received-payment-settlement";

const payment = (id: string, invoiceId: string, tenantId: string | null) => ({
  id,
  amount: 1n,
  invoiceId,
  tenantId,
  pelangganId: "pel-1",
});

/**
 * Webhook datang tanpa konteks tenant; recompute membaca invoice lewat klien
 * billing yang fail-closed tanpa tenant, jadi konteksnya harus dari payment.
 * Tagihan yang ternyata sudah dibatalkan tidak dihitung ulang menjadi lunas:
 * uangnya dialihkan.
 */
describe("settleReceivedPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.konteks = [];
    palsu.recompute.mockImplementation(async (invoiceId: string) => {
      palsu.konteks.push(await getTenantIdFromContext());
      return { invoice: { id: invoiceId, status: "PAID" } };
    });
  });

  it("menghitung ulang tiap invoice sekali, dalam konteks tenant payment", async () => {
    const payments = [
      payment("p1", "inv-1", "t1"),
      payment("p2", "inv-1", "t1"),
      payment("p3", "inv-2", "t1"),
    ];

    await settleReceivedPayments(payments);

    expect(palsu.recompute.mock.calls).toEqual([["inv-1"], ["inv-2"]]);
    expect(palsu.konteks).toEqual([
      expect.objectContaining({ tenantId: "t1", isSuperAdmin: false }),
      expect.objectContaining({ tenantId: "t1", isSuperAdmin: false }),
    ]);
    expect(palsu.redirect).not.toHaveBeenCalled();
    expect(palsu.credit).toHaveBeenCalledWith(payments);
  });

  it("mengalihkan uang tagihan yang sudah dibatalkan, bukan melunasinya", async () => {
    palsu.recompute.mockResolvedValueOnce({
      invoice: { id: "inv-batal", status: "CANCELLED" },
    });
    const payments = [payment("p1", "inv-batal", "t1")];

    await settleReceivedPayments(payments);

    expect(palsu.redirect).toHaveBeenCalledWith("inv-batal", payments);
    expect(palsu.redirect.mock.invocationCallOrder[0]).toBeLessThan(
      palsu.credit.mock.invocationCallOrder[0],
    );
  });

  it("payment tanpa tenant dilunasi dalam konteks sistem", async () => {
    await settleReceivedPayments([payment("p1", "inv-1", null)]);

    expect(palsu.konteks).toEqual([
      expect.objectContaining({ isSuperAdmin: true }),
    ]);
  });
});
