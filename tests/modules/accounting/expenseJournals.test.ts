import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  expenseFindUnique: vi.fn(),
  categoryFindUnique: vi.fn(),
  journalFindMany: vi.fn(),
  postAuto: vi.fn(),
  reverse: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    expense: { findUnique: palsu.expenseFindUnique },
    expenseCategory: { findUnique: palsu.categoryFindUnique },
    journalEntry: { findMany: palsu.journalFindMany },
    financialAccount: {
      findUnique: async () => ({ coaId: "coa-bri" }),
    },
    chartOfAccount: {
      findUnique: async (args: {
        where: { tenantId_code: { code: string } };
      }) => ({ id: `coa-${args.where.tenantId_code.code}` }),
    },
  },
}));
vi.mock("@/modules/accounting/services/journal/auto-posting", () => ({
  autoPostingService: () => ({ postAuto: palsu.postAuto }),
  journalReverseService: () => ({ reverse: palsu.reverse }),
  ensurePeriod: vi.fn(),
}));
vi.mock(
  "@/modules/accounting/services/event-handlers/coa-mapping-config",
  () => ({
    getCoaCode: async (_tenantId: string, purpose: string) =>
      ({ KAS_UTAMA: "1-110", BANK_UTAMA: "1-120", BEBAN_LAINNYA: "5-500" })[
        purpose
      ],
  }),
);

import {
  postExpenseJournal,
  resyncExpenseJournal,
} from "@/modules/accounting/services/journal/expense-journals";

const expense = {
  amount: 50000n,
  date: new Date("2026-10-10T00:00:00Z"),
  accountId: null as string | null,
  expenseCategoryId: null as string | null,
  description: "Token listrik",
  category: "OPEX",
};

describe("jurnal pengeluaran", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.expenseFindUnique.mockResolvedValue(expense);
    palsu.categoryFindUnique.mockResolvedValue({ coaId: "coa-listrik" });
  });

  // Dulu pengeluaran tanpa rekening tidak berjurnal dan tak tampil di arus kas.
  it("pengeluaran tanpa rekening mengurangi Kas", async () => {
    await postExpenseJournal("t1", "exp-1");

    expect(palsu.postAuto.mock.calls[0][1]).toMatchObject({
      source: "AUTO_EXPENSE",
      sourceRefId: "exp-1",
      lines: [
        { coaId: "coa-5-500", side: "DEBIT", amount: "50000" },
        { coaId: "coa-1-110", side: "CREDIT", amount: "50000" },
      ],
    });
  });

  it("memakai beban kategori dan COA rekening yang dipilih", async () => {
    palsu.expenseFindUnique.mockResolvedValue({
      ...expense,
      accountId: "acc-bri",
      expenseCategoryId: "cat-listrik",
    });

    await postExpenseJournal("t1", "exp-1");

    expect(palsu.postAuto.mock.calls[0][1].lines).toEqual([
      { coaId: "coa-listrik", side: "DEBIT", amount: "50000" },
      { coaId: "coa-bri", side: "CREDIT", amount: "50000" },
    ]);
  });

  it("pengeluaran yang diubah: jurnal lama dibalik, yang baru memakai kunci baru", async () => {
    palsu.journalFindMany.mockResolvedValue([
      { id: "je-1", status: "REVERSED" },
      { id: "je-2", status: "POSTED" },
    ]);

    await resyncExpenseJournal({
      tenantId: "t1",
      expenseId: "exp-1",
      reason: "Pengeluaran diubah",
      actor: "Sistem",
    });

    expect(palsu.reverse).toHaveBeenCalledTimes(1);
    expect(palsu.reverse).toHaveBeenCalledWith(
      "je-2",
      "Pengeluaran diubah",
      "Sistem",
    );
    expect(palsu.postAuto.mock.calls[0][1].sourceRefId).toBe("exp-1:2");
  });

  // Bila jurnal baru gagal diposting, jurnal lama harus tetap berdiri;
  // kalau tidak, pengeluaran hilang dari pembukuan dan edit berikutnya
  // tidak lagi menemukan jurnal aktif untuk disamakan.
  it("jurnal lama tidak dibalik bila jurnal baru gagal diposting", async () => {
    palsu.journalFindMany.mockResolvedValue([{ id: "je-1", status: "POSTED" }]);
    palsu.postAuto.mockRejectedValueOnce(new Error("periode tertutup"));

    await expect(
      resyncExpenseJournal({
        tenantId: "t1",
        expenseId: "exp-1",
        reason: "Pengeluaran diubah",
        actor: "Sistem",
      }),
    ).rejects.toThrow("periode tertutup");
    expect(palsu.reverse).not.toHaveBeenCalled();
  });

  // Dulu pengeluaran yang dihapus tetap tercatat sebagai uang keluar.
  it("pengeluaran yang dihapus hanya dibalik jurnalnya", async () => {
    palsu.journalFindMany.mockResolvedValue([{ id: "je-1", status: "POSTED" }]);
    palsu.expenseFindUnique.mockResolvedValue(null);

    await resyncExpenseJournal({
      tenantId: "t1",
      expenseId: "exp-1",
      reason: "Pengeluaran dihapus",
      actor: "Sistem",
    });

    expect(palsu.reverse).toHaveBeenCalledWith(
      "je-1",
      "Pengeluaran dihapus",
      "Sistem",
    );
    expect(palsu.postAuto).not.toHaveBeenCalled();
  });

  // Pengeluaran dari PO, aset, dan penyusutan punya jurnalnya sendiri.
  it("tidak menjurnal pengeluaran yang tidak pernah dijurnal di sini", async () => {
    palsu.journalFindMany.mockResolvedValue([]);

    const synced = await resyncExpenseJournal({
      tenantId: "t1",
      expenseId: "exp-po",
      reason: "Pengeluaran diubah",
      actor: "Sistem",
    });

    expect(synced).toBe(false);
    expect(palsu.postAuto).not.toHaveBeenCalled();
  });
});
