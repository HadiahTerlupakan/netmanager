import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { MAIN_TENANT_ID } from "./tenant-constants";

const SENSITIVE_SETTING_KEYS = new Set([
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "GOOGLE_GEMINI_API_KEY",
  "captcha_secret_key",
  "captcha_site_key",
]);

export interface TenantProvisioningResult {
  rolesCreated: number;
  permissionsCreated: number;
  settingsCreated: number;
}

export class TenantProvisioningService {
  constructor(
    private readonly prismaClient: PrismaClient,
    private readonly createId: () => string = randomUUID,
    private readonly createDate: () => Date = () => new Date(),
  ) {}

  /** Provision default roles, permissions, and settings for a tenant. */
  async provisionTenantData(
    tenantId: string,
  ): Promise<TenantProvisioningResult> {
    const permissionsCreated = await this.clonePermissions(tenantId);
    const rolesCreated = await this.cloneRoles(tenantId);
    await this.ensureAdminRole(tenantId);
    const settingsCreated = await this.cloneSettings(tenantId);

    return { rolesCreated, permissionsCreated, settingsCreated };
  }

  /** Get tenant admin role id, preferring super admin roles. */
  async getTenantAdminRoleId(tenantId: string): Promise<string | null> {
    const superAdminRole = await this.prismaClient.role.findFirst({
      where: { tenantId, isSuperAdmin: true },
      select: { id: true },
    });

    if (superAdminRole) {
      return superAdminRole.id;
    }

    const adminRole = await this.prismaClient.role.findFirst({
      where: { tenantId, accessAdminPanel: true },
      select: { id: true },
    });

    return adminRole?.id || null;
  }

  private async clonePermissions(tenantId: string) {
    const mainPermissions = await this.prismaClient.permission.findMany({
      where: { tenantId: MAIN_TENANT_ID },
    });
    let permissionsCreated = 0;

    for (const permission of mainPermissions) {
      const exists = await this.prismaClient.permission.findFirst({
        where: {
          resource: permission.resource,
          action: permission.action,
          tenantId,
        },
      });

      if (exists) {
        continue;
      }

      await this.prismaClient.permission.create({
        data: {
          id: this.createId(),
          name: permission.name,
          action: permission.action,
          resource: permission.resource,
          description: permission.description,
          tenantId,
          updatedAt: this.createDate(),
        },
      });
      permissionsCreated += 1;
    }

    return permissionsCreated;
  }

  private async cloneRoles(tenantId: string) {
    const mainRoles = await this.prismaClient.role.findMany({
      where: { tenantId: MAIN_TENANT_ID, isSuperAdmin: false },
      include: { permission: { select: { resource: true, action: true } } },
    });

    for (const role of mainRoles) {
      const tenantPermissions = await this.findTenantRolePermissions(
        tenantId,
        role.permission,
      );

      await this.prismaClient.role.create({
        data: {
          id: this.createId(),
          name: role.name,
          description: role.description,
          accessAdminPanel: role.accessAdminPanel,
          accessEmployeePanel: role.accessEmployeePanel,
          isRestricted: role.isRestricted,
          isTechnical: role.isTechnical,
          isSuperAdmin: false,
          canApproveRab: role.canApproveRab,
          tenantId,
          updatedAt: this.createDate(),
          permission: {
            connect: tenantPermissions.map((permission) => ({
              id: permission.id,
            })),
          },
        },
      });
    }

    return mainRoles.length;
  }

  private async ensureAdminRole(tenantId: string) {
    const existingAdmin = await this.getTenantAdminRoleId(tenantId);

    if (existingAdmin) {
      return;
    }

    const tenantPermissions = await this.prismaClient.permission.findMany({
      where: { tenantId },
      select: { id: true },
    });

    await this.prismaClient.role.create({
      data: {
        id: this.createId(),
        name: "ADMIN",
        description: "Administrator dengan akses penuh (Auto-generated)",
        accessAdminPanel: true,
        accessEmployeePanel: true,
        isRestricted: true,
        isTechnical: false,
        isSuperAdmin: false,
        canApproveRab: true,
        tenantId,
        updatedAt: this.createDate(),
        permission: {
          connect: tenantPermissions.map((permission) => ({
            id: permission.id,
          })),
        },
      },
    });
  }

  private async cloneSettings(tenantId: string) {
    const mainSettings = await this.prismaClient.settings.findMany({
      where: { tenantId: MAIN_TENANT_ID, encrypted: false },
    });
    let settingsCreated = 0;

    for (const setting of mainSettings) {
      if (SENSITIVE_SETTING_KEYS.has(setting.key)) {
        continue;
      }

      const exists = await this.prismaClient.settings.findFirst({
        where: { key: setting.key, tenantId },
      });

      if (exists) {
        continue;
      }

      await this.prismaClient.settings.create({
        data: {
          id: this.createId(),
          key: setting.key,
          value: setting.value,
          encrypted: false,
          description: setting.description,
          tenantId,
          updatedAt: this.createDate(),
        },
      });
      settingsCreated += 1;
    }

    return settingsCreated;
  }

  private findTenantRolePermissions(
    tenantId: string,
    permissions: Array<{ resource: string; action: string }>,
  ) {
    return this.prismaClient.permission.findMany({
      where: {
        tenantId,
        OR: permissions.map((permission) => ({
          resource: permission.resource,
          action: permission.action,
        })),
      },
      select: { id: true },
    });
  }
}

export function provisionTenantData(
  prismaClient: PrismaClient,
  tenantId: string,
): Promise<TenantProvisioningResult> {
  return new TenantProvisioningService(prismaClient).provisionTenantData(
    tenantId,
  );
}

export function getTenantAdminRoleId(
  prismaClient: PrismaClient,
  tenantId: string,
): Promise<string | null> {
  return new TenantProvisioningService(prismaClient).getTenantAdminRoleId(
    tenantId,
  );
}
