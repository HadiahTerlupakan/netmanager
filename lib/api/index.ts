/**
 * API Utilities Index
 *
 * Centralized exports for API route development
 */

// Unified handler
export { createHandler } from "./handler";
export type { HandlerContext, HandlerOptions } from "./handler";
export { buildSessionWithPermissions } from "./build-session-with-permissions";
export {
  requireSessionTenantId,
  requireSessionTenantIdUnlessSuperAdmin,
} from "./session-tenant";

// Response utilities
export {
  apiSuccess,
  apiError,
  apiPaginated,
  ApiErrors,
  ErrorCodes,
  withErrorHandler,
} from "@/lib/api-response";

export type {
  SuccessResponse,
  ErrorResponse,
  PaginatedResponse,
  ErrorCode,
} from "@/lib/api-response";

// Validation utilities
export {
  validateRequestBody,
  validateQuery,
  withValidation,
  withQueryValidation,
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeNumber,
  isValidUUID,
  validateFileUpload,
} from "@/lib/validation/middleware";

// Idempotency (untuk endpoint mobile yang dipanggil via SyncService replay).
export {
  idempotencyService,
  resolveIdempotencyKey,
  GenericIdempotencyService,
} from "./idempotency";
export type { IdempotencyOutcome, IdempotencyOptions } from "./idempotency";
export { executeMobileWithIdempotency } from "./idempotency-route-helpers";

// Request correlation ID (mobile ↔ backend log linking).
export { getOrCreateRequestId, buildRequestIdHeaders } from "./request-id";
