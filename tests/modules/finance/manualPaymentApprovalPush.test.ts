import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ push: vi.fn(), recompute: vi.fn() }));

vi.mock("@/modules/notification", () => ({
  sendCustomerPushNotification: palsu.push,
}));
vi.mock("@/modules/finance/services/InvoicePaymentStateService", () => ({
  InvoicePaymentStateService: class {
    recompute = palsu.recompute;
  },
}));

import { approveManualPayment } from "@/modules/finance/services/manual-payment-admin.helpers";

const PAYMENT = {
  id: "pay-1",
  invoiceId: "inv-1",
  notes: null as string | null,
  invoice: { pelangganId: "cust-1" },
};

/**
 * Persetujuan transfer manual dulu selalu mengirim push "Tagihan Anda telah
 * dilunasi" sendiri, padahal invoice yang lunas sudah diberitahukan lewat
 * INVOICE_PAID: pelanggan menerima dua push, dan pembayaran sebagian ikut
 * disebut lunas.
 */
describe("approveManualPayment — push ke pelanggan", () => {
  const repo = { updatePaymentById: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  it("tidak mengirim push sendiri bila invoice jadi lunas", async () => {
    palsu.recompute.mockResolvedValue({
      invoice: { status: "PAID" },
      becamePaid: true,
    });

    await approveManualPayment(repo, {} as never, PAYMENT as never);

    expect(palsu.push).not.toHaveBeenCalled();
  });

  it("pembayaran sebagian diberi tahu bahwa sisanya masih ditagih", async () => {
    palsu.recompute.mockResolvedValue({
      invoice: { status: "PARTIAL_PAID" },
      becamePaid: false,
    });

    await approveManualPayment(repo, {} as never, PAYMENT as never);

    expect(palsu.push).toHaveBeenCalledWith(
      "cust-1",
      "Pembayaran Diterima",
      expect.stringContaining("Sisa tagihan"),
      expect.objectContaining({ action: "APPROVE" }),
    );
  });
});
