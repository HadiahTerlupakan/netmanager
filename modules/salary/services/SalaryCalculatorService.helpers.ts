type ActiveLoan = {
  id: string;
  installment: number;
  remainingAmount: number;
};

type LoanDeductionLine = {
  name: string;
  amount: number;
  loanId?: string;
  notes?: string;
};

/** Bentuk line deduction dari pinjaman aktif karyawan. */
export function buildActiveLoanDeductionLines(
  activeLoans: ActiveLoan[],
): LoanDeductionLine[] {
  return activeLoans.flatMap((loan) => {
    if (loan.remainingAmount <= 0) {
      return [];
    }

    const deductionAmount = Math.min(loan.installment, loan.remainingAmount);
    return [
      {
        name: "Cicilan Pinjaman",
        amount: deductionAmount,
        loanId: loan.id,
        notes: `Sisa sebelum dipotong: Rp${loan.remainingAmount.toLocaleString()}`,
      },
    ];
  });
}
