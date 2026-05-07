/**
 * Re-export tenant constants from lib for backward compatibility
 * Actual implementation moved to lib/tenant-constants.ts to avoid module boundary issues
 */

export {
  MAIN_TENANT_ID,
  MAIN_TENANT_NAME,
  isMainTenant,
} from "@/lib/tenant-constants";
