import { createInsensitiveContainsFilter } from "./prismaSearchFilters";

export interface MutationQueryFilterOptions {
  tenantWhere: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  category?: string;
  paymentMethod?: string;
  searchDescription?: string;
}

/** Membangun where filter bersama untuk pemasukan dan pengeluaran. */
export function buildMutationWhereFilter(options: MutationQueryFilterOptions) {
  const where: Record<string, unknown> = { ...options.tenantWhere };

  applyDateRangeFilter(where, {
    startDate: options.startDate,
    endDate: options.endDate,
  });
  applyCategoryFilter(where, options.category);
  applyPaymentMethodFilter(where, options.paymentMethod);
  applyDescriptionSearchFilter(where, options.searchDescription);

  return where;
}

function applyDateRangeFilter(
  where: Record<string, unknown>,
  dateRange: { startDate?: Date; endDate?: Date },
) {
  if (dateRange.startDate && dateRange.endDate) {
    where.tanggal = { gte: dateRange.startDate, lte: dateRange.endDate };
  }
}

function applyCategoryFilter(
  where: Record<string, unknown>,
  category?: string,
) {
  if (category) {
    where.kategori = category;
  }
}

function applyPaymentMethodFilter(
  where: Record<string, unknown>,
  paymentMethod?: string,
) {
  if (paymentMethod) {
    where.metodeBayar = paymentMethod;
  }
}

function applyDescriptionSearchFilter(
  where: Record<string, unknown>,
  searchDescription?: string,
) {
  if (searchDescription) {
    where.deskripsi = createInsensitiveContainsFilter(searchDescription);
  }
}
