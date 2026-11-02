import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { lingkupSiteUntuk } from "@/modules/roles/client";
import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type { MikroTikRouterEntity } from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";

export class RouterAccessDeniedError extends Error {}
export class RouterNotFoundError extends Error {}

/** Resource izin router MikroTik untuk aturan lingkup site. */
const MIKROTIK_RESOURCE = "mikrotik";

/** Izin yang mengunci pengguna ke router di site-nya sendiri. */
export const MIKROTIK_SITE_ONLY_PERMISSION = `${MIKROTIK_RESOURCE}:site_only`;

/**
 * Apakah pengguna dibatasi ke router di site-nya sendiri. Izin dicocokkan
 * persis pada daftar izin role (bukan lewat `hasPermission`, yang
 * mengembangkan `*`): role wildcard non-super tidak dianggap dibatasi.
 * Super admin selalu bebas. Aturannya didelegasikan ke `lingkupSiteUntuk`
 * supaya hanya ada satu sumber kebenaran lingkup site.
 */
export function isRestrictedToOwnRouterSite(input: {
  isSuperAdmin: boolean;
  permissions: readonly string[];
}): boolean {
  return lingkupSiteUntuk({
    permissions: input.permissions,
    resource: MIKROTIK_RESOURCE,
    siteIds: [],
    isSuperAdmin: input.isSuperAdmin,
  }).dibatasi;
}

/**
 * Site yang boleh diakses pengguna ber-`mikrotik:site_only`: seluruh
 * `userSites`-nya, atau `siteId` legacy bila belum dimigrasi. Dibaca dari
 * database (bukan sesi) supaya penugasan site terbaru langsung berlaku.
 * Daftar kosong berarti tidak ada router yang boleh diakses (gagal tertutup).
 */
export async function resolveRestrictedSiteIds(
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">,
  userId: string,
): Promise<string[]> {
  return (await loadUserSiteScope(networkRepository, userId)).allowedSiteIds;
}

async function loadUserSiteScope(
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">,
  userId: string,
): Promise<{ primarySiteId: string | null; allowedSiteIds: string[] }> {
  const user = await networkRepository.findUserSite(userId);
  if (!user) return { primarySiteId: null, allowedSiteIds: [] };
  return {
    primarySiteId: user.siteId,
    allowedSiteIds: resolveAllowedSiteIds({
      siteId: user.siteId,
      siteIds: user.siteIds,
    }),
  };
}

/**
 * Site router baru untuk pengguna terbatas: site yang ia pilih bila termasuk
 * site-nya, atau site utamanya bila tidak memilih. Melempar
 * `RouterAccessDeniedError` bila ia tidak punya site atau memilih site lain.
 */
export async function resolveRestrictedCreateSiteId(params: {
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
  userId: string;
  requestedSiteId?: string | null;
}): Promise<string> {
  const { primarySiteId, allowedSiteIds } = await loadUserSiteScope(
    params.networkRepository,
    params.userId,
  );

  if (allowedSiteIds.length === 0) {
    throw new RouterAccessDeniedError(
      "User tidak memiliki akses site untuk membuat router",
    );
  }

  if (params.requestedSiteId) {
    if (!allowedSiteIds.includes(params.requestedSiteId)) {
      throw new RouterAccessDeniedError("Akses ditolak");
    }
    return params.requestedSiteId;
  }

  return primarySiteId && allowedSiteIds.includes(primarySiteId)
    ? primarySiteId
    : allowedSiteIds[0];
}

/**
 * Pastikan perubahan site router oleh pengguna terbatas tetap di dalam
 * site-nya. `undefined` berarti site tidak diubah; `null` (melepas site)
 * ditolak karena router akan keluar dari lingkupnya.
 */
export async function ensureRestrictedUpdateSiteId(params: {
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
  userId: string;
  requestedSiteId?: string | null;
}): Promise<void> {
  if (params.requestedSiteId === undefined) return;

  const allowedSiteIds = await resolveRestrictedSiteIds(
    params.networkRepository,
    params.userId,
  );
  if (
    !params.requestedSiteId ||
    !allowedSiteIds.includes(params.requestedSiteId)
  ) {
    throw new RouterAccessDeniedError("Akses ditolak");
  }
}

async function requireRouter(params: {
  id: string;
  tenantId: string;
  routerRepository: Pick<IMikroTikRouterRepository, "findById">;
}): Promise<MikroTikRouterEntity> {
  const router = await params.routerRepository.findById(
    params.id,
    params.tenantId,
  );

  if (!router) {
    throw new RouterNotFoundError("Router tidak ditemukan");
  }

  return router;
}

async function ensureRouterSiteAccess(params: {
  router: MikroTikRouterEntity;
  userId: string;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
}): Promise<void> {
  const allowedSiteIds = await resolveRestrictedSiteIds(
    params.networkRepository,
    params.userId,
  );

  if (!params.router.siteId || !allowedSiteIds.includes(params.router.siteId)) {
    throw new RouterAccessDeniedError("Akses ditolak");
  }
}

/**
 * Ambil router milik tenant; dengan `restrictedToOwnSite`, router wajib berada
 * di salah satu site pengguna (tanpa site → ditolak).
 */
export async function getAuthorizedRouter(params: {
  id: string;
  tenantId: string;
  userId: string;
  restrictedToOwnSite: boolean;
  routerRepository: Pick<IMikroTikRouterRepository, "findById">;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
}): Promise<MikroTikRouterEntity> {
  const router = await requireRouter(params);

  if (params.restrictedToOwnSite) {
    await ensureRouterSiteAccess({
      router,
      userId: params.userId,
      networkRepository: params.networkRepository,
    });
  }

  return router;
}
