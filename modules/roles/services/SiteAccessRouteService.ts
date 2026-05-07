import { isSuperAdminRole } from "@/lib/auth/helpers";
import { prisma } from "@/lib/prisma";

interface HybridUserLike {
  id?: string;
  role?: string;
}

interface PermissionRecord {
  resource: string;
  action: string;
}

interface SiteAssignmentRecord {
  siteId: string;
}

interface SiteOptionDTO {
  id: string;
  code: string;
  name: string;
}

/** Service untuk kebutuhan route akses site. */
export class SiteAccessRouteService {
  /** Ambil daftar site sesuai hak akses user dan resource. */
  async getAccessibleSites(user: HybridUserLike, resource?: string) {
    const dbUser = await this.getUserAccessRecord(user.id || "");
    const where = this.buildSiteWhere(dbUser, resource);
    const sites = await prisma.sites.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });

    return { sites: sites.map((site) => this.toSiteOption(site)) };
  }

  private async getUserAccessRecord(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permission: true } }, userSites: true },
    });
  }

  private buildSiteWhere(
    dbUser: {
      siteId: string | null;
      userSites: SiteAssignmentRecord[];
      role: {
        name: string;
        isSuperAdmin: boolean;
        isRestricted: boolean;
        permission: PermissionRecord[];
      } | null;
    } | null,
    resource?: string,
  ) {
    const isRestricted = this.isRestricted(dbUser, resource);
    if (!isRestricted) {
      return {};
    }

    const siteIds = this.getRestrictedSiteIds(dbUser);
    if (siteIds.length > 0) {
      return { id: { in: siteIds } };
    }

    return dbUser?.siteId ? { id: dbUser.siteId } : {};
  }

  private isRestricted(
    dbUser: {
      role: {
        name: string;
        isSuperAdmin: boolean;
        isRestricted: boolean;
        permission: PermissionRecord[];
      } | null;
    } | null,
    resource?: string,
  ): boolean {
    if (!dbUser?.role) {
      return false;
    }

    if (this.isSuperAdmin(dbUser.role)) {
      return false;
    }

    if (!resource) {
      return dbUser.role.isRestricted;
    }

    const permissions = dbUser.role.permission.map(this.toPermissionName);
    return permissions.includes(`${resource}:site_only`);
  }

  private isSuperAdmin(role: { name: string; isSuperAdmin: boolean }): boolean {
    return role.isSuperAdmin || isSuperAdminRole(role.name);
  }

  private getRestrictedSiteIds(
    dbUser: {
      siteId: string | null;
      userSites: SiteAssignmentRecord[];
    } | null,
  ): string[] {
    const siteIds = dbUser?.userSites.map((item) => item.siteId) || [];
    if (!dbUser?.siteId || siteIds.includes(dbUser.siteId)) {
      return siteIds;
    }

    return [...siteIds, dbUser.siteId];
  }

  private toPermissionName(permission: PermissionRecord): string {
    return `${permission.resource}:${permission.action}`;
  }

  private toSiteOption(site: SiteOptionDTO): SiteOptionDTO {
    return { id: site.id, code: site.code, name: site.name };
  }
}
