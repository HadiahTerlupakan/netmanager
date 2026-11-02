import { isSuperAdmin } from "@/lib/auth/super-admin";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { AppError } from "@/lib/errors";
import {
  irisanSiteDiminta,
  lingkupSiteUntuk,
  siteBolehDiakses,
  siteDefaultLingkup,
  type LingkupSite,
} from "@/modules/roles";
import type { IRabProjectSiteLookup } from "../domain/ports/IRabProjectRepository";
import { RabProjectRepository } from "../repositories/RabProjectRepository";
import type { Prisma } from "../repositories/prisma-boundary";

/**
 * Layar Proyek RAB dijaga `expense:*`, tetapi dulu tidak satu pun endpoint-nya
 * membaca `expense:site_only`: admin keuangan yang dibatasi ke satu site tetap
 * melihat, mengubah, menyalin, dan menghapus RAB seluruh site. `RabProject`
 * punya `siteId`, jadi lingkupnya ditegakkan di sini.
 */
const RAB_SITE_SCOPE_RESOURCE = "expense";
const PROJECT_NOT_FOUND_MESSAGE = "Proyek RAB tidak ditemukan";
const SITE_FORBIDDEN_MESSAGE =
  "Anda hanya dapat mengelola proyek RAB di site Anda";

export interface RabScopeUser {
  role?: string | null;
  isSuperAdmin?: boolean;
  siteId?: string | null;
  siteIds?: string[];
}

/** Lingkup site Proyek RAB untuk pengguna (permission dicocokkan persis). */
export function resolveRabSiteScope(
  user: RabScopeUser,
  permissions: readonly string[],
): LingkupSite {
  return lingkupSiteUntuk({
    permissions,
    resource: RAB_SITE_SCOPE_RESOURCE,
    siteIds: resolveAllowedSiteIds(user),
    isSuperAdmin: isSuperAdmin(user),
  });
}

/**
 * Klausa `siteId` daftar RAB: site yang diminta diiriskan dengan lingkup.
 * `null` berarti tidak ada baris yang boleh tampil.
 */
export function buildRabSiteWhere(
  scope: LingkupSite,
  requestedSiteId?: string | null,
): Prisma.RabProjectWhereInput | null {
  return irisanSiteDiminta(scope, requestedSiteId);
}

/**
 * Site proyek RAB baru. Form RAB menjadikan site opsional; pengguna terbatas
 * yang hanya punya satu site otomatis memakai site itu, alih-alih ditolak
 * karena membiarkan pilihan site kosong.
 */
export function resolveRabCreateSiteId(
  scope: LingkupSite,
  requestedSiteId: string | null | undefined,
): string | null {
  return requestedSiteId || siteDefaultLingkup(scope);
}

/** Penjaga akses per proyek RAB berdasarkan site proyek. */
export class RabProjectSiteAccessService {
  constructor(
    private readonly rabProjectRepository: IRabProjectSiteLookup = createDefaultSiteLookup(),
  ) {}

  /**
   * Pastikan proyek berada di lingkup site. Di luar lingkup dijawab 404 agar
   * keberadaan proyek site lain tidak bocor.
   */
  async assertProjectAccessible(projectId: string, scope: LingkupSite) {
    if (!scope.dibatasi) return;
    const project = await this.rabProjectRepository.findById(projectId);
    if (!project || !siteBolehDiakses(scope, project.siteId)) {
      throw new AppError(PROJECT_NOT_FOUND_MESSAGE, 404, "NOT_FOUND");
    }
  }

  /**
   * Versi tanpa lempar untuk rute persetujuan/pengingat RAB (`getServerSession`,
   * bukan `createHandler`): `true` bila proyek berada di lingkup site pengguna.
   * Penyetuju yang dibatasi `expense:site_only` hanya boleh bertindak atas RAB
   * site-nya, sama seperti layar daftar dan detail.
   */
  async isProjectInUserScope(
    projectId: string,
    user: RabScopeUser,
    permissions: readonly string[],
  ): Promise<boolean> {
    const scope = resolveRabSiteScope(user, permissions);
    if (!scope.dibatasi) return true;
    const project = await this.rabProjectRepository.findById(projectId);
    return Boolean(project && siteBolehDiakses(scope, project.siteId));
  }

  /**
   * Pastikan site tujuan (buat/ubah proyek) ada dalam lingkup. `undefined`
   * berarti site tidak diubah; `null` (tanpa site) ditolak untuk pengguna
   * terbatas karena proyek itu akan keluar dari lingkupnya sendiri.
   */
  assertTargetSiteAllowed(
    scope: LingkupSite,
    targetSiteId: string | null | undefined,
  ) {
    if (targetSiteId === undefined) return;
    if (!siteBolehDiakses(scope, targetSiteId)) {
      throw new AppError(SITE_FORBIDDEN_MESSAGE, 403, "FORBIDDEN");
    }
  }
}

function createDefaultSiteLookup(): IRabProjectSiteLookup {
  return new RabProjectRepository();
}
