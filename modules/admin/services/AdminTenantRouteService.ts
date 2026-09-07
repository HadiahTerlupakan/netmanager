import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { prismaAuth } from "@/modules/database";
import { provisionTenantData } from "@/modules/mitra";
import { TenantDomainService } from "@/modules/tenant";
import type { ITenantRepository } from "../domain/ports/ITenantRepository";
import { TenantRepository } from "../repositories/TenantRepository";

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

export class AdminTenantRouteService {
  constructor(
    private readonly repository: ITenantRepository = new TenantRepository(),
    private readonly domainService: TenantDomainService = new TenantDomainService(),
  ) {}

  /** Ambil daftar tenant sesuai filter aktif. */
  getTenants(input: TenantQueryInput) {
    return this.repository.findMany(input);
  }

  /** Buat tenant baru dan lakukan provisioning default. */
  async createTenant(input: TenantPayload) {
    const tenant = await this.repository.create(this.buildWriteInput(input));

    await this.provisionTenant(tenant.id, tenant.name);
    await this.provisionTenantDomain(tenant.id, tenant.name);
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

    const tenant = await this.repository.update(
      id,
      this.buildWriteInput(input),
    );

    return { ok: true as const, data: tenant };
  }

  /** Hapus tenant dan kembalikan error terstruktur bila gagal. */
  async deleteTenant(id: string) {
    try {
      await this.repository.delete(id);
      return { ok: true as const };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return this.fail(
          RELATED_DATA_CODE,
          "Cannot delete tenant with existing related data (Users, etc.)",
        );
      }
      throw new Error(TENANT_DELETE_FAILED);
    }
  }

  /** Cari domain tenant duplikat selain tenant aktif. */
  private findDuplicateDomain(id: string, domain?: string | null) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) return null;

    return this.repository.findDuplicateDomain(id, normalizedDomain);
  }

  private buildWriteInput(input: TenantPayload) {
    return {
      name: input.name,
      // `undefined` berarti field tidak dikirim: biarkan nilai lama apa adanya.
      ...(input.domain === undefined
        ? {}
        : { domain: normalizeDomain(input.domain) }),
      isActive: input.isActive ?? DEFAULT_TENANT_ACTIVE,
    };
  }

  /** Provision data default tenant tanpa menggagalkan pembuatan tenant. */
  private async provisionTenant(tenantId: string, tenantName: string) {
    try {
      const result = await provisionTenantData(prismaAuth, tenantId);
      logger.info(`[TENANT_POST] Provisioned tenant ${tenantName}:`, result);
    } catch (error) {
      logger.error(
        `[TENANT_POST] Warning: Provisioning failed for tenant ${tenantId}:`,
        error,
      );
    }
  }

  /**
   * Siapkan baris domain tenant (subdomain slug) tanpa menggagalkan pembuatan.
   *
   * Tanpa baris ini tenant tidak punya subdomain maupun jalur domain kustom.
   * Kegagalannya tidak membatalkan tenant yang sudah terbentuk karena
   * `ensureForTenant` idempoten — halaman domain dan skrip backfill bisa
   * memperbaikinya belakangan.
   */
  private async provisionTenantDomain(tenantId: string, tenantName: string) {
    try {
      const record = await this.domainService.ensureForTenant(
        tenantId,
        tenantName,
      );
      logger.info(
        `[TENANT_POST] Domain slug for ${tenantName}: ${record.slug}`,
      );
    } catch (error) {
      logger.error(
        `[TENANT_POST] Failed to provision domain row for tenant ${tenantId}:`,
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
