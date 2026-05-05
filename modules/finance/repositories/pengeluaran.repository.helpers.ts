import type {
  PengeluaranCreateData,
  PengeluaranUpdateData,
} from "../domain/ports/IPengeluaranRepository";
import {
  buildCreatePayload,
  buildUpdatePayload,
} from "./pengeluaran.repository-helpers";
import type { FinanceMutationDelegate } from "./shared/financeMutationRepository";

const ACTIVE_BUDGET_STATUSES = ["APPROVED", "ACTIVE"] as const;

/** Memastikan model pengeluaran tersedia pada client aktif. */
export function assertPengeluaranModelExists(exists: boolean): void {
  if (!exists) {
    throw new Error("Model Pengeluaran belum tersedia");
  }
}

/** Membangun where lookup budget untuk pengeluaran baru. */
export function buildPengeluaranBudgetLookupWhere(input: {
  budgetCategory: string;
  expenseDate: Date;
  tenantId: string;
}): {
  category: string;
  month: number;
  year: number;
  status: { in: readonly ["APPROVED", "ACTIVE"] };
  tenantId: string;
} {
  return {
    category: input.budgetCategory,
    month: input.expenseDate.getMonth() + 1,
    year: input.expenseDate.getFullYear(),
    status: { in: ACTIVE_BUDGET_STATUSES },
    tenantId: input.tenantId,
  };
}

/** Membangun payload create pengeluaran dengan budget id ter-resolve. */
export function buildPengeluaranCreateData(
  data: PengeluaranCreateData,
  budgetId: string | null,
) {
  return buildCreatePayload(data, budgetId);
}

/** Membangun payload update pengeluaran. */
export function buildPengeluaranUpdateData(data: PengeluaranUpdateData) {
  return buildUpdatePayload(data);
}

/** Mengambil record id hasil create pengeluaran. */
export function createPengeluaranRecord(input: {
  delegate: FinanceMutationDelegate;
  data: PengeluaranCreateData;
  budgetId: string | null;
}): Promise<{ id: string }> {
  return input.delegate.create({
    data: buildPengeluaranCreateData(input.data, input.budgetId),
    select: { id: true },
  }) as Promise<{ id: string }>;
}
