import { prisma } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import type {
  AcsVendorEntity,
  AcsWifiSecurityEntity,
} from "../domain/entities/AcsSettings";
import type {
  AcsVendorInput,
  AcsWifiSecurityInput,
  IAcsSettingsRepository,
} from "../domain/ports/IAcsSettingsRepository";
import {
  toAcsVendorDomain,
  toAcsWifiSecurityDomain,
} from "../mappers/acsSettingsMapper";

const DEFAULT_VENDOR_PRIORITY = 10;
const DEFAULT_VENDOR_ENABLED = true;
const DEFAULT_SERVICE_LIST_PATH =
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*.WANPPPConnection.*.X_BROADCOM_COM_IGMP_VLANID";

const acsSettingsRepository: IAcsSettingsRepository = {
  /** Lists all ACS vendors sorted by priority and name. */
  async findAllVendors(): Promise<AcsVendorEntity[]> {
    const vendors = await prisma.acsVendor.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    return vendors.map(toAcsVendorDomain);
  },

  /** Creates a new ACS vendor. */
  async createVendor(payload: AcsVendorInput): Promise<AcsVendorEntity> {
    const vendor = await prisma.acsVendor.create({
      data: buildVendorCreateData(payload),
    });

    return toAcsVendorDomain(vendor);
  },

  /** Updates an existing ACS vendor. */
  async updateVendor(
    id: string,
    payload: AcsVendorInput,
  ): Promise<AcsVendorEntity> {
    const vendor = await prisma.acsVendor.update({
      where: { id },
      data: buildVendorUpdateData(payload),
    });

    return toAcsVendorDomain(vendor);
  },

  /** Deletes an ACS vendor by id. */
  async deleteVendor(id: string): Promise<void> {
    await prisma.acsVendor.delete({ where: { id } });
  },

  /** Lists WiFi security rules for tenant and global scope. */
  async findWifiSecurityByTenant(
    tenantId?: string | null,
  ): Promise<AcsWifiSecurityEntity[]> {
    const rules = await prisma.acsWifiSecurity.findMany({
      where: buildWifiSecurityWhere(tenantId),
      orderBy: { productClass: "asc" },
    });

    return rules.map(toAcsWifiSecurityDomain);
  },

  /** Upserts WiFi security rule by tenant and product class. */
  async upsertWifiSecurityByTenantAndProductClass(
    tenantId: string | null,
    payload: AcsWifiSecurityInput,
  ): Promise<AcsWifiSecurityEntity> {
    const rule = await prisma.acsWifiSecurity.upsert({
      where: {
        tenantId_productClass: {
          tenantId,
          productClass: payload.productClass,
        },
      },
      update: buildWifiSecurityData(payload),
      create: {
        ...buildWifiSecurityData(payload),
        productClass: payload.productClass,
        tenantId,
      },
    });

    return toAcsWifiSecurityDomain(rule);
  },

  /** Updates WiFi security rule by id. */
  async updateWifiSecurity(
    id: string,
    payload: AcsWifiSecurityInput,
  ): Promise<AcsWifiSecurityEntity> {
    const rule = await prisma.acsWifiSecurity.update({
      where: { id },
      data: {
        productClass: payload.productClass,
        ...buildWifiSecurityData(payload),
      },
    });

    return toAcsWifiSecurityDomain(rule);
  },

  /** Deletes WiFi security rule by id. */
  async deleteWifiSecurity(id: string): Promise<void> {
    await prisma.acsWifiSecurity.delete({ where: { id } });
  },
};

export const AcsSettingsRepository = acsSettingsRepository;
export type { AcsVendorInput, AcsWifiSecurityInput };

function buildVendorCreateData(payload: AcsVendorInput) {
  return {
    ...buildVendorUpdateData(payload),
    priority: payload.priority ?? DEFAULT_VENDOR_PRIORITY,
    enabled: payload.enabled ?? DEFAULT_VENDOR_ENABLED,
    serviceListPath: DEFAULT_SERVICE_LIST_PATH,
    vlanIdPath: DEFAULT_SERVICE_LIST_PATH,
  };
}

function buildVendorUpdateData(payload: AcsVendorInput) {
  return {
    name: payload.name,
    manufacturerPatterns: payload.manufacturerPatterns,
    productPatterns: payload.productPatterns,
    parameterPrefix: payload.parameterPrefix ?? null,
    priority: payload.priority,
    enabled: payload.enabled,
    description: payload.description ?? null,
  };
}

function buildWifiSecurityWhere(
  tenantId?: string | null,
): Prisma.AcsWifiSecurityWhereInput {
  if (!tenantId) {
    return { tenantId: null };
  }

  return {
    OR: [{ tenantId: null }, { tenantId }],
  };
}

function buildWifiSecurityData(payload: AcsWifiSecurityInput) {
  return {
    parameterPath: payload.parameterPath,
    wpaTypes: payload.wpaTypes ?? null,
    encryptTypes: payload.encryptTypes ?? null,
  };
}
