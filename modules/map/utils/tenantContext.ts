import { TenantContextError } from "@/lib/prisma-extension";

export interface TenantContext {
  tenantId: string | null | undefined;
  isSuperAdmin: boolean;
}

export interface MapListFilters {
  siteId?: string;
  /** Batasi ke satu tipe node (mis. "odp") — disaring di SQL, bukan di memori. */
  type?: string;
  /**
   * Sertakan juga node yang belum punya site saat memfilter `siteId`.
   *
   * Dibutuhkan karena dua jalur pembuatan node peta tidak pernah mengisi
   * `siteId`: sinkronisasi peta (`createManyMappingNodes`) dan import CSV.
   * Di produksi seluruh 426 ODP ber-`siteId` null. Tanpa opsi ini, form
   * pelanggan yang wajib memilih site akan selalu mendapat dropdown ODP
   * kosong. `HargaPaketRepository` sudah memakai pendekatan toleran yang sama.
   */
  includeUnassignedSite?: boolean;
}

export function buildTenantWhere(
  ctx: TenantContext,
): { tenantId?: string } | undefined {
  if (ctx.isSuperAdmin) {
    return undefined;
  }
  if (!ctx.tenantId) {
    throw new TenantContextError(
      "missing-context",
      "Non-superadmin request without tenantId",
    );
  }
  return { tenantId: ctx.tenantId };
}

export function buildMapWhere(
  ctx: TenantContext,
  filters?: MapListFilters,
):
  | {
      tenantId?: string;
      siteId?: string;
      type?: string;
      OR?: Array<{ siteId: string | null }>;
    }
  | undefined {
  const tenantWhere = buildTenantWhere(ctx);

  if (!filters?.siteId && !filters?.type) {
    return tenantWhere;
  }

  const siteWhere = filters.siteId
    ? filters.includeUnassignedSite
      ? { OR: [{ siteId: filters.siteId }, { siteId: null }] }
      : { siteId: filters.siteId }
    : {};

  return {
    ...(tenantWhere ?? {}),
    ...siteWhere,
    ...(filters.type ? { type: filters.type } : {}),
  };
}

interface SessionUser {
  tenantId?: string | null;
  isSuperAdmin?: boolean | null;
}

export function buildTenantContext(
  user: SessionUser | null | undefined,
): TenantContext {
  const isSuper = !!user?.isSuperAdmin;
  return { tenantId: user?.tenantId, isSuperAdmin: isSuper };
}
