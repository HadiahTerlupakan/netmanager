/**
 * Pure tenant constants - no dependencies
 * Extracted from modules/mitra to avoid circular dependency and module boundary issues
 */

export const MAIN_TENANT_ID = "0c33470a-0a95-4770-b083-a52598c490a3";
export const MAIN_TENANT_NAME = "NETMANAGER";

/**
 * Helper to check if a tenant ID is the main tenant
 */
export function isMainTenant(tenantId: string | null | undefined): boolean {
  return tenantId === MAIN_TENANT_ID;
}
