import {
  aggregateMutationTotal,
  buildMutationPeriodWhere,
  buildMutationWhere,
} from "./shared/financeMutationFilters";
import {
  findMutationByIdWithAudit,
  findMutationIdsAndDates,
  findMutationManyWithAudit,
  findMutationPeriodSummaries,
} from "./shared/mutationAuditQueries";
import {
  getFinanceTenantWhere,
  mapMutationAmountToPublic,
  resolveTenantId,
  runSafeRepositoryOperation,
  toBigIntAmount,
  toDateValue,
  type FinanceMutationDelegate,
} from "./shared/financeMutationRepository";
import type { PengeluaranEntity as PengeluaranPublic } from "../domain/entities/PengeluaranEntity";
import type {
  PengeluaranCreateData,
  PengeluaranUpdateData,
} from "../domain/ports/IPengeluaranRepository";

export interface RawGroupResult {
  kategori: string | null;
  tipePengeluaran: string | null;
  _sum: { jumlah: bigint | null };
  _count: { id: number };
}

/** Gets the active tenant filter for finance mutation queries. */
export function getTenantWhere() {
  return getFinanceTenantWhere();
}

/** Maps a mutation record into the public pengeluaran shape. */
export function mapToPublicRecord(record: Record<string, unknown>) {
  return mapMutationAmountToPublic(record) as unknown as PengeluaranPublic;
}

/** Fetches mutation records with audit relations and maps them publicly. */
export async function findManyWithAudit(
  delegate: FinanceMutationDelegate,
  where: Record<string, unknown>,
) {
  const items = await findMutationManyWithAudit({ delegate, where });
  return (items as Record<string, unknown>[]).map(mapToPublicRecord);
}

/** Converts mixed date values into a consistent public shape. */
export function mapIdsAndDates(
  items: Array<{ id: string; tanggal: Date | string }>,
) {
  return items.map((item) => ({
    id: item.id,
    tanggal:
      typeof item.tanggal === "string" ? new Date(item.tanggal) : item.tanggal,
  }));
}

/** Resolves the matching budget id for a pengeluaran create request. */
export async function findBudgetIdForExpense(options: {
  client: Record<string, FinanceMutationDelegate>;
  data: PengeluaranCreateData;
  buildBudgetLookupWhere: (input: {
    budgetCategory: string;
    expenseDate: Date;
    tenantId: string;
  }) => Record<string, unknown>;
}) {
  if (!canLookupBudget(options)) return null;

  try {
    const budgetLookup = await resolveBudgetLookupInput(options);
    if (!budgetLookup) return null;
    return await queryBudgetId(options, budgetLookup);
  } catch {
    return null;
  }
}

function canLookupBudget(options: {
  client: Record<string, FinanceMutationDelegate>;
  data: PengeluaranCreateData;
}) {
  return options.data.kategori && "budget" in options.client;
}

async function queryBudgetId(
  options: {
    client: Record<string, FinanceMutationDelegate>;
    buildBudgetLookupWhere: (input: {
      budgetCategory: string;
      expenseDate: Date;
      tenantId: string;
    }) => Record<string, unknown>;
  },
  budgetLookup: { budgetCategory: string; expenseDate: Date; tenantId: string },
) {
  const budget = await options.client.budget.findFirst?.({
    where: options.buildBudgetLookupWhere(budgetLookup),
  });
  return (budget as Record<string, unknown> | null)?.id as string | null;
}

async function resolveBudgetLookupInput(options: {
  client: Record<string, FinanceMutationDelegate>;
  data: PengeluaranCreateData;
}) {
  const tenantId = await resolveTenantId(options.data as { tenantId?: string });
  const { getBudgetCategory } = await import("../services/budget-integration");
  const budgetCategory = getBudgetCategory(options.data.kategori as string);

  if (!budgetCategory) {
    return null;
  }

  return {
    budgetCategory,
    expenseDate: toDateValue(options.data.tanggal),
    tenantId: tenantId as string,
  };
}

