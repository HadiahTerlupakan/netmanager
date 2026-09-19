import type { Prisma, Status } from "@prisma/client";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { PelangganRepository } from "../repositories/PelangganRepository";

export class SiteAccessDeniedError extends Error {}

export interface MobilePelangganDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: Status;
  paket: string | null;
  alamat: string | null;
  noTelp: string | null;
  jatuhTempo: string;
  siteId: string | null;
  siteName: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Bentuk sesi minimal yang dibutuhkan modul ini. Sengaja bukan `Session`
 * next-auth: sesi mobile dibangun manual di `lib/api/handler.ts` dari JWT
 * bearer token, tidak pernah punya `expires`, dan tidak pernah punya
 * `user.permissions` (permission mobile hidup terpisah di `ctx.permissions`).
 * Tipe sempit ini membuat route cukup meneruskan `ctx.session!` tanpa cast.
 */
export interface MobileSessionUser {
  id: string;
  tenantId?: string;
  siteId?: string;
  siteIds?: string[];
  isSuperAdmin?: boolean;
}

interface ListInput {
  session: { user: MobileSessionUser };
  status?: Status | null;
  search?: string | null;
  siteId?: string | null;
  page: number;
  limit: number;
}

const repository = new PelangganRepository();

/** Pelanggan yang sudah dibongkar tidak relevan untuk layar mobile. */
const EXCLUDE_DISMANTLE = { not: "DISMANTLE" } as Prisma.EnumStatusFilter;

/**
 * Filter site untuk sesi mobile; melempar bila site yang diminta di luar hak akses.
 *
 * Sengaja TIDAK memakai `checkSiteRestriction` (`@/modules/roles`): fungsi
 * itu menentukan `isRestricted` dari `session.user.permissions.includes(
 * "pelanggan:site_only")`, tapi token mobile hanya membawa permission
 * `m_*` dan `ctx.session.user` dari `createHandler` tidak pernah punya
 * field `permissions` sama sekali (lihat `MobileSessionUser` di atas).
 * Akibatnya `checkSiteRestriction` SELALU mengembalikan `isRestricted:
 * false` untuk request mobile — setiap teknisi bisa melihat seluruh
 * pelanggan tenant, lintas site. Scoping di bawah ini berdiri sendiri dan
 * tidak bergantung pada permission `:site_only` sama sekali.
 */
function resolveSiteFilter(
  user: MobileSessionUser,
  requestedSiteId?: string | null,
): Prisma.StringNullableFilter | string | undefined {
  if (user.isSuperAdmin === true) {
    return requestedSiteId ?? undefined;
  }

  const allowedSiteIds = resolveAllowedSiteIds(user);

  if (allowedSiteIds.length === 0) {
    throw new SiteAccessDeniedError("User tidak memiliki akses site");
  }
  if (!requestedSiteId) {
    return { in: allowedSiteIds };
  }
  if (!allowedSiteIds.includes(requestedSiteId)) {
    throw new SiteAccessDeniedError("Site tidak diizinkan untuk user ini");
  }
  return requestedSiteId;
}

function toDTO(
  row: Awaited<
    ReturnType<PelangganRepository["findAllPaginated"]>
  >["data"][number],
): MobilePelangganDTO {
  return {
    id: row.id,
    idPelanggan: row.idPelanggan,
    nama: row.nama,
    username: row.username,
    status: row.status,
    paket: row.hargaPaket?.name ?? null,
    alamat: row.alamat ?? null,
    noTelp: row.noTelp ?? null,
    jatuhTempo: new Date(row.jatuhTempo).toISOString(),
    siteId: row.siteId ?? null,
    siteName: row.site?.name ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

/** Daftar pelanggan untuk aplikasi mobile, dibatasi tenant dan site karyawan. */
export async function listMobilePelanggan(
  input: ListInput,
): Promise<{ data: MobilePelangganDTO[]; total: number }> {
  const siteId = resolveSiteFilter(input.session.user, input.siteId);
  const { data, total } = await repository.findAllPaginated(
    {
      ...(siteId ? { siteId } : {}),
      ...(input.search ? { search: input.search } : {}),
      status: (input.status ?? EXCLUDE_DISMANTLE) as Status,
    },
    input.page,
    input.limit,
  );

  return { data: data.map(toDTO), total };
}
