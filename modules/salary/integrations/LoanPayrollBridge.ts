import { prisma } from "@/lib/prisma";

/** Loan data shape expected by LoanDeductionCalculator via metadata. */
export interface ActiveLoan {
  id: string;
  name: string;
  installment: number;
  remainingAmount: number;
}

/** Advance data shape expected by LoanDeductionCalculator via metadata. */
export interface ActiveAdvance {
  id: string;
  amount: number;
  deductionMethod: "FULL_NEXT" | "INSTALLMENT";
  installmentCount?: number;
  remainingAmount: number;
}

/** Port for fetching loan/advance data for payroll calculation. */
export interface ILoanPayrollBridge {
  getActiveLoans(userId: string, tenantId: string): Promise<ActiveLoan[]>;
  getActiveAdvances(userId: string, tenantId: string): Promise<ActiveAdvance[]>;
}

/**
 * Queries EmployeeLoan and SalaryAdvance tables to provide
 * active deduction data for the salary calculation engine.
 */
export class LoanPayrollBridge implements ILoanPayrollBridge {
  /** Get active employee loans with remaining balance. */
  async getActiveLoans(
    userId: string,
    tenantId: string,
  ): Promise<ActiveLoan[]> {
    const loans = await prisma.employeeLoan.findMany({
      where: {
        userId,
        tenantId,
        status: "ACTIVE",
        remainingAmount: { gt: 0 },
      },
      select: {
        id: true,
        notes: true,
        installment: true,
        remainingAmount: true,
      },
    });

    return loans.map((loan) => ({
      id: loan.id,
      name: loan.notes ?? "Pinjaman Karyawan",
      installment: loan.installment,
      remainingAmount: loan.remainingAmount,
    }));
  }

  /** Get disbursed salary advances pending deduction. */
  async getActiveAdvances(
    userId: string,
    tenantId: string,
  ): Promise<ActiveAdvance[]> {
    const advances = await prisma.salaryAdvance.findMany({
      where: {
        userId,
        tenantId,
        status: "DISBURSED",
        remainingAmount: { gt: 0 },
      },
      select: {
        id: true,
        amount: true,
        deductionMethod: true,
        installmentCount: true,
        remainingAmount: true,
      },
    });

    return advances.map((advance) => ({
      id: advance.id,
      amount: advance.amount,
      deductionMethod: advance.deductionMethod as "FULL_NEXT" | "INSTALLMENT",
      installmentCount: advance.installmentCount ?? undefined,
      remainingAmount: advance.remainingAmount,
    }));
  }
}
