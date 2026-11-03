import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  postResellerCommissionAccrual,
  postResellerSettlementPayment,
  reverseResellerCommissionAccrual,
  type CommissionAccrualState,
  type ResellerCommissionJournalDeps,
} from "@/modules/accounting/services/journal/reseller-commission-journals";
import { ensureDefaultAccounts } from "@/modules/accounting/services/coa/ensure-default-accounts";
import {
  AccountingError,
  CoaNotFoundError,
  JournalAlreadyReversedError,
  PeriodClosedError,
} from "@/modules/accounting/errors";
import type { ChartOfAccount } from "@/modules/accounting/domain/entities/ChartOfAccount";
import type { IChartOfAccountRepository } from "@/modules/accounting/domain/ports/IChartOfAccountRepository";
import type { JournalEntry } from "@/modules/accounting/domain/entities/JournalEntry";

/**
 * Komisi reseller (model agen) dibukukan sebagai beban & utang. Tidak satu pun
 * jurnalnya boleh menyentuh akun REVENUE, karena basis BHP/USO adalah jumlah
 * kredit akun REVENUE dan harus tetap tagihan bruto.
 */

function account(
  code: string,
  type: ChartOfAccount["type"],
  overrides: Partial<ChartOfAccount> = {},
): ChartOfAccount {
  return {
    id: `coa-${code}`,
    tenantId: "tenant-1",
    code,
    name: code,
    type,
    subtype: null,
    normalSide: type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT",
    cashFlowCategory: null,
    parentId: null,
    isPostable: true,
    isSystem: true,
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createCoaRepo(accounts: ChartOfAccount[]): IChartOfAccountRepository {
  const byCode = new Map(accounts.map((entry) => [entry.code, entry]));
  return {
    create: vi.fn(async (input) => {
      const created = account(input.code, input.type);
      byCode.set(input.code, created);
      return created;
    }),
    update: vi.fn(),
    findById: vi.fn(
      async (id: string) =>
        [...byCode.values()].find((entry) => entry.id === id) ?? null,
    ),
    findByCode: vi.fn(
      async (_tenantId: string, code: string) => byCode.get(code) ?? null,
    ),
    list: vi.fn(),
    delete: vi.fn(),
    deleteSystemAccounts: vi.fn(),
    countChildren: vi.fn(),
    countLines: vi.fn(),
    getAccountBalances: vi.fn(),
  } as unknown as IChartOfAccountRepository;
}

const SEEDED = [
  account("2-000", "LIABILITY", { isPostable: false }),
  account("5-000", "EXPENSE", { isPostable: false }),
  account("1-110", "ASSET"),
  account("1-120", "ASSET"),
  account("2-370", "LIABILITY"),
  account("5-820", "EXPENSE"),
];

function createDeps(
  accounts: ChartOfAccount[] = SEEDED,
): ResellerCommissionJournalDeps {
  return {
    coaRepo: createCoaRepo(accounts),
    journalRepo: { findBySource: vi.fn().mockResolvedValue(null) },
    posting: { postAuto: vi.fn() },
    reverser: { reverse: vi.fn() },
    ensurePeriod: vi.fn(),
    findPaymentAccount: vi
      .fn()
      .mockResolvedValue({ coaId: "coa-1-120", type: "BANK" }),
    findCommission: vi.fn().mockResolvedValue(ACTIVE_COMMISSION),
    listSettlementCommissions: vi.fn().mockResolvedValue([]),
    now: () => NOW,
  };
}

const NOW = new Date("2026-11-03T05:00:00.000Z");

const ACCRUAL = {
  tenantId: "tenant-1",
  commissionId: "commission-1",
  accrualRef: "commission-1:2026-10-05T00:00:00.000Z",
  invoiceId: "invoice-1",
  amount: 10000,
  accruedAt: new Date("2026-10-05T00:00:00.000Z"),
};

const ACTIVE_COMMISSION: CommissionAccrualState = {
  id: "commission-1",
  invoiceId: "invoice-1",
  commissionAmount: 10000,
  accruedAt: ACCRUAL.accruedAt,
  deletedAt: null,
};

describe("postResellerCommissionAccrual", () => {
  it("Dr Beban Komisi Reseller / Cr Utang Komisi Reseller, idempoten per ref", async () => {
    const deps = createDeps();

    await postResellerCommissionAccrual(ACCRUAL, deps);

    expect(deps.ensurePeriod).toHaveBeenCalledWith(
      "tenant-1",
      ACCRUAL.accruedAt,
    );
    expect(deps.posting.postAuto).toHaveBeenCalledWith("tenant-1", {
      source: "AUTO_RESELLER_COMMISSION",
      sourceRefType: "ResellerCommission",
      sourceRefId: ACCRUAL.accrualRef,
      entryDate: ACCRUAL.accruedAt,
      description: "Akru komisi reseller atas invoice invoice-1",
      lines: [
        { coaId: "coa-5-820", side: "DEBIT", amount: "10000" },
        { coaId: "coa-2-370", side: "CREDIT", amount: "10000" },
      ],
    });
  });

  it("membuat akun beban & utang komisi di COA tenant lama yang belum punya", async () => {
    const legacy = SEEDED.filter(
      (entry) => entry.code !== "2-370" && entry.code !== "5-820",
    );
    const deps = createDeps(legacy);

    await postResellerCommissionAccrual(ACCRUAL, deps);

    expect(deps.coaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "5-820",
        name: "Beban Komisi Reseller",
        type: "EXPENSE",
        parentId: "coa-5-000",
        tenantId: "tenant-1",
      }),
    );
    expect(deps.coaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "2-370",
        name: "Utang Komisi Reseller",
        type: "LIABILITY",
        parentId: "coa-2-000",
      }),
    );
    expect(deps.posting.postAuto).toHaveBeenCalled();
  });

  it("tidak pernah mendebit akun REVENUE (basis BHP/USO tetap bruto)", async () => {
    const tampered = SEEDED.map((entry) =>
      entry.code === "5-820" ? { ...entry, type: "REVENUE" as const } : entry,
    );
    const deps = createDeps(tampered);

    await expect(postResellerCommissionAccrual(ACCRUAL, deps)).rejects.toThrow(
      AccountingError,
    );
    expect(deps.posting.postAuto).not.toHaveBeenCalled();
  });

  it("melempar CoaNotFoundError untuk tenant yang COA-nya belum di-seed", async () => {
    const deps = createDeps([]);

    await expect(
      postResellerCommissionAccrual(ACCRUAL, deps),
    ).rejects.toBeInstanceOf(CoaNotFoundError);
  });

  it("melewati komisi nol", async () => {
    const deps = createDeps();

    expect(
      await postResellerCommissionAccrual({ ...ACCRUAL, amount: 0 }, deps),
    ).toBe(false);
    expect(deps.posting.postAuto).not.toHaveBeenCalled();
  });
});

