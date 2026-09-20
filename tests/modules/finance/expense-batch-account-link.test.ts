import { describe, expect, it, vi } from "vitest";

// vi.mock di-hoist ke atas berkas, jadi variabel yang dipakai factory-nya
// harus ikut di-hoist lewat vi.hoisted.
const { publish } = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish },
  EVENT_NAMES: { EXPENSE_APPROVED: "finance:expense.approved" },
}));

import { ExpenseRouteService } from "@/modules/finance/services/ExpenseRouteService";

/**
 * Event `EXPENSE_APPROVED` — satu-satunya pemicu jurnal pengeluaran — hanya
 * dikirim bila `expense.accountId` terisi. Sebelumnya jalur batch tidak pernah
 * meneruskan akun kas sama sekali, sehingga 147 pengeluaran di produksi
 * tersimpan tanpa sumber dana dan tidak satu pun menghasilkan jurnal.
 */

function createService(createdExpenses: unknown[]) {
  const expenseRepository = {
    createManyExpenses: vi.fn().mockResolvedValue(createdExpenses),
  };
  const service = new ExpenseRouteService();
  (service as unknown as { expenseRepository: unknown }).expenseRepository =
    expenseRepository;
  return { service, expenseRepository };
}

const INPUT = {
  date: new Date("2026-09-20"),
  siteId: "site-1",
  accountId: "akun-kas-1",
  items: [
    {
      amount: BigInt(150000),
      category: "OPEX",
      expenseCategoryId: "kategori-1",
      description: "Token listrik",
    },
    {
      amount: BigInt(250000),
      category: "OPEX",
      expenseCategoryId: "kategori-1",
      description: "Sewa",
    },
  ],
};

describe("batch pengeluaran meneruskan akun kas", () => {
  it("menyertakan accountId pada setiap entri yang disimpan", async () => {
    const { service, expenseRepository } = createService([]);

    await service.createBatchExpenses(
      INPUT as Parameters<typeof service.createBatchExpenses>[0],
      "user-1",
    );

    const entries = expenseRepository.createManyExpenses.mock.calls[0]?.[0] as
      | Array<{ accountId?: string }>
      | undefined;
    expect(entries).toHaveLength(2);
    expect(entries?.every((entry) => entry.accountId === "akun-kas-1")).toBe(
      true,
    );
  });

  it("mengirim event akuntansi untuk pengeluaran yang punya akun kas", async () => {
    publish.mockClear();
    const { service } = createService([
      {
        id: "exp-1",
        tenantId: "tenant-1",
        accountId: "akun-kas-1",
        amount: BigInt(150000),
        expenseCategoryId: "kategori-1",
        date: new Date("2026-09-20"),
      },
    ]);

    await service.createBatchExpenses(
      INPUT as Parameters<typeof service.createBatchExpenses>[0],
      "user-1",
    );

    expect(publish).toHaveBeenCalledWith(
      "finance:expense.approved",
      expect.objectContaining({
        expenseId: "exp-1",
        accountId: "akun-kas-1",
      }),
    );
  });

  it("tidak mengirim event bila akun kas tidak dipilih", async () => {
    publish.mockClear();
    const { service } = createService([
      {
        id: "exp-2",
        tenantId: "tenant-1",
        accountId: null,
        amount: BigInt(150000),
        expenseCategoryId: "kategori-1",
        date: new Date("2026-09-20"),
      },
    ]);

    await service.createBatchExpenses(
      { ...INPUT, accountId: undefined } as Parameters<
        typeof service.createBatchExpenses
      >[0],
      "user-1",
    );

    expect(publish).not.toHaveBeenCalled();
  });
});
