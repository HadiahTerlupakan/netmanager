import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(),
}));
vi.mock("@/modules/accounting", () => ({
  reverseCancelledInvoiceJournals: vi.fn().mockResolvedValue(0),
}));
const closeAbandonedManualTransfers = vi.hoisted(() =>
  vi.fn().mockResolvedValue(1),
);
vi.mock("@/modules/finance/services/abandoned-manual-transfer", () => ({
  closeAbandonedManualTransfers,
}));

import { replaceOutstandingInvoiceForCustomer } from "@/modules/finance/services/outstanding-invoice.helpers";

const NOW = new Date("2026-10-31T03:00:00.000Z");
const JAM = 60 * 60 * 1000;

type Payment = {
  gatewayStatus: string | null;
  expiresAt: Date | null;
  receiptUrl: string | null;
  gatewayProvider: string | null;
};

function tagihan(id: string, payment: Payment[] = []) {
  return {
    id,
    invoiceNumber: `INV/${id}`,
    status: "SENT",
    paidAmount: 0n,
    tenantId: "t1",
    payment,
  };
}

const VA_AKTIF: Payment = {
  gatewayStatus: "PENDING",
  expiresAt: new Date(NOW.getTime() + 20 * JAM),
  receiptUrl: null,
  gatewayProvider: "BC",
};

function createInvoiceRepo(invoices: ReturnType<typeof tagihan>[] = []) {
  return {
    findUnpaidInvoices: vi.fn().mockResolvedValue(invoices),
    cancelIfUnpaid: vi.fn().mockImplementation(async (id: string) => ({
      id,
      pelangganId: "cust-1",
      notes: null,
      discountAmount: 0n,
    })),
  };
}

function ganti(
  invoiceRepo: ReturnType<typeof createInvoiceRepo>,
  createInvoice = vi.fn().mockResolvedValue({ id: "inv-baru" }),
) {
  return replaceOutstandingInvoiceForCustomer({
    pelangganId: "cust-1",
    invoiceRepo: invoiceRepo as never,
    createInvoice,
    describeMethod: (code) =>
      code === "BC" ? "BCA Virtual Account" : undefined,
    now: NOW,
  });
}

describe("replaceOutstandingInvoiceForCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regresi: aksi "Batalkan & Buat Tagihan Baru" hanya membuat tagihan baru,
  // tagihan lama tetap hidup sehingga pelanggan punya dua tagihan.
  it("membatalkan tagihan lama sebelum membuat yang baru", async () => {
    const callOrder: string[] = [];
    const invoiceRepo = createInvoiceRepo([tagihan("lama")]);
    invoiceRepo.cancelIfUnpaid.mockImplementation(async (id: string) => {
      callOrder.push(`cancel:${id}`);
      return { id, pelangganId: "cust-1", notes: null, discountAmount: 0n };
    });

    const result = await ganti(
      invoiceRepo,
      vi.fn(async () => {
        callOrder.push("create");
        return { id: "inv-baru" };
      }),
    );

    expect(callOrder).toEqual(["cancel:lama", "create"]);
    expect(result).toEqual({
      cancelledInvoiceIds: ["lama"],
      invoice: { id: "inv-baru" },
      keptInvoices: [],
    });
  });

  it("hanya mencari tagihan hidup milik pelanggan itu beserta pembayarannya", async () => {
    const invoiceRepo = createInvoiceRepo([]);

    await ganti(invoiceRepo);

    expect(invoiceRepo.findUnpaidInvoices).toHaveBeenCalledWith(
      {
        pelangganId: "cust-1",
        status: { in: ["DRAFT", "SENT", "OVERDUE"] },
      },
      expect.objectContaining({
        payment: {
          select: expect.objectContaining({
            receiptUrl: true,
            expiresAt: true,
          }),
        },
      }),
    );
  });

  it("tidak membuat tagihan baru bila pembatalan gagal", async () => {
    const invoiceRepo = createInvoiceRepo([tagihan("lama")]);
    invoiceRepo.cancelIfUnpaid.mockRejectedValue(new Error("db down"));
    const createInvoice = vi.fn();

    await expect(ganti(invoiceRepo, createInvoice)).rejects.toThrow("db down");
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("tetap membuat tagihan baru saat tidak ada tagihan lama", async () => {
    const createInvoice = vi.fn().mockResolvedValue({ id: "inv-baru" });

    const result = await ganti(createInvoiceRepo([]), createInvoice);

    expect(result.cancelledInvoiceIds).toEqual([]);
    expect(createInvoice).toHaveBeenCalledOnce();
  });

  // Duitku tidak bisa menutup VA lebih awal: pelanggan yang sedang membayar
  // VA tagihan lama akan membayar tagihan yang sudah dibatalkan.
  it("membiarkan tagihan yang VA-nya masih bisa dibayar, dengan alasan untuk admin", async () => {
    const invoiceRepo = createInvoiceRepo([tagihan("lama", [VA_AKTIF])]);
    const createInvoice = vi.fn();

    const result = await ganti(invoiceRepo, createInvoice);

    expect(result.cancelledInvoiceIds).toEqual([]);
    expect(result.invoice).toBeNull();
    expect(result.keptInvoices).toEqual([
      {
        invoiceId: "lama",
        invoiceNumber: "INV/lama",
        reason: "ACTIVE_CHECKOUT",
        message:
          "Tagihan INV/lama tidak dibatalkan karena pelanggan sedang membayar (BCA Virtual Account aktif sampai 1 Nov 2026, 06.00 WIB).",
      },
    ]);
    expect(invoiceRepo.cancelIfUnpaid).not.toHaveBeenCalled();
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("membiarkan tagihan yang bukti transfernya menunggu verifikasi", async () => {
    const invoiceRepo = createInvoiceRepo([
      tagihan("lama", [
        {
          gatewayStatus: "PENDING",
          expiresAt: null,
          receiptUrl: "/bukti.webp",
          gatewayProvider: null,
        },
      ]),
    ]);

    const result = await ganti(invoiceRepo);

    expect(result.keptInvoices).toMatchObject([
      {
        reason: "PAYMENT_RECORDED",
        message:
          "Tagihan INV/lama tidak dibatalkan karena ada bukti transfer yang menunggu verifikasi; setujui atau tolak dulu di Verifikasi Pembayaran Manual.",
      },
    ]);
  });

  // Pilihan itu ditutup bersama tagihannya; pelanggan membayar penggantinya.
  it("pilihan transfer manual tanpa bukti tidak menahan penggantian", async () => {
    const invoiceRepo = createInvoiceRepo([
      tagihan("lama", [
        {
          gatewayStatus: "PENDING",
          expiresAt: null,
          receiptUrl: null,
          gatewayProvider: null,
        },
      ]),
    ]);

    const result = await ganti(invoiceRepo);

    expect(result.cancelledInvoiceIds).toEqual(["lama"]);
    expect(result.invoice).toEqual({ id: "inv-baru" });
    expect(closeAbandonedManualTransfers).toHaveBeenCalledWith("lama");
  });

  // Satu periode tidak boleh berakhir dengan dua tagihan.
  it("satu tagihan yang tertahan membatalkan seluruh penggantian", async () => {
    const invoiceRepo = createInvoiceRepo([
      tagihan("tunggakan"),
      tagihan("berjalan", [VA_AKTIF]),
    ]);

    const result = await ganti(invoiceRepo);

    expect(result.keptInvoices.map((kept) => kept.invoiceId)).toEqual([
      "berjalan",
    ]);
    expect(invoiceRepo.cancelIfUnpaid).not.toHaveBeenCalled();
    expect(result.invoice).toBeNull();
  });

  it("tagihan yang lunas tepat sebelum dibatalkan dilaporkan, tanpa tagihan baru", async () => {
    const invoiceRepo = createInvoiceRepo([tagihan("lama")]);
    invoiceRepo.cancelIfUnpaid.mockResolvedValue(null);
    const createInvoice = vi.fn();

    const result = await ganti(invoiceRepo, createInvoice);

    expect(result.keptInvoices).toMatchObject([
      {
        invoiceId: "lama",
        reason: "NOT_UNPAID",
        message:
          "Tagihan INV/lama tidak dibatalkan karena baru saja menerima pembayaran.",
      },
    ]);
    expect(createInvoice).not.toHaveBeenCalled();
  });
});
