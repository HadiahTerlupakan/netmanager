import { isSuperAdminRole } from "@/lib/auth/helpers";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { prisma } from "@/lib/prisma";
import { lingkupSiteUntuk, type LingkupSite } from "../domain/lingkup-site";

interface HybridUserLike {
  id?: string;
  role?: string;
}

interface PermissionRecord {
  resource: string;
  action: string;
}

interface SiteOptionDTO {
  id: string;
  code: string;
  name: string;
}

interface SiteAccessUserRecord {
  siteId: string | null;
  userSites: { siteId: string }[];
  role: {
    name: string;
    isSuperAdmin: boolean;
    permission: PermissionRecord[];
  } | null;
}

/** Filter yang tidak cocok dengan site mana pun (gagal tertutup). */
const TIDAK_ADA_SITE = { id: { in: [] as string[] } };

/**
 * Service untuk kebutuhan route akses site (`GET /api/sites`).
 *
 * Pembatasan HANYA berasal dari `<resource>:site_only` (cocok persis), sama
 * dengan `checkSiteRestriction` yang menjaga data modulnya — sehingga pemilih
 * site menawarkan himpunan yang sama dengan data yang boleh dilihat. Kolom
 * lama `Role.isRestricted` tidak dibaca: artinya visibilitas role di dropdown
 * "Peran Pengguna", bukan lingkup data. Tanpa `resource` berarti modul itu
 * tidak menegakkan `site_only`, jadi seluruh site tenant ditampilkan; isolasi
 * tenant tetap dijaga ekstensi Prisma `withTenantIsolation`.
 */
export class SiteAccessRouteService {
  /** Ambil daftar site sesuai hak akses user dan resource. */
  async getAccessibleSites(user: HybridUserLike, resource?: string) {
    const dbUser = await this.getUserAccessRecord(user.id || "");
    const where = this.buildSiteWhere(this.resolveLingkup(dbUser, resource));
    const sites = await prisma.sites.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });

    return { sites: sites.map((site) => this.toSiteOption(site)) };
  }

  private async getUserAccessRecord(
    userId: string,
  ): Promise<SiteAccessUserRecord | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permission: true } }, userSites: true },
    });
  }

  private resolveLingkup(
    dbUser: SiteAccessUserRecord | null,
    resource: string | undefined,
  ): LingkupSite {
    if (!resource || !dbUser?.role) return { dibatasi: false };

    return lingkupSiteUntuk({
      permissions: dbUser.role.permission.map(this.toPermissionName),
      resource,
      siteIds: resolveAllowedSiteIds({
        siteId: dbUser.siteId,
        siteIds: dbUser.userSites.map((item) => item.siteId),
      }),
      isSuperAdmin:
        dbUser.role.isSuperAdmin || isSuperAdminRole(dbUser.role.name),
    });
  }

  private buildSiteWhere(lingkup: LingkupSite) {
    if (!lingkup.dibatasi) return {};
    if (lingkup.siteIds.length === 0) return TIDAK_ADA_SITE;
    return { id: { in: [...lingkup.siteIds] } };
  }

  private toPermissionName(permission: PermissionRecord): string {
    return `${permission.resource}:${permission.action}`;
  }

  private toSiteOption(site: SiteOptionDTO): SiteOptionDTO {
    return { id: site.id, code: site.code, name: site.name };
  }
}
