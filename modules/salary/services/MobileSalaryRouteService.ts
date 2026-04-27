import type {
  SalaryDetailEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";
import { getSalaryService } from "./SalaryService";

const PAID_STATUS = "PAID";
const LOCALE_ID = "id-ID";

export interface MobileSalarySession {
  id: string;
  tenantId: string;
}

/** Mengambil daftar slip gaji yang tersedia untuk user mobile. */
export async function getMobileSalaryList(session: MobileSalarySession) {
  const result = await getSalaryService().getSalaries({
    userId: session.id,
    status: PAID_STATUS,
  });
  if (!result.success || !result.data) {
    throw new Error(result.error ?? "Gagal mengambil daftar gaji");
  }

  return result.data.salaries.map(mapSalaryListItem);
}

/** Mengambil detail slip gaji mobile milik user yang sedang login. */
export async function getMobileSalaryDetail(
  session: MobileSalarySession,
  salaryId: string,
) {
  const result = await getSalaryService().getSalaryById(salaryId);
  if (!result.success || !result.data) {
    return null;
  }

  if (!canAccessSalary(result.data, session)) {
    return null;
  }

  return mapSalaryDetail(result.data);
}

function canAccessSalary(
  salary: SalaryWithDetailsEntity,
  session: MobileSalarySession,
) {
  return salary.userId === session.id && salary.status === PAID_STATUS;
}

function mapSalaryListItem(salary: SalaryWithDetailsEntity) {
  return {
    id: salary.id,
    period: formatSalaryPeriod(salary.month, salary.year),
    netSalary: salary.netSalary,
    paidAt: salary.paidAt,
    month: salary.month,
    year: salary.year,
  };
}

function mapSalaryDetail(salary: SalaryWithDetailsEntity) {
  return {
    id: salary.id,
    period: formatSalaryPeriod(salary.month, salary.year),
    basicSalary: salary.basicSalary,
    totalEarnings: salary.totalEarnings,
    totalDeductions: salary.totalDeductions,
    netSalary: salary.netSalary,
    paidAt: salary.paidAt,
    earnings: salary.details.filter(isEarning).map(mapEarningItem),
    deductions: salary.details.filter(isDeduction).map(mapDeductionItem),
  };
}

function isEarning(detail: SalaryDetailEntity) {
  return detail.type === "EARNING";
}

function isDeduction(detail: SalaryDetailEntity) {
  return detail.type === "DEDUCTION";
}

function mapEarningItem(detail: SalaryDetailEntity) {
  return {
    id: detail.id,
    name: detail.name,
    amount: detail.amount,
    quantity: detail.quantity,
    rate: detail.rate,
  };
}

function mapDeductionItem(detail: SalaryDetailEntity) {
  return {
    id: detail.id,
    name: detail.name,
    amount: detail.amount,
    notes: detail.notes,
  };
}

function formatSalaryPeriod(month: number, year: number) {
  return new Date(year, month - 1).toLocaleDateString(LOCALE_ID, {
    month: "long",
    year: "numeric",
  });
}
