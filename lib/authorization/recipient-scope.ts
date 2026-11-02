import type { Prisma } from "@prisma/client";

/**
 * Cakupan site penerima notifikasi, disamakan dengan cakupan MELIHAT data.
 *
 * Di daftar Work Order, peran tanpa toggle "Batasi ke Site Sendiri"
 * (`<resource>:site_only`) melihat semua site di tenant-nya
 * (`applySiteRestriction`, modules/work-order). Pemilih penerima notifikasi
 * dulu justru selalu mencocokkan site profil pengguna, sehingga pemegang
 * peran tanpa pembatasan hanya diberi tahu WO site rumahnya sendiri, padahal
 * WO site lain bisa ia lihat dan verifikasi.
 *
 * Seperti jalur melihat, pencocokan memakai baris permission apa adanya tanpa
 * alias (`list:site_only` tidak dianggap pembatas), dan
 * `<resource>:department_only` tetap mengunci ke departemen pengguna — orang
 * yang tidak bisa membuka WO departemen lain tidak boleh dikabari tentangnya.
 */
const SITE_ONLY_ACTION = "site_only";
const DEPARTMENT_ONLY_ACTION = "department_only";

export interface RecipientScopeTarget {
  /** Resource permission yang menentukan cakupan, mis. `workorders`. */
  resource: string;
  siteId?: string | null;
  departmentId?: string | null;
}

export interface RecipientScopeCandidate {
  departmentId: string | null;
  role: {
    permission: Array<{ resource: string; action: string }>;
  } | null;
}

/**
 * Where Prisma untuk penerima yang peran `resource`-nya tidak dibatasi ke site
 * sendiri dan bisa melihat departemen target. Tidak memuat syarat tenant;
 * pemanggil wajib menggabungkannya dengan `tenantId` eksplisit.
 */
export function buildSiteUnrestrictedRecipientWhere(
  target: RecipientScopeTarget,
): Prisma.UserWhereInput {
  const departmentVisible: Prisma.UserWhereInput[] = [
    {
      role: {
        permission: {
          none: { resource: target.resource, action: DEPARTMENT_ONLY_ACTION },
        },
      },
    },
    ...(target.departmentId ? [{ departmentId: target.departmentId }] : []),
  ];

  return {
    AND: [
      {
        role: {
          permission: {
            none: { resource: target.resource, action: SITE_ONLY_ACTION },
          },
        },
      },
      { OR: departmentVisible },
    ],
  };
}

/** Padanan di memori dari `buildSiteUnrestrictedRecipientWhere`. */
export function isSiteUnrestrictedRecipient(
  candidate: RecipientScopeCandidate,
  target: RecipientScopeTarget,
): boolean {
  const permissions = candidate.role?.permission ?? [];
  const holds = (action: string) =>
    permissions.some(
      (permission) =>
        permission.resource === target.resource && permission.action === action,
    );

  if (holds(SITE_ONLY_ACTION)) return false;
  if (!holds(DEPARTMENT_ONLY_ACTION)) return true;
  return (
    Boolean(target.departmentId) &&
    candidate.departmentId === target.departmentId
  );
}

/**
 * Syarat site lama: site profil sama, pengguna tanpa site, atau site WO ada di
 * `userSites`. Tetap dipakai untuk penerima yang dibatasi site, dan sebagai
 * satu-satunya syarat bila tenant tidak diketahui (fail-closed).
 */
export function buildHomeSiteRecipientConditions(
  siteId: string,
): Prisma.UserWhereInput[] {
  return [{ siteId }, { siteId: null }, { userSites: { some: { siteId } } }];
}

/**
 * Where Prisma lengkap cakupan site penerima untuk satu data ber-site.
 *
 * - Tanpa `siteId`: tidak ada syarat site, hanya tenant bila diketahui.
 * - Tanpa `tenantId`: hanya syarat site lama. Pelebaran lintas site tanpa
 *   pagar tenant eksplisit bisa bocor ke tenant lain, karena worker event-bus
 *   tanpa tenant berjalan di system context yang tidak disaring ekstensi.
 * - Dengan keduanya: site lama ATAU peran tanpa pembatasan site, di tenant itu.
 */
export function buildRecipientSiteScopeWhere(
  target: RecipientScopeTarget & {
    tenantId?: string | null;
    /**
     * Syarat tambahan agar seseorang boleh dilebarkan ke semua site, mis. hanya
     * verifikator. Tanpa ini, siapa pun yang lolos where pemanggil ikut melebar.
     */
    widenOnlyWhen?: Prisma.UserWhereInput;
  },
): Prisma.UserWhereInput {
  const tenantWhere = target.tenantId ? { tenantId: target.tenantId } : {};
  if (!target.siteId) return tenantWhere;

  const homeSite = buildHomeSiteRecipientConditions(target.siteId);
  if (!target.tenantId) return { OR: homeSite };

  const unrestricted = buildSiteUnrestrictedRecipientWhere(target);
  return {
    tenantId: target.tenantId,
    OR: [
      ...homeSite,
      target.widenOnlyWhen
        ? { AND: [target.widenOnlyWhen, unrestricted] }
        : unrestricted,
    ],
  };
}