describe("reverseResellerCommissionAccrual", () => {
  const CANCEL = {
    tenantId: "tenant-1",
    accrualRef: ACCRUAL.accrualRef,
    invoiceId: "invoice-1",
  };

  it("membalik jurnal akru yang masih POSTED", async () => {
    const deps = createDeps();
    vi.mocked(deps.journalRepo.findBySource).mockResolvedValueOnce({
      id: "journal-1",
      status: "POSTED",
    } as JournalEntry);

    expect(await reverseResellerCommissionAccrual(CANCEL, deps)).toBe(true);
    expect(deps.journalRepo.findBySource).toHaveBeenCalledWith(
      "tenant-1",
      "AUTO_RESELLER_COMMISSION",
      ACCRUAL.accrualRef,
    );
    expect(deps.reverser.reverse).toHaveBeenCalledWith(
      "journal-1",
      expect.stringContaining("invoice-1"),
      "system",
    );
  });

  it("idempoten: jurnal yang sudah dibalik tidak dibalik lagi", async () => {
    const deps = createDeps();
    vi.mocked(deps.journalRepo.findBySource).mockResolvedValueOnce({
      id: "journal-1",
      status: "REVERSED",
    } as JournalEntry);

    expect(await reverseResellerCommissionAccrual(CANCEL, deps)).toBe(false);
    expect(deps.reverser.reverse).not.toHaveBeenCalled();
  });

  it("tidak melempar bila pembatalan tiba sebelum jurnal akru (akru memeriksa ulang)", async () => {
    const deps = createDeps();

    expect(await reverseResellerCommissionAccrual(CANCEL, deps)).toBe(false);
    expect(deps.reverser.reverse).not.toHaveBeenCalled();
  });

  it("menganggap pembalikan yang kalah balapan sebagai sudah dibalik", async () => {
    const deps = createDeps();
    vi.mocked(deps.journalRepo.findBySource).mockResolvedValueOnce({
      id: "journal-1",
      status: "POSTED",
    } as JournalEntry);
    vi.mocked(deps.reverser.reverse).mockRejectedValueOnce(
      new JournalAlreadyReversedError("JE-1"),
    );

    expect(await reverseResellerCommissionAccrual(CANCEL, deps)).toBe(false);
  });
});

