/**
 * Middleware Barrel Export
 * Centralized export for all middleware functions
 */

// Authentication middleware
export {
  withAuth,
  withAdminAuth,
  withEmployeeAuth,
  withOptionalAuth,
  type AuthContext,
  type AuthenticatedHandler,
} from './auth'

// Permission middleware
export {
  withPermission,
  withAnyPermission,
  withAllPermissions,
  isSuperAdmin,
} from './permission'

// RBAC filter middleware
export {
  applySiteRestriction,
  applyDepartmentRestriction,
  applyRBACRestrictions,
  createUserRelationFilter,
  type RBACFilterContext,
} from './rbac-filter'

// Error handling middleware
export {
  withErrorHandler,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from './error-handler'

// Rate limiting middleware
export {
  withRateLimit,
  withAuthRateLimit,
  RateLimits,
  type RateLimitConfig,
} from './rate-limit'
