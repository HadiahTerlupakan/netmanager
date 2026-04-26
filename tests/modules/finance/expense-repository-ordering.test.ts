import { describe, expect, it, vi } from "vitest";
import { ExpenseRepository } from "@/modules/finance/repositories/ExpenseRepository";

describe("ExpenseRepository ordering", () => {
  it("mengambil pengeluaran harian dengan urutan stabil untuk tanggal yang sama", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new ExpenseRepository({
      expense: { findMany },
    } as never);

    await repository.findManyWithRelations({ category: "OPEX" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });
});