describe("postResellerCommissionAccrual — keadaan komisi", () => {
  it("melewati akrual yang komisinya sudah dibatalkan saat job diproses", async () => {
    const deps = createDeps();
    vi.mocked(deps.findCommission).mockResolvedValue({
      ...ACTIVE_COMMISSION,
      deletedAt: new Date("2026-10-06T00:00:00.000Z"),
    });

    expect(await postResellerCommissionAccrual(ACCRUAL, deps)).toBe(false);
    expect(deps.posting.postAuto).not.toHaveBeenCalled();
  });

  it("melewati ref akrual lama dari komisi yang sudah dipulihkan (accruedAt baru)", async () => {
    const deps = createDeps();
    vi.mocked(deps.findCommission).mockResolvedValue({
      ...ACTIVE_COMMISSION,
      accruedAt: new Date("2026-10-20T00:00:00.000Z"),
    });

    expect(await postResellerCommissionAccrual(ACCRUAL, deps)).toBe(false);
    expect(deps.posting.postAuto).not.toHaveBeenCalled();
  });

  it("membalik akru yang komisinya batal tepat saat posting", async () => {
    const deps = createDeps();
    vi.mocked(deps.findCommission)
      .mockResolvedValueOnce(ACTIVE_COMMISSION)
      .mockResolvedValueOnce({ ...ACTIVE_COMMISSION, deletedAt: NOW });
    vi.mocked(deps.journalRepo.findBySource).mockResolvedValueOnce({
      id: "journal-1",
      status: "POSTED",
    } as JournalEntry);

    expect(await postResellerCommissionAccrual(ACCRUAL, deps)).toBe(true);
    expect(deps.posting.postAuto).toHaveBeenCalledTimes(1);
    expect(deps.reverser.reverse).toHaveBeenCalledWith(
      "journal-1",
      expect.any(String),
      "system",
    );
  });

  it("menyusulkan akru ke periode berjalan bila periode akru sudah ditutup", async () => {
    const deps = createDeps();
    vi.mocked(deps.posting.postAuto)
      .mockRejectedValueOnce(new PeriodClosedError(2026, 10))
      .mockResolvedValueOnce({} as JournalEntry);

    await postResellerCommissionAccrual(ACCRUAL, deps);

    const second = vi.mocked(deps.posting.postAuto).mock.calls[1][1];
    expect(second.entryDate).toEqual(NOW);
    expect(second.sourceRefId).toBe(ACCRUAL.accrualRef);
    expect(second.description).toContain("susulan");
  });
});

describe("postResellerSettlementPayment", () => {
  const PAYMENT = {
    tenantId: "tenant-1",
    settlementId: "settlement-1",
    amount: 50000,
    paidAt: new Date("2026-11-03T00:00:00.000Z"),
    accountId: "account-1",
  };

  it("Dr Utang Komisi Reseller / Cr COA rekening terpilih", async () => {
    const deps = createDeps();

    await postResellerSettlementPayment(PAYMENT, deps);

    expect(deps.findPaymentAccount).toHaveBeenCalledWith(
      "tenant-1",
      "account-1",
    );
    expect(deps.posting.postAuto).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        source: "AUTO_RESELLER_SETTLEMENT_PAID",
        sourceRefId: "settlement-1",
        entryDate: PAYMENT.paidAt,
        lines: [
          { coaId: "coa-2-370", side: "DEBIT", amount: "50000" },
          { coaId: "coa-1-120", side: "CREDIT", amount: "50000" },
        ],
      }),
    );
  });

  it("rekening tunai tanpa COA memakai Kas Utama", async () => {
    const deps = createDeps();
    vi.mocked(deps.findPaymentAccount).mockResolvedValueOnce({
      coaId: null,
      type: "CASH",
    });

    await postResellerSettlementPayment(PAYMENT, deps);

    const lines = vi.mocked(deps.posting.postAuto).mock.calls[0][1].lines;
    expect(lines[1]).toEqual({
      coaId: "coa-1-110",
      side: "CREDIT",
      amount: "50000",
    });
  });

  it("menolak rekening tenant lain", async () => {
    const deps = createDeps();
    vi.mocked(deps.findPaymentAccount).mockResolvedValueOnce(null);

    await expect(postResellerSettlementPayment(PAYMENT, deps)).rejects.toThrow(
      AccountingError,
    );
    expect(deps.posting.postAuto).not.toHaveBeenCalled();
  });

  it("menolak COA rekening yang bukan aset", async () => {
    const deps = createDeps([...SEEDED, account("4-100", "REVENUE")]);
    vi.mocked(deps.findPaymentAccount).mockResolvedValueOnce({
      coaId: "coa-4-100",
      type: "BANK",
    });

    await expect(postResellerSettlementPayment(PAYMENT, deps)).rejects.toThrow(
      AccountingError,
    );
  });
});

