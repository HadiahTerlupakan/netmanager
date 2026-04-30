import {
  createMonthlyDateRange,
  type FinanceMutationDelegate,
} from "./financeMutationRepository";

interface MutationFilterInput {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  paymentMethod?: string;
  searchDescription?: string;
}

interface MutationPeriodInput {
  month?: number;
  year?: number;
}

/** Membangun where filter umum untuk mutasi finance. */
export function buildMutationWhere(
  tenantWhere: Record<string, unknown>,
  options: MutationFilterInput,
) {
  return {
    ...tenantWhere,
    ...buildDateRangeClause(options),
    ...buildCategoryClause(options.category),
    ...buildPaymentMethodClause(options.paymentMethod),
    ...buildDescriptionClause(options.searchDescription),
  };
}

/** Membangun where filter agregasi per periode bulanan. */
export function buildMutationPeriodWhere(
  tenantWhere: Record<string, unknown>,
  period: MutationPeriodInput,
) {
  const dateRange = createMonthlyDateRange(period.month, period.year);

  return {
    ...tenantWhere,
    ...(dateRange ? { tanggal: dateRange } : {}),
  };
}

/** Menjalankan aggregate jumlah dengan fallback aman. */
export async function aggregateMutationTotal(options: {
  delegate: FinanceMutationDelegate;
  where: Record<string, unknown>;
}) {
  const result = await options.delegate.aggregate({
    where: options.where,
    _sum: { jumlah: true },
  });

  return result._sum.jumlah || BigInt(0);
}

function buildDateRangeClause(options: MutationFilterInput) {
  if (!options.startDate && !options.endDate) {
    return {};
  }

  return {
    tanggal: {
      ...(options.startDate ? { gte: options.startDate } : {}),
      ...(options.endDate ? { lte: options.endDate } : {}),
    },
  };
}

function buildCategoryClause(category?: string) {
  return category ? { kategori: category } : {};
}

function buildPaymentMethodClause(paymentMethod?: string) {
  return paymentMethod ? { metodeBayar: paymentMethod } : {};
}

function buildDescriptionClause(searchDescription?: string) {
  return searchDescription
    ? {
        deskripsi: {
          contains: searchDescription,
          mode: "insensitive",
        },
      }
    : {};
}
