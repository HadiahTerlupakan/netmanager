import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  push: vi.fn(),
  settle: vi.fn(),
  releaseCoupons: vi.fn(),
  onPaymentRejected: vi.fn(),
  findPendingCheckoutPayments: vi.fn(),
  claimPendingCheckout: vi.fn(),
  findSettledPayments: vi.fn(),
}));

vi.mock("@/modules/notification", () => ({
  CUSTOMER_APP_BILLING_ROUTE: "/(customer)/tagihan",
  sendCustomerPushNotification: palsu.push,
}));
vi.mock("@/modules/payment-gateway", () => ({
  releaseUnusedCheckoutCoupons: palsu.releaseCoupons,
}));
vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onPaymentRejected: palsu.onPaymentRejected },
}));
vi.mock("@/modules/finance/services/received-payment-settlement", () => ({
  settleReceivedPayments: palsu.settle,
}));
vi.mock(
  "@/modules/finance/repositories/manualPaymentVerification.repository",
  () => ({
    findPendingCheckoutPayments: palsu.findPendingCheckoutPayments,
    claimPendingCheckout: palsu.claimPendingCheckout,
    findSettledPayments: palsu.findSettledPayments,
  }),
);

import type { VerifiablePayment } from "@/modules/finance/repositories/manualPaymentVerification.repository";
import {
  approveManualCheckout,
  isManualTransferPayment,
  rejectManualCheckout,
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
  accountId: "rek-bca",
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
  it("transfer ke rekening perusahaan adalah transfer manual", () => {
    expect(isManualTransferPayment(transfer("p1", "inv-1", "INV-1"))).toBe(
      true,
    );
  });

  // Payment VA kini juga BANK_TRANSFER; yang membedakan rekening tujuannya.
  it("checkout gateway tanpa rekening tujuan bukan transfer manual", () => {
    expect(isManualTransferPayment({ accountId: null })).toBe(false);
  });
});

