/**
 * Centralized Authorization Middleware
 *
 * Re-export layer untuk backward compatibility.
 * Semua logic authorization sudah dipecah ke subfolder lib/authorization/
 */

export {
  authorize,
  type AuthorizationConfig,
  type AuthorizedSession,
  type AuthorizationResult,
} from "./authorization/evaluator";

export {
  authorizeBasic,
  authorizeWithPermission,
  authorizeWithAnyPermission,
  authorizeWithAllPermissions,
  hasPermissionInSession,
  hasAnyPermissionInSession,
  isAuthError,
  isAuthorized,
} from "./authorization/helpers";

export {
  checkSiteRestriction,
  type SiteRestrictionResult,
} from "./authorization/site-restriction";

export { logAuthAttempt } from "./authorization/audit";
