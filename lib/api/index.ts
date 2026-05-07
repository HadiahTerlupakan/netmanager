/**
 * API Utilities Index
 *
 * Centralized exports for API route development
 */

// Unified handler
export { createHandler } from "./handler";
export type { HandlerContext, HandlerOptions } from "./handler";

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
