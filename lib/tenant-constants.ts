/**
 * Centralized Tenant Constants
 */

export const MAIN_TENANT_ID = '8bceb512-ccef-4f53-bcc8-dd372cbf87e0'
export const MAIN_TENANT_NAME = 'Radpro Network'

/**
 * Helper to check if a tenant ID is the main tenant
 */
export function isMainTenant(tenantId: string | null | undefined): boolean {
  return tenantId === MAIN_TENANT_ID
}
