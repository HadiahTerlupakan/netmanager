import { TenantContextError } from "@/lib/prisma-extension";

export interface TenantContext {
  tenantId: string | null | undefined;
  isSuperAdmin: boolean;
}

/** Lingkup keterlihatan node/jalur peta. */
export type LingkupPeta = "nyata" | "rencana" | "semua";

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
  /**
   * Bawaan `"nyata"`: hanya node yang benar-benar terpasang.
   *
   * Titik rencana OSP hidup di tabel yang sama dengan topologi nyata. Penyaring
   * ini sengaja bersifat bawaan, bukan tanggung jawab pemanggil, supaya lupa
   * menyaring tidak mungkin terjadi karena bentuknya — bukan karena disiplin.
   * Konsekuensi terburuk bila bocor: pelanggan disambungkan ke ODP yang
   * fisiknya belum ada.
   */
  lingkup?: LingkupPeta;
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

/** Batasan `isPlanned` untuk sebuah lingkup; `{}` berarti tanpa batasan. */
export function batasanLingkup(lingkup: LingkupPeta = "nyata") {
  if (lingkup === "semua") return {};
  return { isPlanned: lingkup === "rencana" };
}

/** Menyusun `where` node peta: tenant, lingkup (bawaan nyata), site, dan tipe. */
export function buildMapWhere(ctx: TenantContext, filters?: MapListFilters) {
  const tenantWhere = buildTenantWhere(ctx) ?? {};
  const lingkupWhere = batasanLingkup(filters?.lingkup);

  const siteWhere = filters?.siteId
    ? filters.includeUnassignedSite
      ? { OR: [{ siteId: filters.siteId }, { siteId: null }] }
      : { siteId: filters.siteId }
    : {};

  return {
    ...tenantWhere,
    ...lingkupWhere,
    ...siteWhere,
    ...(filters?.type ? { type: filters.type } : {}),
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