describe("approveManualCheckout", () => {
  const P1 = transfer("p1", "inv-1", "INV-1");
  const P2 = transfer("p2", "inv-2", "INV-2");

  beforeEach(() => {
    vi.clearAllMocks();
    palsu.findPendingCheckoutPayments.mockResolvedValue([P1, P2]);
    palsu.claimPendingCheckout.mockResolvedValue(true);
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
    const [claimed, data, noteFor] = palsu.claimPendingCheckout.mock.calls[0];
    expect(claimed).toEqual([P1, P2]);
    expect(data).toEqual({
      gatewayStatus: "PAID",
      paymentDate: expect.any(Date),
      verifiedAt: expect.any(Date),
      verifiedBy: "Admin",
    });
    // Catatan admin ditambahkan; analisis OCR tidak tertimpa.
    expect(noteFor(P1)).toBe("✅ [AI] cocok\nCatatan verifikasi: Dana masuk");
    expect(palsu.settle).toHaveBeenCalledWith([P1, P2]);
    expect(result).toEqual({
      success: true,
      message: "Payment approved",
      warnings: [],
    });
  });

  it("tanpa catatan admin, catatan payment tidak ditulis ulang", async () => {
    await approveManualCheckout(P1, { verifiedBy: "Admin" });

    expect(palsu.claimPendingCheckout.mock.calls[0][2]).toBeUndefined();
  });

  it("gagal bila tidak ada payment yang masih menunggu", async () => {
    palsu.findPendingCheckoutPayments.mockResolvedValue([]);

    await expect(approveManualCheckout(P1, {})).rejects.toMatchObject({
      message: "Payment not found or already processed",
      status: 404,
    });
    expect(palsu.claimPendingCheckout).not.toHaveBeenCalled();
    expect(palsu.settle).not.toHaveBeenCalled();
  });

  // Pembatalan pelanggan atau admin lain yang lebih dulu commit: klaim seluruh
  // checkout gagal, tidak ada yang dilunasi sebagian.
  it("gagal dengan 409 bila checkout berubah di tengah persetujuan", async () => {
    palsu.claimPendingCheckout.mockResolvedValue(false);

    await expect(approveManualCheckout(P1, {})).rejects.toMatchObject({
      message: expect.stringMatching(/dibatalkan pelanggan/),
      status: 409,
    });
    expect(palsu.settle).not.toHaveBeenCalled();
    expect(palsu.push).not.toHaveBeenCalled();
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
      expect.objectContaining({
        invoiceId: "inv-2",
        action: "APPROVE",
        url: "/(customer)/tagihan",
      }),
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

describe("rejectManualCheckout", () => {
  const P1 = { ...transfer("p1", "inv-1", "INV-1"), couponUsageId: "use-1" };
  const P2 = { ...transfer("p2", "inv-2", "INV-2"), couponUsageId: "use-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    palsu.findPendingCheckoutPayments.mockResolvedValue([P1, P2]);
    palsu.claimPendingCheckout.mockResolvedValue(true);
  });

  // Dulu alasan admin menimpa `notes`, yang memuat analisis OCR bukti.
  it("menyimpan alasan di rejectionReason tanpa menyentuh catatan OCR", async () => {
    await rejectManualCheckout(P1, {
      reason: "  Nominal tidak sesuai  ",
      verifiedBy: "Admin",
    });

    const [claimed, data, noteFor] = palsu.claimPendingCheckout.mock.calls[0];
    expect(claimed).toEqual([P1, P2]);
    expect(data).toEqual({
      gatewayStatus: "FAILED",
      verifiedAt: expect.any(Date),
      verifiedBy: "Admin",
      rejectionReason: "Nominal tidak sesuai",
    });
    expect(noteFor).toBeUndefined();
  });

  // Kupon dilepas sekali untuk seluruh checkout, kecuali yang masih dipegang
  // payment lain yang hidup (mis. invoice Rp 0 yang tertutup kupon itu).
  it("mengembalikan kupon checkout dan memberi tahu pelanggan beserta alasannya", async () => {
    await rejectManualCheckout(P1, { reason: "Bukti buram" });

    expect(palsu.releaseCoupons).toHaveBeenCalledWith([P1, P2]);
    expect(palsu.onPaymentRejected).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      amount: 200000,
      invoiceNumbers: ["INV-1", "INV-2"],
      reason: "Bukti buram",
      tenantId: "t1",
    });
  });

  it("alasan kosong tetap memberi tahu pelanggan, tanpa alasan", async () => {
    await rejectManualCheckout(P1, { reason: "   " });

    expect(palsu.claimPendingCheckout.mock.calls[0][1]).toMatchObject({
      rejectionReason: null,
    });
    expect(palsu.onPaymentRejected).toHaveBeenCalledWith(
      expect.objectContaining({ reason: undefined }),
    );
  });

  // Penolakan sudah tersimpan; galat di sini membuat admin mengulang dan
  // mendapat "sudah diproses".
  it("pemberitahuan yang gagal tidak menggagalkan penolakan yang tersimpan", async () => {
    palsu.onPaymentRejected.mockRejectedValueOnce(new Error("redis mati"));

    await expect(
      rejectManualCheckout(P1, { reason: "Buram" }),
    ).resolves.toEqual({
      success: true,
      message: "Payment rejected",
      warnings: [],
    });
    expect(palsu.releaseCoupons).toHaveBeenCalled();
  });

  it("gagal tanpa efek samping bila bukti sudah diproses admin lain", async () => {
    palsu.claimPendingCheckout.mockResolvedValue(false);

    await expect(rejectManualCheckout(P1, {})).rejects.toMatchObject({
      status: 409,
    });
    expect(palsu.releaseCoupons).not.toHaveBeenCalled();
    expect(palsu.onPaymentRejected).not.toHaveBeenCalled();
  });
});
