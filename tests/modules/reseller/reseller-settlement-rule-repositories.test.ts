import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ResellerSettlementRepository } from "@/modules/reseller/repositories/ResellerSettlementRepository";
import { ResellerCommissionRuleRepository } from "@/modules/reseller/repositories/ResellerCommissionRuleRepository";

/** Bentuk query penjaga uang: transisi bersyarat status dan filter tenant. */

function createDb() {
  const resellerSettlement = {
    findFirst: vi.fn().mockResolvedValue({ id: "settlement-1" }),
    findFirstOrThrow: vi
      .fn()
      .mockResolvedValue({ id: "settlement-1", totalAmount: 50000 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const resellerCommission = { updateMany: vi.fn() };
  const financialAccount = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const db = {
    resellerSettlement,
    resellerCommission,
    resellerCommissionRule: { findFirst: vi.fn() },
    financialAccount,
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
      run({ resellerSettlement, resellerCommission, financialAccount }),
    ),
  };
  return db;
}

const asPrisma = (db: ReturnType<typeof createDb>) =>
  db as unknown as PrismaClient;

describe("ResellerSettlementRepository", () => {
  it("menyetujui hanya settlement yang masih PENDING", async () => {
    const db = createDb();
    const at = new Date("2026-11-03T00:00:00.000Z");

    await new ResellerSettlementRepository(asPrisma(db)).approve({
      settlementId: "settlement-1",
      approvedAt: at,
      approvedById: "user-1",
    });

    expect(db.resellerSettlement.updateMany).toHaveBeenCalledWith({
      where: { id: "settlement-1", status: "PENDING", deletedAt: null },
      data: { status: "APPROVED", approvedAt: at, approvedById: "user-1" },
    });
  });

  it("mengembalikan null bila status asal sudah berubah", async () => {
    const db = createDb();
    db.resellerSettlement.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await new ResellerSettlementRepository(
      asPrisma(db),
    ).markPaid({
      tenantId: "tenant-1",
      settlementId: "settlement-1",
      paidAt: new Date(),
      paidById: null,
      paymentMethod: "CASH",
      paymentReference: null,
      paymentAccountId: "account-1",
    });

    expect(result).toEqual({ kind: "status-changed" });
    expect(db.resellerCommission.updateMany).not.toHaveBeenCalled();
    expect(db.financialAccount.updateMany).not.toHaveBeenCalled();
  });

  it("membayar settlement APPROVED dan komisinya dalam satu transaksi", async () => {
    const db = createDb();
    const paidAt = new Date("2026-11-03T00:00:00.000Z");

    const result = await new ResellerSettlementRepository(
      asPrisma(db),
    ).markPaid({
      tenantId: "tenant-1",
      settlementId: "settlement-1",
      paidAt,
      paidById: "user-1",
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "TRX-1",
      paymentAccountId: "account-1",
    });

    expect(db.$transaction).toHaveBeenCalled();
    expect(db.resellerSettlement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "settlement-1", status: "APPROVED", deletedAt: null },
      }),
    );
    expect(db.resellerCommission.updateMany).toHaveBeenCalledWith({
      where: { settlementId: "settlement-1", status: "SETTLED" },
      data: { status: "PAID", paidAt },
    });
    expect(result).toEqual({
      kind: "paid",
      settlement: { id: "settlement-1", totalAmount: 50000 },
    });
  });

  // Reviewer: saldo Kas & Bank harus ikut berkurang seperti pembayaran PO,
  // supaya tidak berbeda dari jurnal GL (Cr Kas/Bank).
  it("mengurangi saldo rekening tenant sebesar total settlement, dijaga saldo cukup", async () => {
    const db = createDb();

    await new ResellerSettlementRepository(asPrisma(db)).markPaid({
      tenantId: "tenant-1",
      settlementId: "settlement-1",
      paidAt: new Date("2026-11-03T00:00:00.000Z"),
      paidById: "user-1",
      paymentMethod: "CASH",
      paymentReference: null,
      paymentAccountId: "account-1",
    });

    expect(db.financialAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: "account-1",
        tenantId: "tenant-1",
        isActive: true,
        balance: { gte: 50000 },
      },
      data: { balance: { decrement: 50000 } },
    });
  });

  it("membatalkan transaksi bila saldo rekening kurang", async () => {
    const db = createDb();
    db.financialAccount.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await new ResellerSettlementRepository(
      asPrisma(db),
    ).markPaid({
      tenantId: "tenant-1",
      settlementId: "settlement-1",
      paidAt: new Date("2026-11-03T00:00:00.000Z"),
      paidById: "user-1",
      paymentMethod: "CASH",
      paymentReference: null,
      paymentAccountId: "account-1",
    });

    expect(result).toEqual({ kind: "insufficient-balance" });
    expect(db.resellerCommission.updateMany).not.toHaveBeenCalled();
  });

  it("hanya menerima rekening aktif milik tenant", async () => {
    const db = createDb();

    const exists = await new ResellerSettlementRepository(
      asPrisma(db),
    ).paymentAccountExists("tenant-1", "account-1");

    expect(exists).toBe(false);
    expect(db.financialAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "account-1", tenantId: "tenant-1", isActive: true },
      select: { id: true },
    });
  });
});

