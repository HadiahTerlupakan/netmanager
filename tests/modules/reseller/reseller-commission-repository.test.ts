import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ResellerCommissionRepository } from "@/modules/reseller/repositories/ResellerCommissionRepository";

/**
 * Bentuk query yang dikirim repository ke Prisma. Tanpa DB nyata, yang diuji
 * adalah syarat `where` yang menjadi penjaga uangnya.
 */

function createDb() {
  const resellerCommission = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const resellerSettlement = {
    create: vi.fn().mockResolvedValue({ id: "settlement-1" }),
  };
  const $executeRaw = vi.fn().mockResolvedValue(1);
  const db = {
    pelanggan: { findFirst: vi.fn().mockResolvedValue(null) },
    reseller: { findFirst: vi.fn() },
    resellerCommission,
    resellerSettlement,
    $executeRaw,
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
      run({ resellerCommission, resellerSettlement, $executeRaw }),
    ),
  };
  return db;
}

function createRepository(db: ReturnType<typeof createDb>) {
  return new ResellerCommissionRepository(db as unknown as PrismaClient);
}

const SETTLEMENT_INPUT = {
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  periodStart: new Date("2026-07-01T00:00:00.000Z"),
  periodEnd: new Date("2026-07-31T23:59:59.999Z"),
  notes: null as string | null,
};

const COMMISSION_DATA = {
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  pelangganId: "pelanggan-1",
  invoiceId: "invoice-1",
  paymentId: null as string | null,
  commissionRuleId: "rule-1",
  type: "PERCENTAGE" as const,
  rate: 10,
  baseAmount: 200000,
  commissionAmount: 20000,
  period: "2026-07",
  accruedAt: new Date("2026-07-08T00:00:00.000Z"),
};

