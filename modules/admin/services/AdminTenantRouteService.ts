import { Prisma } from "@prisma/client";
import { prisma, prismaAuth } from "@/modules/database";
import { provisionTenantData } from "@/modules/mitra";

const DEFAULT_TENANT_ACTIVE = true;
const DUPLICATE_DOMAIN_CODE = "DUPLICATE_DOMAIN";
const RELATED_DATA_CODE = "RELATED_DATA";
const TENANT_CREATE_FAILED = "Failed to create tenant";
const TENANT_UPDATE_FAILED = "Failed to update tenant";
const TENANT_DELETE_FAILED = "Failed to delete tenant";

interface TenantPayload {
  name: string;
  domain?: string | null;
  isActive?: boolean;
}

interface TenantQueryInput {
  activeOnly: boolean;
}

interface TenantMutationError {
  code: string;
  message: string;
}

function normalizeDomain(domain?: string | null) {
  return domain ? domain.toLowerCase() : null;
}

function isForeignKeyError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

export class AdminTenantRouteService {
  /** Ambil daftar tenant sesuai filter aktif. */
  async getTenants(input: TenantQueryInput) {
    return prisma.tenant.findMany({
      where: input.activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Buat tenant baru dan lakukan provisioning default. */
  async createTenant(input: TenantPayload) {
    const tenant = await prisma.tenant.create({
      data: {
        name: input.name,
        domain: normalizeDomain(input.domain),
        isActive: input.isActive ?? DEFAULT_TENANT_ACTIVE,
      },
    });

    await this.provisionTenant(tenant.id, tenant.name);
    return tenant;
  }

  /** Perbarui tenant setelah validasi domain unik. */
  async updateTenant(id: string, input: TenantPayload) {
    const duplicateDomain = await this.findDuplicateDomain(id, input.domain);
    if (duplicateDomain) {
      return this.fail(
        DUPLICATE_DOMAIN_CODE,
        "Domain is already used by another tenant",
      );
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name: input.name,
        domain: normalizeDomain(input.domain),
        isActive: input.isActive ?? DEFAULT_TENANT_ACTIVE,
      },
    });

    return { ok: true as const, data: tenant };
  }

  /** Hapus tenant dan kembalikan error terstruktur bila gagal. */
  async deleteTenant(id: string) {
    try {
      await prisma.tenant.delete({ where: { id } });
      return { ok: true as const };
    } catch (error) {
      if (isForeignKeyError(error)) {
        return this.fail(
          RELATED_DATA_CODE,
          "Cannot delete tenant with existing related data (Users, etc.)",
        );
      }
      throw new Error(TENANT_DELETE_FAILED);
    }
  }

  /** Cari domain tenant duplikat selain tenant aktif. */
  private async findDuplicateDomain(id: string, domain?: string | null) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) return null;

    return prisma.tenant.findFirst({
      where: {
        domain: normalizedDomain,
        id: { not: id },
      },
    });
  }

  /** Provision data default tenant tanpa menggagalkan pembuatan tenant. */
  private async provisionTenant(tenantId: string, tenantName: string) {
    try {
      const result = await provisionTenantData(prismaAuth, tenantId);
      console.log(`[TENANT_POST] Provisioned tenant ${tenantName}:`, result);
    } catch (error) {
      console.error(
        `[TENANT_POST] Warning: Provisioning failed for tenant ${tenantId}:`,
        error,
      );
    }
  }

  /** Bentuk hasil gagal terstruktur untuk route. */
  private fail(code: string, message: string) {
    return {
      ok: false as const,
      error: { code, message } satisfies TenantMutationError,
    };
  }
}

export const tenantRouteErrorMessages = {
  TENANT_CREATE_FAILED,
  TENANT_UPDATE_FAILED,
  TENANT_DELETE_FAILED,
  DUPLICATE_DOMAIN_CODE,
  RELATED_DATA_CODE,
};
