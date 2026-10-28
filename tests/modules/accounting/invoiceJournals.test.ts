import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  invoiceFindUnique: vi.fn(),
  paymentFindMany: vi.fn(),
  journalFindMany: vi.fn(),
  postAuto: vi.fn(),
  reverse: vi.fn(),
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: {
    invoice: { findUnique: palsu.invoiceFindUnique },
    payment: { findMany: palsu.paymentFindMany },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { journalEntry: { findMany: palsu.journalFindMany } },
}));
vi.mock("@/modules/accounting/services/journal/auto-posting", () => ({
  autoPostingService: () => ({ postAuto: palsu.postAuto }),
  journalReverseService: () => ({ reverse: palsu.reverse }),
  ensurePeriod: vi.fn(),
}));
vi.mock("@/modules/accounting/services/event-handlers/coa-resolver", () => ({
  resolveInvoiceCreatedCoa: async () => ({
    debitCoaId: "piutang",
    creditCoaId: "pendapatan",
  }),
  resolveInvoiceReceiptCoa: async () => ({
    piutang: "piutang",
    defaultBank: "bank",
    gatewayBalance: "saldo-gateway",
    gatewayFee: "beban-gateway",
    accountCoa: new Map(),
  }),
}));

import {
  postInvoiceAccrual,
  postInvoiceReceipts,
  reverseCancelledInvoiceJournals,
  reverseInvoiceReceiptJournals,
} from "@/modules/accounting/services/journal/invoice-journals";

const invoice = {
  tenantId: "t1",
  invoiceNumber: "INV-1",
  totalAmount: 100000n,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  status: "PARTIAL_PAID",
};

function payment(id: string, amount: bigint) {
  return {
    id,
    amount,
    gatewayFee: null as bigint | null,
    accountId: null as string | null,
    expiresAt: null as Date | null,
    gatewayProvider: null as string | null,
    paymentDate: new Date("2026-10-05T00:00:00Z"),
  };
}

const posted = (source: string) =>
  palsu.postAuto.mock.calls
    .map(([, params]) => params)
    .filter((params) => params.source === source);

describe("jurnal tagihan pelanggan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.invoiceFindUnique.mockResolvedValue(invoice);
  });

  // Dulu uang dari pembayaran sebagian tidak pernah dibukukan: jurnal
  // penerimaan hanya dibuat sekali saat tagihan lunas.
  it("membukukan setiap pembayaran, termasuk tagihan yang belum lunas", async () => {
    palsu.paymentFindMany.mockResolvedValue([
      payment("pay-1", 30000n),
      payment("pay-2", 20000n),
    ]);

    const count = await postInvoiceReceipts("inv-1");

    expect(count).toBe(2);
    expect(posted("AUTO_INVOICE_PAID").map((p) => p.sourceRefId)).toEqual([
      "inv-1:pay-1",
      "inv-1:pay-2",
    ]);
    expect(posted("AUTO_INVOICE_PAID")[0].lines).toEqual([
      { coaId: "bank", side: "DEBIT", amount: "30000" },
      { coaId: "piutang", side: "CREDIT", amount: "30000" },
    ]);
  });

  // Tagihan prorate dan manual tidak mengirim event terbit; tanpa jurnal
  // piutang lebih dulu, pelunasannya membuat Piutang minus.
  it("membukukan piutang tagihan sebelum penerimaannya", async () => {
    palsu.paymentFindMany.mockResolvedValue([payment("pay-1", 100000n)]);

    await postInvoiceReceipts("inv-1");

    const sources = palsu.postAuto.mock.calls.map(([, p]) => p.source);
    expect(sources).toEqual(["AUTO_INVOICE_CREATED", "AUTO_INVOICE_PAID"]);
    expect(posted("AUTO_INVOICE_CREATED")[0]).toMatchObject({
      sourceRefId: "inv-1",
      lines: [
        { coaId: "piutang", side: "DEBIT", amount: "100000" },
        { coaId: "pendapatan", side: "CREDIT", amount: "100000" },
      ],
    });
  });

  it("tidak membukukan apa pun tanpa uang yang diterima", async () => {
    palsu.paymentFindMany.mockResolvedValue([]);

    expect(await postInvoiceReceipts("inv-1")).toBe(0);
    expect(palsu.postAuto).not.toHaveBeenCalled();
  });

  it.each([
    ["dibatalkan", { status: "CANCELLED" }],
    ["bernilai Rp0", { totalAmount: 0n }],
  ])("tidak membukukan piutang tagihan yang %s", async (_label, override) => {
    palsu.invoiceFindUnique.mockResolvedValue({ ...invoice, ...override });

    expect(await postInvoiceAccrual("inv-1")).toBe(false);
    expect(palsu.postAuto).not.toHaveBeenCalled();
  });

  it("pembatalan satu pembayaran hanya membalik jurnal pembayaran itu", async () => {
    palsu.journalFindMany.mockResolvedValue([{ id: "je-1" }]);

    await reverseInvoiceReceiptJournals({
      tenantId: "t1",
      invoiceId: "inv-1",
      paymentId: "pay-2",
      reason: "batal",
      reversedBy: "Admin",
    });

    expect(palsu.journalFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        source: "AUTO_INVOICE_PAID",
        OR: [{ sourceRefId: "inv-1:pay-2" }],
        status: "POSTED",
      },
      select: { id: true },
    });
    expect(palsu.reverse).toHaveBeenCalledWith("je-1", "batal", "Admin");
  });

  // Dulu tagihan batal tetap tercatat sebagai piutang dan pendapatan.
  it("tagihan batal dibalik piutang, penerimaan, dan kuponnya", async () => {
    palsu.journalFindMany
      .mockResolvedValueOnce([{ id: "je-terima" }])
      .mockResolvedValueOnce([{ id: "je-piutang" }])
      .mockResolvedValueOnce([{ id: "je-kupon" }]);

    const count = await reverseCancelledInvoiceJournals({
      tenantId: "t1",
      invoiceId: "inv-1",
      reason: "void",
      reversedBy: "Admin",
    });

    expect(count).toBe(3);
    expect(palsu.journalFindMany.mock.calls[0][0].where.OR).toEqual([
      { sourceRefId: "inv-1" },
      { sourceRefId: { startsWith: "inv-1:" } },
    ]);
    expect(palsu.journalFindMany.mock.calls[1][0].where).toMatchObject({
      source: "AUTO_INVOICE_CREATED",
      OR: [{ sourceRefId: "inv-1" }],
    });
    expect(palsu.journalFindMany.mock.calls[2][0].where).toMatchObject({
      source: "AUTO_COUPON_USED",
      OR: [{ sourceRefId: { endsWith: ":inv-1" } }],
    });
    expect(palsu.reverse.mock.calls.map(([id]) => id)).toEqual([
      "je-terima",
      "je-piutang",
      "je-kupon",
    ]);
  });
});