describe("ResellerSettlementRepository.listPaymentAccounts", () => {
  it("hanya rekening aktif milik tenant", async () => {
    const db = createDb();

    await new ResellerSettlementRepository(asPrisma(db)).listPaymentAccounts(
      "tenant-1",
    );

    expect(db.financialAccount.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", isActive: true },
      select: { id: true, name: true, type: true, balance: true },
      orderBy: { name: "asc" },
    });
  });
});

describe("ResellerCommissionRuleRepository.findOverlappingActiveRule", () => {
  it("mencari aturan aktif reseller+paket yang rentangnya beririsan", async () => {
    const db = createDb();
    const startsAt = new Date("2026-11-01T00:00:00.000Z");
    const endsAt = new Date("2026-12-31T00:00:00.000Z");

    await new ResellerCommissionRuleRepository(
      asPrisma(db),
    ).findOverlappingActiveRule({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: null,
      startsAt,
      endsAt,
      excludeRuleId: "rule-1",
    });

    expect(db.resellerCommissionRule.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        hargaPaketId: null,
        status: "ACTIVE",
        deletedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }],
        startsAt: { lte: endsAt },
        id: { not: "rule-1" },
      },
    });
  });

  it("tanpa tanggal akhir, semua aturan yang belum berakhir dianggap beririsan", async () => {
    const db = createDb();
    const startsAt = new Date("2026-11-01T00:00:00.000Z");

    await new ResellerCommissionRuleRepository(
      asPrisma(db),
    ).findOverlappingActiveRule({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      startsAt,
      endsAt: null,
    });

    const where = db.resellerCommissionRule.findFirst.mock.calls[0][0].where;
    expect(where.startsAt).toBeUndefined();
    expect(where.hargaPaketId).toBe("package-1");
  });
});

describe("ResellerCommissionRuleRepository.runExclusive", () => {
  it("memegang kunci advisory per tenant+reseller+paket dalam satu transaksi", async () => {
    const executeRaw = vi.fn();
    const tx = { $executeRaw: executeRaw, resellerCommissionRule: {} };
    const root = {
      $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) =>
        run(tx),
      ),
    } as unknown as PrismaClient;

    const result = await new ResellerCommissionRuleRepository(
      root,
      root,
    ).runExclusive(
      { tenantId: "tenant-1", resellerId: "reseller-1", hargaPaketId: null },
      async (repository) => {
        expect(repository).toBeInstanceOf(ResellerCommissionRuleRepository);
        return "done";
      },
    );

    expect(result).toBe("done");
    expect(root.$transaction).toHaveBeenCalledTimes(1);
    const [strings, lockKey] = executeRaw.mock.calls[0];
    expect((strings as string[]).join("?")).toContain("pg_advisory_xact_lock");
    expect(lockKey).toBe("reseller-commission-rule:tenant-1:reseller-1:");
  });
});
