import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publishExpenseRecorded: vi.fn(),
  resyncExpenseBooks: vi.fn(),
}));

vi.mock("@/modules/finance/services/expense-journal-events", () => ({
  publishExpenseRecorded: mocks.publishExpenseRecorded,
  resyncExpenseBooks: mocks.resyncExpenseBooks,
}));

vi.mock("@/modules/finance/repositories", () => ({
  ExpenseRepository: class {},
  ExpenseCategoryRepository: class {},
}));

vi.mock("@/modules/finance/repositories/ExpenseRepository", () => ({
  ExpenseRepository: class {},
}));

import {
  buildExpenseSiteWhere,
  resolveExpenseCreateSiteId,
  resolveExpenseSiteScope,
  resolveExpenseTargetSiteId,
} from "@/modules/finance/services/expense-site-scope";
import { FinanceExpenseFacadeService } from "@/modules/finance/services/FinanceExpenseFacadeService";
import { ExpenseRouteService } from "@/modules/finance/services/ExpenseRouteService";
import { isRouteServiceError } from "@/modules/finance/services/RouteServiceError";

const SITE_ONLY = ["expense:read", "expense:site_only"];
const MULTI_SITE_USER = { role: "Admin Keuangan", siteIds: ["s1", "s2"] };
const SINGLE_SITE_USER = { role: "Admin Keuangan", siteId: "s1" };
const NO_SITE_USER = { role: "Admin Keuangan", siteIds: [] as string[] };

function statusOf(run: () => unknown): number | undefined {
  try {
    run();
  } catch (error) {
    if (isRouteServiceError(error)) return error.status;
    throw error;
  }
  return undefined;
}

describe("resolveExpenseSiteScope", () => {
  it("tidak membatasi role wildcard non-super (izin dicocokkan persis)", () => {
    expect(resolveExpenseSiteScope(MULTI_SITE_USER, ["*"])).toEqual({
      dibatasi: false,
    });
  });

  it("tidak membatasi super admin walau memegang expense:site_only", () => {
    expect(
      resolveExpenseSiteScope(
        { role: "SUPER_ADMIN", siteIds: ["s1"] },
        SITE_ONLY,
      ),
    ).toEqual({ dibatasi: false });
  });

  it("membatasi ke SEMUA site pengguna, bukan hanya site utama", () => {
    expect(
      resolveExpenseSiteScope({ ...MULTI_SITE_USER, siteId: "s1" }, SITE_ONLY),
    ).toEqual({ dibatasi: true, siteIds: ["s1", "s2"] });
  });

  it("jatuh ke siteId legacy bila siteIds kosong", () => {
    expect(
      resolveExpenseSiteScope({ siteId: "s9", siteIds: [] }, SITE_ONLY),
    ).toEqual({ dibatasi: true, siteIds: ["s9"] });
  });
});

describe("buildExpenseSiteWhere", () => {
  const restricted = resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY);

  it("pengguna terbatas melihat seluruh site-nya", () => {
    expect(buildExpenseSiteWhere(restricted, {})).toEqual({
      siteId: { in: ["s1", "s2"] },
    });
  });

  it("filter site di dalam lingkup dipertahankan, di luar lingkup kosong", () => {
    expect(buildExpenseSiteWhere(restricted, { siteId: "s2" })).toEqual({
      siteId: "s2",
    });
    expect(buildExpenseSiteWhere(restricted, { siteId: "s3" })).toBeNull();
  });

  it("pengeluaran umum (tanpa site) di luar lingkup pengguna terbatas", () => {
    expect(buildExpenseSiteWhere(restricted, { scope: "general" })).toBeNull();
  });

  it("gagal tertutup untuk pengguna terbatas tanpa site", () => {
    const scope = resolveExpenseSiteScope(NO_SITE_USER, SITE_ONLY);
    expect(buildExpenseSiteWhere(scope, {})).toBeNull();
  });

  it("pengguna tak terbatas tetap memakai filter apa adanya", () => {
    const scope = resolveExpenseSiteScope(MULTI_SITE_USER, ["*"]);
    expect(buildExpenseSiteWhere(scope, {})).toEqual({});
    expect(buildExpenseSiteWhere(scope, { siteId: "s3" })).toEqual({
      siteId: "s3",
    });
    expect(buildExpenseSiteWhere(scope, { scope: "general" })).toEqual({
      siteId: null,
    });
  });
});

describe("resolveExpenseCreateSiteId", () => {
  it("memakai satu-satunya site pengguna bila tidak memilih site", () => {
    const scope = resolveExpenseSiteScope(SINGLE_SITE_USER, SITE_ONLY);
    expect(resolveExpenseCreateSiteId(scope, undefined)).toBe("s1");
    expect(resolveExpenseCreateSiteId(scope, "")).toBe("s1");
  });

  it("menerima site tambahan pengguna multi-site", () => {
    const scope = resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY);
    expect(resolveExpenseCreateSiteId(scope, "s2")).toBe("s2");
  });

  it("menolak site di luar lingkup (403)", () => {
    const scope = resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY);
    expect(statusOf(() => resolveExpenseCreateSiteId(scope, "s3"))).toBe(403);
  });

  it("menolak multi-site tanpa pilihan site (403)", () => {
    const scope = resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY);
    expect(statusOf(() => resolveExpenseCreateSiteId(scope, undefined))).toBe(
      403,
    );
  });

  it("menolak pengguna terbatas tanpa site (403)", () => {
    const scope = resolveExpenseSiteScope(NO_SITE_USER, SITE_ONLY);
    expect(statusOf(() => resolveExpenseCreateSiteId(scope, "s1"))).toBe(403);
  });

  it("pengguna tak terbatas boleh mencatat pengeluaran umum", () => {
    const scope = resolveExpenseSiteScope(MULTI_SITE_USER, ["*"]);
    expect(resolveExpenseCreateSiteId(scope, undefined)).toBeUndefined();
  });
});

