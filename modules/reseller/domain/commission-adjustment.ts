/** Koreksi yang masih punya sisa untuk dipotongkan. */
export interface OpenAdjustment {
  readonly id: string;
  readonly remainingAmount: number;
}

/** Bagian satu koreksi yang dipotongkan pada satu settlement. */
export interface AdjustmentAllocation {
  readonly adjustmentId: string;
  readonly amount: number;
}

/** Hasil pemotongan koreksi atas satu settlement. */
export interface AdjustmentDeduction {
  readonly allocations: readonly AdjustmentAllocation[];
  /** Total yang dipotongkan; tidak pernah melebihi `grossAmount`. */
  readonly deductedAmount: number;
}

/**
 * Potongkan koreksi terbuka (urutan masuk, terlama dulu) dari komisi bruto
 * sebuah settlement. Total settlement tidak pernah di bawah 0: koreksi yang
 * tidak muat dipotong sebagian dan sisanya terbawa ke settlement berikutnya.
 */
export function allocateAdjustments(
  openAdjustments: readonly OpenAdjustment[],
  grossAmount: number,
): AdjustmentDeduction {
  const allocations: AdjustmentAllocation[] = [];
  let capacity = Math.max(0, grossAmount);
  for (const adjustment of openAdjustments) {
    if (capacity === 0) break;
    const amount = Math.min(capacity, adjustment.remainingAmount);
    if (amount <= 0) continue;
    allocations.push({ adjustmentId: adjustment.id, amount });
    capacity -= amount;
  }
  return {
    allocations,
    deductedAmount: allocations.reduce(
      (total, entry) => total + entry.amount,
      0,
    ),
  };
}
