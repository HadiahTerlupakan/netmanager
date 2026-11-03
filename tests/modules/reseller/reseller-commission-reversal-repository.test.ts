import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ResellerCommissionReversalRepository } from "@/modules/reseller/repositories/ResellerCommissionReversalRepository";

/**
 * Bentuk query pembalikan komisi. Perilaku sungguhan (row lock, unique,
 * konkurensi) dibuktikan di tests/db/reseller-commission-clawback.test.ts.
 */

function commissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "commission-1",
    tenantId: "tenant-1",
    resellerId: "reseller-1",
    pelangganId: "pelanggan-1",
    invoiceId: "invoice-1",
    paymentId: null as string | null,
    commissionRuleId: "rule-1",
    type: "FIXED",
    rate: null as number | null,
    baseAmount: 100000,
    commissionAmount: 10000,
    status: "ACCRUED",
    period: "2026-07",
    settlementId: null as string | null,
    accruedAt: new Date("2026-07-05T00:00:00.000Z"),
    settledAt: null as Date | null,
    paidAt: null as Date | null,
    createdAt: new Date("2026-07-05T00:00:00.000Z"),
    updatedAt: new Date("2026-07-05T00:00:00.000Z"),
    deletedAt: null as Date | null,
    ...overrides,
  };
}

function createDb(settlementStatus = "PENDING") {
  // findMany dipakai dua kali: pemilik kandidat (distinct resellerId) untuk
  // dikunci, lalu kandidatnya sendiri setelah kunci didapat.
  const owners = vi.fn().mockResolvedValue([{ resellerId: "reseller-1" }]);
  const candidates = vi.fn();
  const tx = {
    owners,
    candidates,
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ status: settlementStatus }]),
    resellerCommission: {
      findMany: vi.fn((args: { distinct?: unknown }) =>
        args.distinct ? owners(args) : candidates(args),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    resellerCommissionAdjustment: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    resellerCommissionAdjustmentApplication: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    resellerSettlement: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const db = {
    $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) =>
      run(tx),
    ),
  };
  return { db, tx };
}

function createRepository(db: ReturnType<typeof createDb>["db"]) {
  return new ResellerCommissionReversalRepository(
    db as unknown as PrismaClient,
  );
}

const PARAMS = {
  tenantId: "tenant-1",
  invoiceId: "invoice-1",
  reason: "Invoice di-void setelah komisi dibayar",
};

describe("ResellerCommissionReversalRepository", () => {
  it("mencari komisi invoice di tenant event di bawah kunci invoice", async () => {
    const { db, tx } = createDb();
    tx.owners.mockResolvedValueOnce([]);
    tx.candidates.mockResolvedValueOnce([]);

    await createRepository(db).reverseForUnpaidInvoice(PARAMS);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.owners).toHaveBeenCalledWith({
      where: {
        invoiceId: "invoice-1",
        tenantId: "tenant-1",
        deletedAt: null,
        status: { in: ["ACCRUED", "SETTLED", "PAID"] },
      },
      select: { resellerId: true },
      distinct: ["resellerId"],
    });
    expect(tx.candidates).toHaveBeenCalledWith({
      where: {
        invoiceId: "invoice-1",
        tenantId: "tenant-1",
        deletedAt: null,
        status: { in: ["ACCRUED", "SETTLED", "PAID"] },
      },
      orderBy: { id: "asc" },
    });
    expect(tx.resellerCommissionAdjustment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: "invoice-1", tenantId: "tenant-1" },
      }),
    );
  });

  it("membatalkan ACCRUED dengan klaim bersyarat", async () => {
    const { db, tx } = createDb();
    tx.candidates.mockResolvedValueOnce([commissionRow()]);

    const result = await createRepository(db).reverseForUnpaidInvoice(PARAMS);

    expect(result.cancelled).toHaveLength(1);
    // Kunci koreksi reseller diambil sebelum kandidat dibaca, juga untuk
    // ACCRUED: settlement yang berlomba sudah commit saat kandidat dibaca.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.candidates.mock.invocationCallOrder[0],
    );
    expect(tx.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: {
        id: "commission-1",
        status: "ACCRUED",
        settlementId: null,
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("tidak melaporkan komisi yang sudah diklaim pembatalan lain", async () => {
    const { db, tx } = createDb();
    tx.candidates.mockResolvedValueOnce([commissionRow()]);
    tx.resellerCommission.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await createRepository(db).reverseForUnpaidInvoice(PARAMS);

    expect(result.cancelled).toEqual([]);
  });

  it("mengeluarkan komisi SETTLED dari settlement yang belum dibayar", async () => {
    const { db, tx } = createDb("APPROVED");
    tx.candidates
      .mockResolvedValueOnce([
        commissionRow({ status: "SETTLED", settlementId: "settlement-1" }),
      ])
      .mockResolvedValueOnce([{ commissionAmount: 25000 }]);

    const result = await createRepository(db).reverseForUnpaidInvoice(PARAMS);

    expect(result.cancelled).toEqual([
      expect.objectContaining({ status: "ACCRUED", settlementId: null }),
    ]);
    expect(tx.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: {
        id: "commission-1",
        settlementId: "settlement-1",
        status: "SETTLED",
        deletedAt: null,
      },
      data: expect.objectContaining({
        status: "ACCRUED",
        settlementId: null,
        settledAt: null,
      }),
    });
    expect(
      tx.resellerCommissionAdjustmentApplication.deleteMany,
    ).toHaveBeenCalledWith({ where: { settlementId: "settlement-1" } });
    expect(tx.resellerSettlement.updateMany).toHaveBeenCalledWith({
      where: { id: "settlement-1" },
      data: {
        totalAmount: 25000,
        adjustmentAmount: 0,
        commissionCount: 1,
        // APPROVED wajib disetujui ulang: nominal & potongannya berubah.
        status: "PENDING",
        approvedAt: null,
        approvedById: null,
      },
    });
    // Kunci invoice + kunci koreksi reseller.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("menagih balik komisi di settlement PAID tanpa membatalkannya", async () => {
    const { db, tx } = createDb("PAID");
    tx.candidates.mockResolvedValueOnce([
      commissionRow({ status: "PAID", settlementId: "settlement-1" }),
    ]);

    const result = await createRepository(db).reverseForUnpaidInvoice(PARAMS);

    expect(result.cancelled).toEqual([]);
    expect(tx.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: {
        id: "commission-1",
        deletedAt: null,
        status: { in: ["SETTLED", "PAID"] },
      },
      data: { status: "REVERSED" },
    });
    expect(tx.resellerCommissionAdjustment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-1",
          resellerId: "reseller-1",
          sourceCommissionId: "commission-1",
          sourceAccruedAt: new Date("2026-07-05T00:00:00.000Z"),
          amount: 10000,
          reason: PARAMS.reason,
        }),
      ],
      skipDuplicates: true,
    });
    expect(tx.resellerSettlement.updateMany).not.toHaveBeenCalled();
  });
});
