/**
 * Authentication Module
 *
 * Re-export layer untuk backward compatibility.
 * Semua logic auth sudah dipecah ke subfolder lib/auth/
 */

export {
  authConfig,
  authOptions,
  handler,
  createAuthConfig,
} from "./auth/config";
export { cookies } from "./auth/cookies";
export { jwtCallback, sessionCallback } from "./auth/callbacks";
export {
  getUserPermissions,
  invalidatePermissionCache,
  invalidateRolePermissionCache,
  hasPermission,
} from "./auth/permissions";
export {
  isSuperAdmin,
  isSuperAdminUser,
  isSuperAdminRole,
  verifyAuth,
  type CanonicalAdminUser,
  type UserSession,
} from "./auth/helpers";
export {
  getCachedSession,
  setCachedSession,
  invalidateSessionCache,
} from "./auth/session";
