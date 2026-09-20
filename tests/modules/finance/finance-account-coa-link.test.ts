import { beforeEach, describe, expect, it, vi } from "vitest";

const findById = vi.fn();

vi.mock("@/modules/accounting", () => ({
  getChartOfAccountService: () => ({ findById }),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { InvalidChartOfAccountError } from "@/modules/finance/domain/errors";
import { FinanceAccountFacadeService } from "@/modules/finance/services/FinanceAccountFacadeService";

/**
 * Tautan `financial_accounts.coaId` menentukan sisi kredit jurnal otomatis.
 * Kolomnya tidak punya foreign key, jadi kelayakan akun COA diperiksa di
 * service: harus ada, milik tenant yang sama, aktif, dan bisa diposting.
 * Akun header yang lolos ke sini akan membuat handler jurnal gagal diam-diam.
 */

const TENANT = "tenant-1";

function createService() {
  const repo = {
    findActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: "akun-1", coaId: "coa-1" }),
    transferBetweenAccounts: vi.fn(),
    findRecentMutations: vi.fn(),
  };
  return {
    repo,
    service: new FinanceAccountFacadeService(
      repo as unknown as ConstructorParameters<
        typeof FinanceAccountFacadeService
      >[0],
    ),
  };
}

const COA_LAYAK = {
  id: "coa-1",
  tenantId: TENANT,
  code: "1-120",
  name: "Bank",
  isPostable: true,
  isActive: true,
};

describe("menautkan akun kas ke COA", () => {
  beforeEach(() => {
    findById.mockReset();
  });

  it("menyimpan tautan bila akun COA layak", async () => {
    findById.mockResolvedValue(COA_LAYAK);
    const { service, repo } = createService();

    await service.updateAccount("akun-1", TENANT, { coaId: "coa-1" });

    expect(repo.update).toHaveBeenCalledWith("akun-1", { coaId: "coa-1" });
  });

  it("menolak akun COA yang tidak ada", async () => {
    findById.mockResolvedValue(null);
    const { service, repo } = createService();

    await expect(
      service.updateAccount("akun-1", TENANT, { coaId: "coa-hantu" }),
    ).rejects.toBeInstanceOf(InvalidChartOfAccountError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("menolak akun COA milik tenant lain", async () => {
    findById.mockResolvedValue({ ...COA_LAYAK, tenantId: "tenant-lain" });
    const { service, repo } = createService();

    await expect(
      service.updateAccount("akun-1", TENANT, { coaId: "coa-1" }),
    ).rejects.toBeInstanceOf(InvalidChartOfAccountError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("menolak akun header yang tidak bisa diposting", async () => {
    findById.mockResolvedValue({ ...COA_LAYAK, isPostable: false });
    const { service } = createService();

    await expect(
      service.updateAccount("akun-1", TENANT, { coaId: "coa-1" }),
    ).rejects.toThrow(/tidak bisa menerima jurnal/);
  });

  it("menolak akun COA nonaktif", async () => {
    findById.mockResolvedValue({ ...COA_LAYAK, isActive: false });
    const { service } = createService();

    await expect(
      service.updateAccount("akun-1", TENANT, { coaId: "coa-1" }),
    ).rejects.toThrow(/tidak aktif/);
  });

  it("melepas tautan tanpa memvalidasi apa pun", async () => {
    const { service, repo } = createService();

    await service.updateAccount("akun-1", TENANT, { coaId: null });

    expect(findById).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("akun-1", { coaId: null });
  });

  it("memvalidasi juga saat akun dibuat dengan tautan COA", async () => {
    findById.mockResolvedValue({ ...COA_LAYAK, isPostable: false });
    const { service, repo } = createService();

    await expect(
      service.createAccount({
        name: "BRI",
        type: "BANK",
        coaId: "coa-1",
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(InvalidChartOfAccountError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
