import type {
  AcsVendor as PrismaAcsVendor,
  AcsWifiSecurity as PrismaAcsWifiSecurity,
} from "@prisma/client";
import type {
  AcsVendorEntity,
  AcsWifiSecurityEntity,
} from "../domain/entities/AcsSettings";

/** Maps Prisma ACS vendor model to domain entity. */
export function toAcsVendorDomain(model: PrismaAcsVendor): AcsVendorEntity {
  return {
    id: model.id,
    name: model.name,
    manufacturerPatterns: model.manufacturerPatterns,
    productPatterns: model.productPatterns,
    parameterPrefix: model.parameterPrefix,
    priority: model.priority,
    enabled: model.enabled,
    description: model.description,
    serviceListPath: model.serviceListPath,
    vlanIdPath: model.vlanIdPath,
  };
}

/** Maps Prisma ACS WiFi security model to domain entity. */
export function toAcsWifiSecurityDomain(
  model: PrismaAcsWifiSecurity,
): AcsWifiSecurityEntity {
  return {
    id: model.id,
    tenantId: model.tenantId,
    productClass: model.productClass,
    parameterPath: model.parameterPath,
    wpaTypes: model.wpaTypes,
    encryptTypes: model.encryptTypes,
  };
}
