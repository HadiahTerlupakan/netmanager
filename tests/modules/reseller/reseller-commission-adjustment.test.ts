import { describe, expect, it } from "vitest";
import { allocateAdjustments } from "@/modules/reseller/domain/commission-adjustment";

describe("allocateAdjustments", () => {
  it("memotong koreksi terlama dulu sampai komisi bruto habis", () => {
    const deduction = allocateAdjustments(
      [
        { id: "a1", remainingAmount: 10000 },
        { id: "a2", remainingAmount: 30000 },
        { id: "a3", remainingAmount: 5000 },
      ],
      25000,
    );

    expect(deduction).toEqual({
      allocations: [
        { adjustmentId: "a1", amount: 10000 },
        { adjustmentId: "a2", amount: 15000 },
      ],
      deductedAmount: 25000,
    });
  });

  it("memotong seluruh koreksi bila komisi bruto cukup", () => {
    const deduction = allocateAdjustments(
      [{ id: "a1", remainingAmount: 4000 }],
      50000,
    );

    expect(deduction.deductedAmount).toBe(4000);
    expect(deduction.allocations).toEqual([
      { adjustmentId: "a1", amount: 4000 },
    ]);
  });

  it("tidak memotong apa pun tanpa koreksi terbuka atau komisi", () => {
    expect(allocateAdjustments([], 50000)).toEqual({
      allocations: [],
      deductedAmount: 0,
    });
    expect(
      allocateAdjustments([{ id: "a1", remainingAmount: 4000 }], 0),
    ).toEqual({ allocations: [], deductedAmount: 0 });
  });

  it("melewati koreksi yang sisanya sudah habis", () => {
    const deduction = allocateAdjustments(
      [
        { id: "a1", remainingAmount: 0 },
        { id: "a2", remainingAmount: 3000 },
      ],
      10000,
    );

    expect(deduction.allocations).toEqual([
      { adjustmentId: "a2", amount: 3000 },
    ]);
  });
});
