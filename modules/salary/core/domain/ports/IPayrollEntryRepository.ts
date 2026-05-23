import type { PayrollEntry } from "../entities/PayrollEntry";
import type { PayrollLine } from "../entities/PayrollLine";
import type { PayrollEntryStatus } from "../enums";

export interface PayrollEntryWithLines extends PayrollEntry {
  lines: PayrollLine[];
}

export interface PayrollEntrySummary {
  id: string;
  userId: string;
  basicSalary: number;
  totalEarnings: number;
  totalTax: number;
  netSalary: number;
}

export interface AdvanceDeductionLine {
  advanceId: string;
  amount: number;
}

/**
 * Detail event payload sources untuk SALARY_PROCESSED handler.
 * Memuat semua angka yang dibutuhkan accounting handler agar
 * jurnal salary balanced (gaji + BPJS + advance + PPh21).
 */
export interface PayrollEntryEventDetails {
  id: string;
  userId: string;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalTax: number;
  netSalary: number;
  employerCost: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  advanceDeducted: number;
  advanceDeductions: AdvanceDeductionLine[];
}

export interface IPayrollEntryRepository {
  findCalculatedSummaries(
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntrySummary[]>;
  findCalculatedEventDetails(
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntryEventDetails[]>;
  findById(id: string, tenantId: string): Promise<PayrollEntryWithLines | null>;
  findByUserId(userId: string, tenantId: string): Promise<PayrollEntry[]>;
  findByRunId(runId: string, tenantId: string): Promise<PayrollEntry[]>;
  findByUserAndRun(
    userId: string,
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntryWithLines | null>;
  create(
    data: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollEntry>;
  createMany(
    data: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">[],
  ): Promise<PayrollEntry[]>;
  update(
    id: string,
    tenantId: string,
    data: Partial<PayrollEntry>,
  ): Promise<PayrollEntry>;
  updateStatus(
    id: string,
    tenantId: string,
    status: PayrollEntryStatus,
    errorMessage?: string,
  ): Promise<PayrollEntry>;
  delete(id: string, tenantId: string): Promise<void>;
  deleteByRunId(runId: string, tenantId: string): Promise<void>;
  setLines(
    entryId: string,
    tenantId: string,
    lines: Omit<PayrollLine, "id">[],
  ): Promise<PayrollLine[]>;
  clearLines(entryId: string, tenantId: string): Promise<void>;
}
