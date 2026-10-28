import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/modules/accounting", () => ({
  getChartOfAccountService: () => ({
    findById: async (id: string) => ({
      id,
      tenantId: "t1",
      code: "1-121",
      isPostable: true,
      isActive: true,
    }),
  }),
  postAccountOpeningJournal: vi.fn(),
  postTreasuryTransferJournal: vi.fn(),
}));

import { FinanceAccountFacadeService } from "@/modules/finance/services/FinanceAccountFacadeService";

const ACCOUNTS = {
  bca: { id: "bca", name: "BCA", coaId: "coa-bca", balance: 999 },
  duitku: { id: "duitku", name: "Saldo Duitku", coaId: "coa-gw", balance: 0 },
  laci: {
    id: "laci",
    name: "Laci kasir",
    coaId: null as string | null,
    balance: 150_000,
  },
};

function setup(balances: Record<string, number>) {
  const repo = {
    findActive: vi.fn().mockResolvedValue(Object.values(ACCOUNTS)),
    findById: vi.fn(
      async (id: string) => ACCOUNTS[id as keyof typeof ACCOUNTS] ?? null,
    ),
    create: vi.fn(async (data: object) => ({ id: "baru", ...data })),
    update: vi.fn(),
    transferBetweenAccounts: vi.fn().mockResolvedValue({ success: true }),
    recordTransferMutation: vi.fn().mockResolvedValue({ id: "mut-1" }),
    deleteTransferMutation: vi.fn(),
    findRecentMutations: vi.fn(),
  };
  const ledger = {
    getBalances: vi.fn(
      async (_tenantId: string, ids: string[]) =>
        new Map(ids.map((id) => [id, balances[id] ?? 0])),
    ),
    postTransfer: vi.fn(),
    postOpening: vi.fn(),
  };
  const service = new FinanceAccountFacadeService(
    repo as never,
    ledger as never,
    async () => "t1",
  );
  return { repo, ledger, service };
}

const TRANSFER = {
  sourceAccountId: "duitku",
  destinationAccountId: "bca",
  amount: 11_022,
  date: "2026-10-28",
  description: "Pencairan Duitku",
  createdById: "admin-1",
};

/**
 * Saldo Kas & Bank dulu angka tersimpan yang tidak bergerak saat pelanggan
 * membayar, gaji dibayar, atau pengeluaran dicatat, sehingga tidak pernah
 * cocok dengan buku besar maupun arus kas.
 */
describe("Kas & Bank bersaldo jurnal", () => {
  it("rekening bertaut COA memakai saldo jurnal, tanpa COA tetap tersimpan", async () => {
    const { service } = setup({ "coa-bca": 100_000, "coa-gw": 11_022 });

    const accounts = await service.getAccounts();

    expect(accounts).toEqual([
      expect.objectContaining({
        id: "bca",
        balance: 100_000,
        balanceSource: "JOURNAL",
      }),
      expect.objectContaining({
        id: "duitku",
        balance: 11_022,
        balanceSource: "JOURNAL",
      }),
      expect.objectContaining({
        id: "laci",
        balance: 150_000,
        balanceSource: "STORED",
      }),
    ]);
  });

  it("pencairan gateway ke bank dijurnal, angka tersimpan tidak diubah", async () => {
    const { service, repo, ledger } = setup({ "coa-gw": 11_022 });

    await service.transferFunds(TRANSFER);

    expect(repo.transferBetweenAccounts).not.toHaveBeenCalled();
    expect(repo.recordTransferMutation).toHaveBeenCalled();
    expect(ledger.postTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        mutationId: "mut-1",
        amount: 11_022,
        sourceCoaId: "coa-gw",
        destinationCoaId: "coa-bca",
      }),
    );
  });

  it("saldo jurnal yang kurang menolak pindah dana", async () => {
    const { service, ledger } = setup({ "coa-gw": 5_000 });

    await expect(service.transferFunds(TRANSFER)).rejects.toThrow();
    expect(ledger.postTransfer).not.toHaveBeenCalled();
  });

  it("rekening bertaut COA tidak bisa dipindah ke/dari rekening tanpa COA", async () => {
    const { service, repo, ledger } = setup({});

    await expect(
      service.transferFunds({ ...TRANSFER, sourceAccountId: "laci" }),
    ).rejects.toThrow("tautkan kedua rekening");
    expect(repo.transferBetweenAccounts).not.toHaveBeenCalled();
    expect(ledger.postTransfer).not.toHaveBeenCalled();
  });

  it("jurnal yang gagal diposting tidak meninggalkan riwayat mutasi", async () => {
    const { service, repo, ledger } = setup({ "coa-gw": 11_022 });
    ledger.postTransfer.mockRejectedValue(new Error("periode tertutup"));

    await expect(service.transferFunds(TRANSFER)).rejects.toThrow(
      "periode tertutup",
    );
    expect(repo.deleteTransferMutation).toHaveBeenCalledWith("mut-1");
  });

  it("saldo awal rekening bertaut COA dicatat sebagai jurnal", async () => {
    const { service, ledger } = setup({});

    await service.createAccount({
      name: "Mandiri",
      type: "BANK",
      initialBalance: 500_000,
      coaId: "coa-mandiri",
      tenantId: "t1",
    });

    expect(ledger.postOpening).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        accountId: "baru",
        coaId: "coa-mandiri",
        amount: 500_000,
      }),
    );
  });
});