describe("resolveExpenseTargetSiteId", () => {
  it("site yang tidak dikirim saat ubah berarti tidak diubah", () => {
    const scope = resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY);
    expect(resolveExpenseTargetSiteId(scope, undefined)).toBeUndefined();
  });

  it("tetap menolak pengguna terbatas tanpa site walau site tidak diubah", () => {
    const scope = resolveExpenseSiteScope(NO_SITE_USER, SITE_ONLY);
    expect(statusOf(() => resolveExpenseTargetSiteId(scope, undefined))).toBe(
      403,
    );
  });
});

describe("FinanceExpenseFacadeService.getExpenses", () => {
  const findManyWithRelations = vi.fn();
  const service = new FinanceExpenseFacadeService(
    { findManyWithRelations, createExpense: vi.fn() } as never,
    {} as never,
  );

  beforeEach(() => {
    findManyWithRelations.mockReset().mockResolvedValue([]);
  });

  it("memfilter ke seluruh site pengguna terbatas", async () => {
    await service.getExpenses({
      siteScope: resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY),
    });
    expect(findManyWithRelations).toHaveBeenCalledWith({
      siteId: { in: ["s1", "s2"] },
    });
  });

  it("tidak menyentuh database untuk pengguna terbatas tanpa site", async () => {
    const result = await service.getExpenses({
      siteScope: resolveExpenseSiteScope(NO_SITE_USER, SITE_ONLY),
    });
    expect(result).toEqual([]);
    expect(findManyWithRelations).not.toHaveBeenCalled();
  });

  it("tanpa lingkup tetap mendukung scope general", async () => {
    await service.getExpenses({ scope: "general", category: "OPEX" });
    expect(findManyWithRelations).toHaveBeenCalledWith({
      siteId: null,
      category: "OPEX",
    });
  });
});

describe("ExpenseRouteService site scope", () => {
  const repo = {
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    findExpenseById: vi.fn(),
  };
  const service = new ExpenseRouteService(repo as never);
  const restricted = resolveExpenseSiteScope(MULTI_SITE_USER, SITE_ONLY);
  const updateInput = {
    amount: 1000n,
    date: new Date("2026-11-01"),
    category: "OPEX",
  };
  const storedExpense = {
    id: "e1",
    tenantId: "t1",
    amount: 1000n,
    depreciation: 0n,
    usefulLife: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.updateExpense.mockResolvedValue(storedExpense);
    repo.deleteExpense.mockResolvedValue(storedExpense);
  });

  it("ubah dibatasi ke seluruh site pengguna dan tidak memindah site", async () => {
    await service.updateExpense("e1", updateInput, restricted);
    const [where, data] = repo.updateExpense.mock.calls[0];
    expect(where).toEqual({ id: "e1", siteId: { in: ["s1", "s2"] } });
    expect(data.site).toBeUndefined();
  });

  it("ubah boleh memindah ke site lain milik pengguna", async () => {
    await service.updateExpense(
      "e1",
      { ...updateInput, siteId: "s2" },
      restricted,
    );
    expect(repo.updateExpense.mock.calls[0][1].site).toEqual({
      connect: { id: "s2" },
    });
  });

  it("ubah ke site di luar lingkup ditolak 403 tanpa menulis", async () => {
    await expect(
      service.updateExpense("e1", { ...updateInput, siteId: "s3" }, restricted),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.updateExpense).not.toHaveBeenCalled();
  });

  it("hapus pengeluaran site tambahan pengguna diizinkan", async () => {
    repo.findExpenseById.mockResolvedValue({ ...storedExpense, siteId: "s2" });
    await service.deleteExpense("e1", restricted);
    expect(repo.deleteExpense).toHaveBeenCalledWith({
      id: "e1",
      siteId: { in: ["s1", "s2"] },
    });
  });

  it("hapus pengeluaran di luar lingkup dijawab 404", async () => {
    repo.findExpenseById.mockResolvedValue({ ...storedExpense, siteId: "s3" });
    await expect(service.deleteExpense("e1", restricted)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(repo.deleteExpense).not.toHaveBeenCalled();
  });

  it("hapus oleh pengguna terbatas tanpa site ditolak 403", async () => {
    await expect(
      service.deleteExpense(
        "e1",
        resolveExpenseSiteScope(NO_SITE_USER, SITE_ONLY),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.findExpenseById).not.toHaveBeenCalled();
  });

  it("tanpa lingkup tetap memakai where id saja", async () => {
    await service.updateExpense("e1", { ...updateInput, siteId: "" });
    const [where, data] = repo.updateExpense.mock.calls[0];
    expect(where).toEqual({ id: "e1" });
    expect(data.site).toEqual({ disconnect: true });
  });
});
