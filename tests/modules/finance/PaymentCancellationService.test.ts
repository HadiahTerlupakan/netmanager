import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentUpdate: vi.fn(),
  pelangganFindUnique: vi.fn(),
  updateStatusPelanggan: vi.fn(),
  sendCustomerPushNotification: vi.fn(),
  recompute: vi.fn<(invoiceId: string) => Promise<unknown>>(() =>
    Promise.resolve(null),
  ),
  reverseReceipt: vi.fn(),
}));

vi.mock("@/modules/accounting", () => ({
  reverseInvoiceReceiptJournals: mockFns.reverseReceipt,
}));

vi.mock("@/modules/database", () => ({
  prismaBilling: {
    payment: {
      findUnique: mockFns.paymentFindUnique,
      update: mockFns.paymentUpdate,
    },
  },
  prisma: {
    pelanggan: {
      findUnique: mockFns.pelangganFindUnique,
    },
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  getPelangganService: () => ({
    updateStatusPelanggan: mockFns.updateStatusPelanggan,
  }),
}));

vi.mock("@/modules/notification", () => ({
  sendCustomerPushNotification: mockFns.sendCustomerPushNotification,
}));

vi.mock("@/modules/finance/services/InvoicePaymentStateService", () => ({
  InvoicePaymentStateService: class MockInvoicePaymentStateService {
    recompute(...args: [string]) {
      return mockFns.recompute(...args);
    }
  },
}));

import {
  cancelPaidPayment,
  PaymentCancellationError,
} from "@/modules/finance/services/PaymentCancellationService";

describe("cancelPaidPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.paymentFindUnique.mockResolvedValue({
      id: "pay-1",
      gatewayStatus: "PAID",
      amount: 50000n,
      invoice: {
        id: "inv-1",
        pelangganId: "cust-1",
        paidAmount: 50000n,
        totalAmount: 50000n,
        paidAt: new Date("2026-05-10T00:00:00.000Z"),
        status: "PAID",
      },
    });
    mockFns.pelangganFindUnique.mockResolvedValue({
      id: "cust-1",
      status: "AKTIF",
    });
  });

  it("cancels a paid payment, delegates invoice recompute, and notifies customer", async () => {
    await cancelPaidPayment({ paymentId: "pay-1", adminLabel: "Admin" });

    expect(mockFns.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: expect.objectContaining({ gatewayStatus: "CANCELLED" }),
    });
    expect(mockFns.recompute).toHaveBeenCalledWith("inv-1");
    expect(mockFns.updateStatusPelanggan).not.toHaveBeenCalled();
    expect(mockFns.sendCustomerPushNotification).toHaveBeenCalledWith(
      "cust-1",
      "Pembayaran Dibatalkan",
      "Pembayaran Anda telah dibatalkan oleh Admin.",
      { paymentId: "pay-1", invoiceId: "inv-1", action: "CANCEL" },
    );
  });

  it("rejects non-paid payments", async () => {
    mockFns.paymentFindUnique.mockResolvedValue({
      id: "pay-1",
      gatewayStatus: "PENDING",
      invoice: { id: "inv-1" },
    });

    await expect(
      cancelPaidPayment({ paymentId: "pay-1", adminLabel: "Admin" }),
    ).rejects.toEqual(
      new PaymentCancellationError("Only PAID payments can be cancelled", 400),
    );
    expect(mockFns.paymentUpdate).not.toHaveBeenCalled();
    expect(mockFns.recompute).not.toHaveBeenCalled();
  });

  // Admin membatalkan pembayaran yang sudah dibayar lewat Duitku, tagihan
  // terbuka lagi, dan pelanggan membayar ulang: dana masuk dua kali.
  it("menolak membatalkan pembayaran yang sudah diterima payment gateway", async () => {
    mockFns.paymentFindUnique.mockResolvedValue({
      id: "pay-gw",
      gatewayStatus: "PAID",
      gatewayProvider: "SP",
      expiresAt: new Date("2026-10-29T00:00:00Z"),
      invoice: { id: "inv-1", pelangganId: "cust-1" },
    });

    await expect(
      cancelPaidPayment({ paymentId: "pay-gw", adminLabel: "admin" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockFns.paymentUpdate).not.toHaveBeenCalled();
    expect(mockFns.recompute).not.toHaveBeenCalled();
  });

  // Dulu pembatalan tidak membalik jurnal: kas tetap tercatat bertambah untuk
  // uang yang dianggap batal.
  it("membalik jurnal penerimaan bila invoice tidak lagi lunas", async () => {
    mockFns.paymentFindUnique.mockResolvedValue({
      id: "pay-1",
      gatewayStatus: "PAID",
      amount: 50000n,
      invoice: { id: "inv-1", pelangganId: "cust-1", tenantId: "t1" },
    });
    mockFns.recompute.mockResolvedValue({
      previousStatus: "PAID",
      invoice: { status: "SENT" },
    });

    await cancelPaidPayment({ paymentId: "pay-1", adminLabel: "Admin" });

    expect(mockFns.reverseReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        invoiceId: "inv-1",
        reversedBy: "Admin",
      }),
    );
  });

  it("invoice yang tetap lunas tidak dibalik jurnalnya", async () => {
    mockFns.paymentFindUnique.mockResolvedValue({
      id: "pay-1",
      gatewayStatus: "PAID",
      amount: 50000n,
      invoice: { id: "inv-1", pelangganId: "cust-1", tenantId: "t1" },
    });
    mockFns.recompute.mockResolvedValue({
      previousStatus: "PAID",
      invoice: { status: "PAID" },
    });

    await cancelPaidPayment({ paymentId: "pay-1", adminLabel: "Admin" });

    expect(mockFns.reverseReceipt).not.toHaveBeenCalled();
  });
});
