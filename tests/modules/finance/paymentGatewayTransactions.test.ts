import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const palsu = vi.hoisted(() => ({
  findManyByIds: vi.fn(),
  findIdsBySearch: vi.fn(),
}));

vi.mock("@/modules/finance/pelanggan-registry", () => ({
  getPelangganBillingBridge: () => ({
    findManyByIds: palsu.findManyByIds,
    findIdsBySearch: palsu.findIdsBySearch,
  }),
}));

import {
  listPaymentGatewayTransactions,
  resolveDisplayStatus,
} from "@/modules/finance/services/PaymentGatewayTransactionService";

const BASE = {
  pelangganId: "cust-1",
  notes: null as string | null,
  gatewayFee: null as bigint | null,
  invoiceId: "inv-1",
  discountAmount: 0n,
  transactionId: null as string | null,
  paymentMethod: "OTHER",
  vaNumber: null as string | null,
  paymentUrl: null as string | null,
  expiresAt: new Date("2026-10-29T01:00:00Z"),
  paymentDate: new Date("2026-10-28T01:00:00Z"),
  updatedAt: new Date("2026-10-28T01:00:00Z"),
  invoice: { invoiceNumber: "INV/1", status: "OVERDUE" },
};

const VA = {
  ...BASE,
  id: "p-va",
  checkoutId: "c-va",
  amount: 11100n,
  reference: "PAY-VA",
  gatewayStatus: "CANCELLED",
  gatewayProvider: "BC",
  vaNumber: "7007014007428430",
  createdAt: new Date("2026-10-28T01:02:31Z"),
};
const QRIS = {
  ...BASE,
  id: "p-qr",
  checkoutId: "c-qr",
  amount: 11100n,
  reference: "PAY-QR",
  gatewayStatus: "PAID",
  gatewayProvider: "SP",
  createdAt: new Date("2026-10-28T01:03:04Z"),
  invoice: { invoiceNumber: "INV/1", status: "PAID" },
};

/**
 * Admin dulu tidak punya tempat melihat pembayaran gateway: siapa yang
 * membayar, dengan metode apa, dan apakah checkout-nya diganti, kedaluwarsa,
 * atau lunas.
 */
describe("transaksi payment gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.findMany.mockResolvedValueOnce([QRIS, VA]);
    prismaMock.payment.count.mockResolvedValue(2);
    prismaMock.payment.groupBy.mockResolvedValue([
      { gatewayStatus: "PAID", _count: { _all: 1 }, _sum: { amount: 11100n } },
      {
        gatewayStatus: "CANCELLED",
        _count: { _all: 1 },
        _sum: { amount: 11100n },
      },
    ]);
    // Checkout lain untuk invoice yang sama, dibuat setelah VA.
    prismaMock.payment.findMany.mockResolvedValueOnce([
      { invoiceId: "inv-1", checkoutId: "c-qr", createdAt: QRIS.createdAt },
    ]);
    palsu.findManyByIds.mockResolvedValue([
      { id: "cust-1", nama: "TES LAB 02" },
    ]);
  });

  it("menampilkan pelanggan, metode, dan status yang bisa dibaca admin", async () => {
    const result = await listPaymentGatewayTransactions({ page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      expect.objectContaining({
        customerName: "TES LAB 02",
        invoiceNumber: "INV/1",
        gateway: "DUITKU",
        methodName: "QRIS (Gopay, OVO, Dana, LinkAja)",
        status: "LUNAS",
        amount: 11100,
        paidAt: QRIS.paymentDate,
      }),
      expect.objectContaining({
        methodName: "BCA Virtual Account",
        vaNumber: "7007014007428430",
        status: "DIGANTI_METODE",
        paidAt: null,
      }),
    ]);
    expect(result.summary).toEqual([
      { status: "PAID", count: 1, amount: 11100 },
      { status: "CANCELLED", count: 1, amount: 11100 },
    ]);
  });

  it("pencarian mencocokkan nomor tagihan atau pelanggan", async () => {
    palsu.findIdsBySearch.mockResolvedValue(["cust-1"]);

    await listPaymentGatewayTransactions({
      page: 1,
      limit: 20,
      search: " tes lab ",
    });

    expect(palsu.findIdsBySearch).toHaveBeenCalledWith("tes lab");
    const where = prismaMock.payment.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"pelangganId":{"in":["cust-1"]}');
    expect(JSON.stringify(where)).toContain('"contains":"tes lab"');
  });
});

describe("resolveDisplayStatus", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const row = (gatewayStatus: string, over: object = {}) => ({
    id: "p1",
    gatewayStatus: gatewayStatus as never,
    notes: null as string | null,
    expiresAt: new Date("2026-10-29T00:00:00Z"),
    invoice: { status: "OVERDUE" },
    ...over,
  });

  it.each([
    ["PENDING", {}, "MENUNGGU"],
    ["PENDING", { expiresAt: new Date("2026-10-28T00:00:00Z") }, "KEDALUWARSA"],
    ["EXPIRED", {}, "KEDALUWARSA"],
    ["FAILED", {}, "GAGAL"],
    ["CANCELLED", { invoice: { status: "PAID" } }, "DITUTUP_LUNAS"],
    ["CANCELLED", {}, "DIBATALKAN"],
    // PAY-9aec6090 di sandbox: lunas di Duitku lalu dibatalkan admin.
    [
      "CANCELLED",
      {
        notes: "Cancelled by admin Admin on 2026-10-27T22:24:02.175Z",
        invoice: { status: "PAID" },
      },
      "DIBATALKAN_ADMIN",
    ],
  ])("%s %j → %s", (status, over, expected) => {
    expect(resolveDisplayStatus(row(status, over), new Set(), now)).toBe(
      expected,
    );
  });

  it("checkout yang digantikan checkout lain ditandai diganti metode", () => {
    expect(resolveDisplayStatus(row("CANCELLED"), new Set(["p1"]), now)).toBe(
      "DIGANTI_METODE",
    );
  });
});
