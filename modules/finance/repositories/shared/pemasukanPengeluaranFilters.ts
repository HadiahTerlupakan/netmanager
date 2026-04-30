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

  if (options.startDate && options.endDate) {
    where.tanggal = { gte: options.startDate, lte: options.endDate };
  }

  if (options.category) {
    where.kategori = options.category;
  }

  if (options.paymentMethod) {
    where.metodeBayar = options.paymentMethod;
  }

  if (options.searchDescription) {
    where.deskripsi = createInsensitiveContainsFilter(
      options.searchDescription,
    );
  }

  return where;
}