describe("postResellerSettlementPayment — akru susulan", () => {
  const PAYMENT = {
    tenantId: "tenant-1",
    settlementId: "settlement-1",
    amount: 10000,
    paidAt: new Date("2026-11-03T00:00:00.000Z"),
    accountId: "account-1",
  };

  it("menyusulkan jurnal akru komisi sebelum mendebit utang, dengan ref yang sama", async () => {
    const deps = createDeps();
    vi.mocked(deps.listSettlementCommissions).mockResolvedValueOnce([
      ACTIVE_COMMISSION,
    ]);

    await postResellerSettlementPayment(PAYMENT, deps);

    const calls = vi
      .mocked(deps.posting.postAuto)
      .mock.calls.map(([, params]) => params);
    expect(calls.map((params) => params.source)).toEqual([
      "AUTO_RESELLER_COMMISSION",
      "AUTO_RESELLER_SETTLEMENT_PAID",
    ]);
    expect(calls[0]).toMatchObject({
      sourceRefId: ACCRUAL.accrualRef,
      entryDate: ACCRUAL.accruedAt,
      lines: [
        { coaId: "coa-5-820", side: "DEBIT", amount: "10000" },
        { coaId: "coa-2-370", side: "CREDIT", amount: "10000" },
      ],
    });
    expect(deps.listSettlementCommissions).toHaveBeenCalledWith(
      "tenant-1",
      "settlement-1",
    );
  });

  it("akru susulan di periode tertutup memakai tanggal bayar", async () => {
    const deps = createDeps();
    vi.mocked(deps.listSettlementCommissions).mockResolvedValueOnce([
      ACTIVE_COMMISSION,
    ]);
    vi.mocked(deps.posting.postAuto).mockRejectedValueOnce(
      new PeriodClosedError(2026, 10),
    );

    await postResellerSettlementPayment(PAYMENT, deps);

    const calls = vi.mocked(deps.posting.postAuto).mock.calls;
    expect(calls[1][1]).toMatchObject({
      source: "AUTO_RESELLER_COMMISSION",
      entryDate: PAYMENT.paidAt,
    });
    expect(calls[2][1].source).toBe("AUTO_RESELLER_SETTLEMENT_PAID");
  });
});

describe("ensureDefaultAccounts", () => {
  let coaRepo: IChartOfAccountRepository;

  beforeEach(() => {
    coaRepo = createCoaRepo([account("5-000", "EXPENSE")]);
  });

  it("tidak membuat akun yang sudah ada", async () => {
    await ensureDefaultAccounts(coaRepo, "tenant-1", ["5-000"]);
    expect(coaRepo.create).not.toHaveBeenCalled();
  });

  it("menganggap unique violation sebagai akun yang dibuat job lain", async () => {
    vi.mocked(coaRepo.create).mockRejectedValueOnce(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );

    await expect(
      ensureDefaultAccounts(coaRepo, "tenant-1", ["5-820"]),
    ).resolves.toBeUndefined();
  });

  it("menolak kode yang tidak ada di COA default", async () => {
    await expect(
      ensureDefaultAccounts(coaRepo, "tenant-1", ["9-999"]),
    ).rejects.toMatchObject({ code: "COA_TEMPLATE_NOT_FOUND" });
  });
});
