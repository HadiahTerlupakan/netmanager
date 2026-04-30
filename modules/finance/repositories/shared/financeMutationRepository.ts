import { getTenantIdFromContext } from "@/lib/tenant-context";

export interface FinanceMutationDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args?: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  aggregate(args: unknown): Promise<{ _sum: { jumlah: bigint | null } }>;
  groupBy?(args: unknown): Promise<unknown[]>;
}

const MISSING_TENANT_ID = "___MISSING_TENANT_ID___";

/** Mengambil filter tenant untuk repository mutasi finance. */
export async function getFinanceTenantWhere() {
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();

  if (isSuperAdmin) {
    return {};
  }

  if (!tenantId) {
    return { tenantId: MISSING_TENANT_ID };
  }

  return { tenantId };
}

/** Mengubah nilai jumlah bigint menjadi string agar aman untuk DTO publik. */
export function mapMutationAmountToPublic<T extends Record<string, unknown>>(
  record: T,
) {
  return {
    ...record,
    jumlah:
      typeof record.jumlah === "bigint"
        ? record.jumlah.toString()
        : (record.jumlah as string | number),
  };
}

/** Mengambil tenant id eksplisit dari payload atau konteks aktif. */
export async function resolveTenantId(payload: {
  tenantId?: string;
}): Promise<string | undefined> {
  const context = await getTenantIdFromContext();
  return payload.tenantId || context.tenantId || undefined;
}

/** Mengubah angka jumlah menjadi bigint untuk penyimpanan database. */
export function toBigIntAmount(amount: number | string | bigint) {
  return typeof amount === "bigint" ? amount : BigInt(amount);
}

/** Mengubah nilai tanggal string menjadi Date untuk penyimpanan database. */
export function toDateValue(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

/** Menjalankan operasi repository dengan fallback nilai ketika model tidak tersedia. */
export async function runSafeRepositoryOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch {
    return fallback;
  }
}

/** Membuat filter periode tanggal bulanan. */
export function createMonthlyDateRange(month?: number, year?: number) {
  if (month === undefined || year === undefined) {
    return undefined;
  }

  return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1),
  };
}
