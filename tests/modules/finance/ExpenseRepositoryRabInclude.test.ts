import { describe, expect, it, vi } from "vitest";

import { ExpenseRepository } from "@/modules/finance/repositories/ExpenseRepository";

describe("ExpenseRepository tetap membawa identitas proyek", () => {
  it("menyertakan nama proyek dan item saat membaca daftar pengeluaran", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new ExpenseRepository({ expense: { findMany } } as never);

    await repo.findManyWithRelations({});

    const include = findMany.mock.calls[0][0].include;
    expect(include.rabProject).toEqual({ select: { id: true, name: true } });
    expect(include.rabItem).toEqual({ select: { id: true, name: true } });
  });

  it("menyaring realisasi pengeluaran berdasarkan proyek", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new ExpenseRepository({ expense: { findMany } } as never);

    await repo.findProjectExpenses("proyek-1");

    expect(findMany.mock.calls[0][0].where).toEqual({
      rabProjectId: "proyek-1",
    });
  });
});