/** Builds the create payload for a pengeluaran record. */
export async function buildCreatePayload(
  data: PengeluaranCreateData,
  budgetId: string | null,
) {
  const tenantId = await resolveTenantId(data as { tenantId?: string });

  return {
    tanggal: toDateValue(data.tanggal),
    nomorBukti: data.nomorBukti,
    tipePengeluaran: data.tipePengeluaran,
    kategori: data.kategori,
    deskripsi: data.deskripsi,
    jumlah: toBigIntAmount(data.jumlah),
    metodeBayar: data.metodeBayar ?? null,
    catatan: data.catatan ?? null,
    createdBy: data.createdBy ?? null,
    budgetId,
    tenantId: tenantId as string,
  };
}

/** Builds the update payload for a pengeluaran record. */
export function buildUpdatePayload(data: PengeluaranUpdateData) {
  const updateData: Record<string, unknown> = {
    ...(data.tanggal !== undefined && { tanggal: toDateValue(data.tanggal) }),
    ...(data.nomorBukti !== undefined && { nomorBukti: data.nomorBukti }),
    ...(data.tipePengeluaran !== undefined && {
      tipePengeluaran: data.tipePengeluaran,
    }),
    ...(data.kategori !== undefined && { kategori: data.kategori }),
    ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi }),
    ...(data.metodeBayar !== undefined && { metodeBayar: data.metodeBayar }),
    ...(data.catatan !== undefined && { catatan: data.catatan }),
    ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
  };

  if (data.jumlah !== undefined) {
    updateData.jumlah = toBigIntAmount(data.jumlah);
  }

  return updateData;
}

/** Builds a where clause for composite pengeluaran filters. */
export async function buildFilterWhere(options: {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  paymentMethod?: string;
  searchDescription?: string;
}) {
  return buildMutationWhere(await getTenantWhere(), options);
}

/** Builds a where clause for monthly pengeluaran aggregation. */
export async function buildPeriodWhere(month?: number, year?: number) {
  return buildMutationPeriodWhere(await getTenantWhere(), { month, year });
}

/** Aggregates mutation totals with a safe default fallback. */
export function aggregateTotalByWhere(
  delegate: FinanceMutationDelegate,
  where: Record<string, unknown>,
) {
  return runSafeRepositoryOperation(
    () => aggregateMutationTotal({ delegate, where }),
    BigInt(0),
  );
}

/** Finds a mutation by id with audit relations. */
export function findByIdWithAudit(
  delegate: FinanceMutationDelegate,
  id: string,
  tenantWhere: Record<string, unknown>,
) {
  return findMutationByIdWithAudit({ delegate, id, where: tenantWhere });
}

/** Finds mutation ids and dates by filter. */
export function findIdsAndDatesByWhere(
  delegate: FinanceMutationDelegate,
  where: Record<string, unknown>,
) {
  return findMutationIdsAndDates({ delegate, where });
}

/** Finds mutation period summaries by filter. */
export function findPeriodSummaries(
  delegate: FinanceMutationDelegate,
  where: Record<string, unknown>,
) {
  return findMutationPeriodSummaries({ delegate, where });
}

/** Maps grouped raw aggregate results into public output rows. */
export function mapGroupedResults(items: RawGroupResult[]) {
  return items.map((item) => ({
    kategori: item.kategori || "Lainnya",
    tipePengeluaran: item.tipePengeluaran || "OPEX",
    _sum: { jumlah: Number(item._sum.jumlah || 0) },
    _count: { id: item._count.id || 0 },
  }));
}

/** Runs the grouped category aggregate query on pengeluaran records. */
export function groupByCategory(
  delegate: FinanceMutationDelegate,
  where: Record<string, unknown>,
) {
  return delegate.groupBy?.({
    by: ["kategori", "tipePengeluaran"],
    where,
    _sum: { jumlah: true },
    _count: { id: true },
  });
}