describe("ResellerCommissionRepository", () => {
  // Audit #1/#3/#9: `tenantId: null` dulu menjadi filter eksplisit sehingga
  // pelanggan bertenant tidak pernah ditemukan.
  it("looks up the customer by id only when tenant is unknown", async () => {
    const db = createDb();

    await createRepository(db).findCustomerContext(null, "pelanggan-1");

    expect(db.pelanggan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pelanggan-1" } }),
    );
  });

  it("keeps the tenant filter when tenant is known", async () => {
    const db = createDb();

    await createRepository(db).findCustomerContext("tenant-1", "pelanggan-1");

    expect(db.pelanggan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pelanggan-1", tenantId: "tenant-1" },
      }),
    );
  });

  it("membawa status kemitraan dan waktu perubahannya untuk gerbang akrual", async () => {
    const db = createDb();
    const changedAt = new Date("2026-11-02T03:00:00.000Z");
    db.pelanggan.findFirst.mockResolvedValueOnce({
      id: "pelanggan-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      reseller: { status: "SUSPENDED", statusChangedAt: changedAt },
    });

    const context = await createRepository(db).findCustomerContext(
      "tenant-1",
      "pelanggan-1",
    );

    expect(db.pelanggan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          reseller: { select: { status: true, statusChangedAt: true } },
        }),
      }),
    );
    expect(context).toMatchObject({
      resellerStatus: "SUSPENDED",
      resellerStatusChangedAt: changedAt,
    });
  });

  // Audit #15: unique (tenantId, invoiceId) mencakup baris soft-deleted.
  it("counts soft-deleted commissions in the idempotency check", async () => {
    const db = createDb();

    await createRepository(db).findCommissionByInvoiceId(
      "tenant-1",
      "invoice-1",
    );

    expect(db.resellerCommission.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", invoiceId: "invoice-1" },
    });
  });

  it("treats a duplicate commission insert as already done", async () => {
    const db = createDb();
    db.resellerCommission.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await createRepository(db).createCommission(COMMISSION_DATA);

    expect(result).toBeNull();
  });

  // Reviewer: unique (tenantId, invoiceId) tidak menahan duplikat saat
  // tenantId NULL, jadi cek-dan-insert diserialkan per invoice.
  it("re-checks for an existing commission under a per-invoice lock", async () => {
    const db = createDb();
    db.resellerCommission.findFirst.mockResolvedValueOnce({ id: "c-lain" });

    const result = await createRepository(db).createCommission({
      ...COMMISSION_DATA,
      tenantId: null,
    });

    expect(result).toBeNull();
    const [sql, lockKey] = db.$executeRaw.mock.calls[0] ?? [];
    expect((sql as TemplateStringsArray).join("?")).toContain(
      "pg_advisory_xact_lock",
    );
    expect(lockKey).toBe("reseller-commission:invoice-1");
    expect(db.resellerCommission.findFirst).toHaveBeenCalledWith({
      where: { tenantId: null, invoiceId: "invoice-1" },
      select: { id: true },
    });
    expect(db.resellerCommission.create).not.toHaveBeenCalled();
  });

  it("restores only a cancelled, unsettled accrued commission", async () => {
    const db = createDb();
    db.resellerCommission.updateMany.mockResolvedValueOnce({ count: 1 });
    db.resellerCommission.findFirst.mockResolvedValueOnce({ id: "c-1" });

    const restored = await createRepository(db).restoreCancelledCommission({
      commissionId: "c-1",
      accruedAt: new Date("2026-08-02T00:00:00.000Z"),
      period: "2026-08",
    });

    expect(restored).toEqual({ id: "c-1" });
    expect(db.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: {
        id: "c-1",
        status: "ACCRUED",
        settlementId: null,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
        accruedAt: new Date("2026-08-02T00:00:00.000Z"),
        period: "2026-08",
      },
    });
  });

  it("still surfaces other insert failures", async () => {
    const db = createDb();
    db.resellerCommission.create.mockRejectedValueOnce(new Error("boom"));

    await expect(
      createRepository(db).createCommission(COMMISSION_DATA),
    ).rejects.toThrow("boom");
  });

  // Audit #4/#12: klaim hanya mengambil komisi yang masih ACCRUED.
  it("claims only commissions still accrued and unsettled", async () => {
    const db = createDb();
    db.resellerCommission.findMany.mockResolvedValueOnce([
      { id: "c-1", commissionAmount: 20000 },
      { id: "c-2", commissionAmount: 30000 },
    ]);
    db.resellerCommission.updateMany.mockResolvedValueOnce({ count: 2 });

    const outcome =
      await createRepository(db).createSettlement(SETTLEMENT_INPUT);

    expect(outcome.kind).toBe("settled");
    expect(db.resellerSettlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ totalAmount: 50000, commissionCount: 2 }),
    });
    expect(db.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["c-1", "c-2"] },
        status: "ACCRUED",
        settlementId: null,
        deletedAt: null,
      },
      data: expect.objectContaining({
        status: "SETTLED",
        settlementId: "settlement-1",
      }),
    });
  });

  it("rolls back when a concurrent settlement claimed some commissions", async () => {
    const db = createDb();
    db.resellerCommission.findMany.mockResolvedValueOnce([
      { id: "c-1", commissionAmount: 20000 },
      { id: "c-2", commissionAmount: 30000 },
    ]);
    // Transaksi lain sudah men-settle c-2 sebelum klaim ini dievaluasi ulang.
    db.resellerCommission.updateMany.mockResolvedValueOnce({ count: 1 });

    const outcome =
      await createRepository(db).createSettlement(SETTLEMENT_INPUT);

    expect(outcome).toEqual({ kind: "conflict" });
  });

  it("reports an empty period without creating a settlement", async () => {
    const db = createDb();
    db.resellerCommission.findMany.mockResolvedValueOnce([]);

    const outcome =
      await createRepository(db).createSettlement(SETTLEMENT_INPUT);

    expect(outcome).toEqual({ kind: "empty" });
    expect(db.resellerSettlement.create).not.toHaveBeenCalled();
  });

  // Audit #13: void hanya menghapus komisi yang belum disettle, idempoten.
  it("cancels only accrued, unsettled commissions of a voided invoice", async () => {
    const db = createDb();
    const accrued = { id: "commission-1", deletedAt: null as Date | null };
    db.resellerCommission.findMany.mockResolvedValueOnce([accrued]);
    db.resellerCommission.updateMany.mockResolvedValueOnce({ count: 1 });

    const cancelled = await createRepository(db).cancelAccruedByInvoiceId({
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
    });

    expect(cancelled).toEqual([
      { id: "commission-1", deletedAt: expect.any(Date) },
    ]);
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.resellerCommission.findMany).toHaveBeenCalledWith({
      where: {
        invoiceId: "invoice-1",
        tenantId: "tenant-1",
        status: "ACCRUED",
        settlementId: null,
        deletedAt: null,
      },
    });
    expect(db.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: { id: "commission-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  // Pembatalan yang berlomba: baris yang sudah diklaim pembatalan lain tidak
  // dilaporkan dua kali, jadi jurnal akrunya tidak dibalik dua kali.
  it("does not report a commission another cancellation already claimed", async () => {
    const db = createDb();
    db.resellerCommission.findMany.mockResolvedValueOnce([
      { id: "commission-1", deletedAt: null as Date | null },
    ]);
    db.resellerCommission.updateMany.mockResolvedValueOnce({ count: 0 });

    const cancelled = await createRepository(db).cancelAccruedByInvoiceId({
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
    });

    expect(cancelled).toEqual([]);
  });
});
