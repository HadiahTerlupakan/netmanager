import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  push: vi.fn(),
  settle: vi.fn(),
  findPendingCheckoutPayments: vi.fn(),
  claimPendingPayments: vi.fn(),
  findSettledPayments: vi.fn(),
}));

vi.mock("@/modules/notification", () => ({
  sendCustomerPushNotification: palsu.push,
}));
vi.mock("@/modules/finance/services/received-payment-settlement", () => ({
  settleReceivedPayments: palsu.settle,
}));
vi.mock(
  "@/modules/finance/repositories/manualPaymentVerification.repository",
  () => ({
    findPendingCheckoutPayments: palsu.findPendingCheckoutPayments,
    claimPendingPayments: palsu.claimPendingPayments,
    findSettledPayments: palsu.findSettledPayments,
  }),
);

import type { VerifiablePayment } from "@/modules/finance/repositories/manualPaymentVerification.repository";
import {
  approveManualCheckout,
  isManualTransferPayment,
} from "@/modules/finance/services/manual-payment-verification";

const transfer = (
  id: string,
  invoiceId: string,
  invoiceNumber: string,
): VerifiablePayment => ({
  id,
  checkoutId: "co-1",
  invoiceId,
  pelangganId: "cust-1",
  tenantId: "t1",
  amount: 100000n,
  gatewayStatus: "PENDING",
  paymentMethod: "BANK_TRANSFER",
  expiresAt: null,
  transactionId: null,
  gatewayProvider: null,
  notes: "✅ [AI] cocok",
  couponUsageId: null,
  couponId: null,
  invoice: { invoiceNumber, status: "SENT" },
});

const settled = (
  id: string,
  invoiceId: string,
  invoice: { invoiceNumber: string; status: string },
  kelebihanBayar: bigint | null = null,
) => ({ id, invoiceId, kelebihanBayar, invoice });

describe("isManualTransferPayment", () => {
  it("transfer bank tanpa jejak gateway adalah transfer manual", () => {
    expect(isManualTransferPayment(transfer("p1", "inv-1", "INV-1"))).toBe(
      true,
    );
  });

  it("VA yang belum dibayar bukan transfer manual", () => {
    expect(
      isManualTransferPayment({
        paymentMethod: "OTHER",
        expiresAt: new Date(),
        transactionId: "DREF-1",
        gatewayProvider: "BC",
      }),
    ).toBe(false);
  });
});

describe("approveManualCheckout", () => {
  const P1 = transfer("p1", "inv-1", "INV-1");
  const P2 = transfer("p2", "inv-2", "INV-2");

  beforeEach(() => {
    vi.clearAllMocks();
    palsu.findPendingCheckoutPayments.mockResolvedValue([P1, P2]);
    palsu.claimPendingPayments.mockResolvedValue(["p1", "p2"]);
    palsu.findSettledPayments.mockResolvedValue([
      settled("p1", "inv-1", { invoiceNumber: "INV-1", status: "PAID" }),
      settled("p2", "inv-2", { invoiceNumber: "INV-2", status: "PAID" }),
    ]);
  });

  it("menyetujui seluruh checkout dan melunasinya lewat jalur pelunasan bersama", async () => {
    const result = await approveManualCheckout(P1, {
      notes: "Dana masuk",
      verifiedBy: "Admin",
    });

    expect(palsu.findPendingCheckoutPayments).toHaveBeenCalledWith(P1);
    const [claimed, buildData] = palsu.claimPendingPayments.mock.calls[0];
    expect(claimed).toEqual([P1, P2]);
    // Catatan admin ditambahkan; analisis OCR tidak tertimpa.
    expect(buildData(P1)).toMatchObject({
      gatewayStatus: "PAID",
      verifiedBy: "Admin",
      notes: "✅ [AI] cocok\nCatatan verifikasi: Dana masuk",
    });
    expect(palsu.settle).toHaveBeenCalledWith([P1, P2]);
    expect(result).toEqual({
      success: true,
      message: "Payment approved",
      warnings: [],
    });
  });

  // Dua admin bersamaan: yang kalah tidak menemukan PENDING lagi.
  it("gagal bila tidak ada payment yang masih menunggu", async () => {
    palsu.claimPendingPayments.mockResolvedValue([]);

    await expect(approveManualCheckout(P1, {})).rejects.toThrow(
      "Payment not found or already processed",
    );
    expect(palsu.settle).not.toHaveBeenCalled();
  });

  /**
   * Persetujuan transfer manual dulu selalu mengirim push sendiri, padahal
   * invoice yang lunas sudah diberitahukan lewat INVOICE_PAID: pelanggan
   * menerima dua push, dan pembayaran sebagian ikut disebut lunas.
   */
  it("hanya tagihan yang masih dibayar sebagian yang diberi push", async () => {
    palsu.findSettledPayments.mockResolvedValue([
      settled("p1", "inv-1", { invoiceNumber: "INV-1", status: "PAID" }),
      settled("p2", "inv-2", {
        invoiceNumber: "INV-2",
        status: "PARTIAL_PAID",
      }),
    ]);

    await approveManualCheckout(P1, {});

    expect(palsu.push).toHaveBeenCalledTimes(1);
    expect(palsu.push).toHaveBeenCalledWith(
      "cust-1",
      "Pembayaran Diterima",
      expect.stringContaining("Sisa tagihan"),
      expect.objectContaining({ invoiceId: "inv-2", action: "APPROVE" }),
    );
  });

  it("menjelaskan uang yang dikreditkan atau dialihkan", async () => {
    palsu.findSettledPayments.mockResolvedValue([
      settled(
        "p1",
        "inv-1",
        { invoiceNumber: "INV-1", status: "PAID" },
        100000n,
      ),
      settled(
        "p2",
        "inv-baru",
        { invoiceNumber: "INV-BARU", status: "PAID" },
        25000n,
      ),
    ]);

    const result = await approveManualCheckout(P1, {});

    expect(result.warnings).toEqual([
      "Tagihan INV-1 sudah lunas; Rp 100.000 dikreditkan ke saldo kredit pelanggan.",
      "Tagihan INV-2 sudah dibatalkan; pembayarannya dipakai untuk tagihan pengganti INV-BARU, dan Rp 25.000 dikreditkan ke saldo kredit pelanggan.",
    ]);
  });
});
