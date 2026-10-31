import { describe, expect, it } from "vitest";
import { findRepriceBlocker } from "@/modules/finance/services/cycle-invoice-reprice";

const NOW = new Date("2026-11-03T10:00:00.000Z");
const MENIT = 60 * 1000;

type Payment = { gatewayStatus: string | null; expiresAt: Date | null };
type Invoice = { status: string; paidAmount: bigint; payment: Payment[] };

function invoice(overrides: Partial<Invoice>): Invoice {
  return { status: "SENT", paidAmount: 0n, payment: [], ...overrides };
}

describe("findRepriceBlocker", () => {
  it.each(["DRAFT", "SENT", "OVERDUE"])(
    "invoice %s tanpa pembayaran boleh dihitung ulang",
    (status) => {
      expect(findRepriceBlocker(invoice({ status }), NOW)).toBeNull();
    },
  );

  it.each(["PAID", "PARTIAL_PAID", "CANCELLED"])(
    "invoice %s tidak disentuh",
    (status) => {
      expect(findRepriceBlocker(invoice({ status }), NOW)).toBe("NOT_UNPAID");
    },
  );

  it("paidAmount > 0 pada status apa pun berarti sudah ada pembayaran", () => {
    expect(findRepriceBlocker(invoice({ paidAmount: 1n }), NOW)).toBe(
      "PAYMENT_RECORDED",
    );
  });

  it.each([
    ["lunas lewat gateway", { gatewayStatus: "PAID", expiresAt: null }],
    ["pembayaran manual", { gatewayStatus: null, expiresAt: null }],
    // Transfer manual tanpa expiresAt: buktinya sedang diverifikasi admin.
    [
      "transfer menunggu verifikasi",
      { gatewayStatus: "PENDING", expiresAt: null },
    ],
  ])("%s menahan invoice", (_label, payment) => {
    expect(findRepriceBlocker(invoice({ payment: [payment] }), NOW)).toBe(
      "PAYMENT_RECORDED",
    );
  });

  it("checkout VA/QRIS yang masih berlaku menahan invoice", () => {
    const payment = {
      gatewayStatus: "PENDING",
      expiresAt: new Date(NOW.getTime() + 30 * MENIT),
    };
    expect(findRepriceBlocker(invoice({ payment: [payment] }), NOW)).toBe(
      "ACTIVE_CHECKOUT",
    );
  });

  // Duitku tidak bisa menutup VA lebih awal: checkout yang dibatalkan karena
  // ganti metode tetap bisa dibayar dengan nominal lama sampai kedaluwarsa.
  it("checkout yang dibatalkan tapi VA-nya belum kedaluwarsa tetap menahan", () => {
    const payment = {
      gatewayStatus: "CANCELLED",
      expiresAt: new Date(NOW.getTime() + 30 * MENIT),
    };
    expect(findRepriceBlocker(invoice({ payment: [payment] }), NOW)).toBe(
      "ACTIVE_CHECKOUT",
    );
  });

  // Notifikasi PAID gateway bisa datang sedikit setelah batas waktunya.
  it("checkout yang baru saja lewat batas waktunya masih ditunggu", () => {
    const payment = {
      gatewayStatus: "PENDING",
      expiresAt: new Date(NOW.getTime() - 10 * MENIT),
    };
    expect(findRepriceBlocker(invoice({ payment: [payment] }), NOW)).toBe(
      "ACTIVE_CHECKOUT",
    );
  });

  it.each([
    ["kedaluwarsa", { gatewayStatus: "EXPIRED", expiresAt: new Date(NOW) }],
    ["gagal", { gatewayStatus: "FAILED", expiresAt: new Date(NOW) }],
    ["dikembalikan", { gatewayStatus: "REFUNDED", expiresAt: null }],
    [
      "dibatalkan dan sudah lama lewat batas",
      {
        gatewayStatus: "CANCELLED",
        expiresAt: new Date(NOW.getTime() - 3 * 60 * MENIT),
      },
    ],
    // Pembayaran manual yang dibatalkan admin tidak lagi bisa dibayar.
    ["manual yang dibatalkan", { gatewayStatus: "CANCELLED", expiresAt: null }],
  ])("payment %s tidak menahan", (_label, payment) => {
    expect(findRepriceBlocker(invoice({ payment: [payment] }), NOW)).toBeNull();
  });
});
