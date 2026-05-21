import type { PayrollEntry } from "../entities/PayrollEntry";
import type { PayrollLine } from "../entities/PayrollLine";
import type { PayrollEntryStatus } from "../enums";

export interface PayrollEntryWithLines extends PayrollEntry {
  lines: PayrollLine[];
}

export interface IPayrollEntryRepository {
  findById(id: string, tenantId: string): Promise<PayrollEntryWithLines | null>;
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
