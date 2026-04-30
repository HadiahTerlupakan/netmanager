import {
  EmployeeLoanRepository,
  SalaryDetailRepository,
  runTransaction,
} from "../repositories/SalaryCalculationRepositories";

type SalaryDeductionInput = {
  name: string;
  amount: number;
  quantity?: number;
  rate?: number;
  notes?: string;
  loanId?: string;
};

/** Mengelola reset dan pencatatan potongan pinjaman pada detail gaji. */
export class SalaryLoanDeductionService {
  constructor(
    private readonly employeeLoanRepository = new EmployeeLoanRepository(),
    private readonly salaryDetailRepository = new SalaryDetailRepository(),
  ) {}

  /** Reset payment pinjaman lama yang terhubung ke salary details. */
  async resetExistingLoanPayments(salaryId: string) {
    const details =
      await this.salaryDetailRepository.findManyWithLoanPayment(salaryId);

    for (const detail of details) {
      if (!detail.loanPayment) continue;
      await this.restoreLoanPayment({
        loanId: detail.loanPayment.loanId,
        amount: detail.loanPayment.amount,
        loanPaymentId: detail.loanPaymentId!,
      });
    }
  }

  /** Simpan deduction salary dan buat loan payment bila deduction berasal dari pinjaman. */
  async createDeductionDetail(
    salaryId: string,
    deduction: SalaryDeductionInput,
    period: { month: number; year: number },
  ) {
    const loanPaymentId = deduction.loanId
      ? await this.createLoanPayment(deduction, period)
      : undefined;

    await this.salaryDetailRepository.createWithLoanPayment({
      salary: { connect: { id: salaryId } },
      name: deduction.name,
      type: "DEDUCTION",
      amount: deduction.amount,
      quantity: deduction.quantity,
      rate: deduction.rate,
      notes: deduction.notes,
      ...(loanPaymentId && {
        loanPayment: { connect: { id: loanPaymentId } },
      }),
    });
  }

  private async restoreLoanPayment(input: {
    loanId: string;
    amount: number;
    loanPaymentId: string;
  }) {
    await runTransaction(async (tx) => {
      const loan = await this.employeeLoanRepository.findUnique(input.loanId);
      if (loan) {
        await this.employeeLoanRepository.updateInTransaction(tx, loan.id, {
          remainingAmount: loan.remainingAmount + input.amount,
          status: "ACTIVE",
        });
      }
      await this.employeeLoanRepository.deleteLoanPaymentInTransaction(
        tx,
        input.loanPaymentId,
      );
    });
  }

  private async createLoanPayment(
    deduction: SalaryDeductionInput,
    period: { month: number; year: number },
  ) {
    return runTransaction(async (tx) => {
      const loan = await this.employeeLoanRepository.findUnique(
        deduction.loanId!,
      );
      if (!loan) return undefined;

      const newRemaining = Math.max(0, loan.remainingAmount - deduction.amount);
      await this.employeeLoanRepository.updateInTransaction(tx, loan.id, {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? "PAID_OFF" : "ACTIVE",
      });

      const payment =
        await this.employeeLoanRepository.createLoanPaymentInTransaction(tx, {
          loan: { connect: { id: loan.id } },
          amount: deduction.amount,
          notes: `Potongan gaji otomatis bulan ${period.month}/${period.year}`,
        });
      return payment.id;
    });
  }
}
