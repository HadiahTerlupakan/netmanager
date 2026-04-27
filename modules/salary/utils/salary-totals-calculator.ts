export type SalaryDetailAmount = {
  type: "EARNING" | "DEDUCTION";
  amount: number;
};

export type SalaryTotals = {
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
};

const ZERO_AMOUNT = 0;

/** Menjumlahkan total earning, deduction, dan net salary dari detail gaji. */
export function calculateSalaryTotals(
  details: SalaryDetailAmount[],
  baseSalary: number = ZERO_AMOUNT,
): SalaryTotals {
  let totalEarnings = baseSalary;
  let totalDeductions = ZERO_AMOUNT;

  for (const detail of details) {
    if (detail.type === "EARNING") {
      totalEarnings += Number(detail.amount);
      continue;
    }

    totalDeductions += Number(detail.amount);
  }

  return {
    totalEarnings,
    totalDeductions,
    netSalary: totalEarnings - totalDeductions,
  };
}
