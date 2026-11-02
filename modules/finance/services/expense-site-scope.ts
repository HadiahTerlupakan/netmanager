import { isSuperAdmin } from "@/lib/auth/super-admin";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import {
  irisanSiteDiminta,
  lingkupSiteUntuk,
  siteBolehDiakses,
  siteDefaultLingkup,
  tanpaDataSamaSekali,
  type LingkupSite,
} from "@/modules/roles/client";
import type { Prisma } from "../repositories/prisma-boundary";
import { createRouteServiceError } from "./RouteServiceError";

/**
 * Lingkup site pengeluaran (`expense:site_only`).
 *
 * Dulu route membaca toggle ini lewat `hasPermission()` yang mengembangkan
 * "*" — role wildcard non-super ikut dianggap terbatas — lalu mengunci hanya
 * ke site utama pengguna. Sekarang permission dicocokkan persis dan seluruh
 * site pengguna (utama + tambahan) dihormati; pengguna terbatas tanpa site
 * tidak melihat/mengubah apa pun.
 */
const EXPENSE_SITE_SCOPE_RESOURCE = "expense";
const HTTP_FORBIDDEN = 403;
const EXPENSE_SCOPE_GENERAL = "general";

export const EXPENSE_NO_SITE_MESSAGE =
  "Akses terbatas: Site tidak ditemukan di profil anda";
export const EXPENSE_SITE_FORBIDDEN_MESSAGE =
  "Anda hanya dapat mencatat pengeluaran di site Anda";
export const EXPENSE_SITE_REQUIRED_MESSAGE =
  "Pilih salah satu site Anda untuk pengeluaran ini";

export interface ExpenseScopeUser {
  role?: string | null;
  isSuperAdmin?: boolean;
  siteId?: string | null;
  siteIds?: string[];
}

/** Lingkup site pengeluaran untuk pengguna (permission dicocokkan persis). */
export function resolveExpenseSiteScope(
  user: ExpenseScopeUser,
  permissions: readonly string[],
): LingkupSite {
  return lingkupSiteUntuk({
    permissions,
    resource: EXPENSE_SITE_SCOPE_RESOURCE,
    siteIds: resolveAllowedSiteIds(user),
    isSuperAdmin: isSuperAdmin(user),
  });
}

/**
 * Klausa `siteId` daftar pengeluaran: filter site/scope yang diminta diiriskan
 * dengan lingkup. `null` berarti tidak ada baris yang boleh tampil.
 * Pengeluaran "Umum" (`siteId = null`) di luar lingkup pengguna terbatas.
 */
export function buildExpenseSiteWhere(
  scope: LingkupSite,
  filter: { siteId?: string | null; scope?: string | null },
): Pick<Prisma.ExpenseWhereInput, "siteId"> | null {
  if (filter.scope === EXPENSE_SCOPE_GENERAL) {
    return scope.dibatasi ? null : { siteId: null };
  }
  return irisanSiteDiminta(scope, filter.siteId);
}

/** Tolak (403) pengguna terbatas yang tidak punya site sama sekali. */
export function assertExpenseScopeHasSite(scope: LingkupSite) {
  if (tanpaDataSamaSekali(scope)) {
    throw createRouteServiceError(EXPENSE_NO_SITE_MESSAGE, HTTP_FORBIDDEN);
  }
}

/**
 * Site tujuan pengeluaran baru/diubah. Pengguna tak terbatas memakai pilihan
 * apa adanya. Pengguna terbatas wajib di salah satu site-nya; bila tidak
 * memilih (kosong = "Umum") dan hanya punya satu site, site itu dipakai
 * (`siteDefaultLingkup`, aturan yang sama dengan Proyek RAB). `undefined` = tidak
 * mengubah site (hanya bermakna saat ubah).
 */
export function resolveExpenseTargetSiteId(
  scope: LingkupSite,
  requestedSiteId: string | undefined,
): string | undefined {
  if (!scope.dibatasi) return requestedSiteId;
  assertExpenseScopeHasSite(scope);
  if (requestedSiteId === undefined) return undefined;
  const targetSiteId = requestedSiteId || siteDefaultLingkup(scope);
  if (!targetSiteId) {
    throw createRouteServiceError(
      EXPENSE_SITE_REQUIRED_MESSAGE,
      HTTP_FORBIDDEN,
    );
  }
  if (!siteBolehDiakses(scope, targetSiteId)) {
    throw createRouteServiceError(
      EXPENSE_SITE_FORBIDDEN_MESSAGE,
      HTTP_FORBIDDEN,
    );
  }
  return targetSiteId;
}

/**
 * Site pengeluaran baru. Sama dengan `resolveExpenseTargetSiteId`, tetapi
 * site yang tidak dikirim diperlakukan sebagai "tidak memilih".
 */
export function resolveExpenseCreateSiteId(
  scope: LingkupSite,
  requestedSiteId: string | undefined,
): string | undefined {
  if (!scope.dibatasi) return requestedSiteId;
  return resolveExpenseTargetSiteId(scope, requestedSiteId ?? "");
}
