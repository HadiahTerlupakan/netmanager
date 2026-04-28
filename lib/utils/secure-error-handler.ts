import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Error types for better classification
export enum ErrorType {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT_ERROR",
  RATE_LIMIT = "RATE_LIMIT_ERROR",
  DATABASE = "DATABASE_ERROR",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE_ERROR",
  SYSTEM = "SYSTEM_ERROR",
  MALICIOUS_REQUEST = "MALICIOUS_REQUEST",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

// Error response interface
export interface SecureErrorResponse {
  error: string;
  code?: string;
  requestId?: string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

// Error log entry for internal monitoring
export interface ErrorLogEntry {
  requestId: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: unknown;
  context: {
    method?: string;
    url?: string;
    ip?: string;
    userAgent?: string;
    userId?: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

/**
 * Creates a secure error response that doesn't leak sensitive information
 */
export function createSecureError(
  type: ErrorType,
  userMessage?: string,
  details?: Record<string, unknown>,
): NextResponse {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // User-friendly messages based on error type
  const messages: Record<ErrorType, string> = {
    [ErrorType.VALIDATION]: "Data permintaan tidak valid",
    [ErrorType.AUTHENTICATION]: "Autentikasi diperlukan",
    [ErrorType.AUTHORIZATION]: "Akses ditolak",
    [ErrorType.NOT_FOUND]: "Data tidak ditemukan",
    [ErrorType.CONFLICT]: "Konflik data",
    [ErrorType.RATE_LIMIT]:
      "Terlalu banyak permintaan. Silakan coba lagi nanti.",
    [ErrorType.DATABASE]: "Layanan sementara tidak tersedia",
    [ErrorType.EXTERNAL_SERVICE]: "Layanan eksternal tidak tersedia",
    [ErrorType.SYSTEM]: "Layanan sementara tidak tersedia",
    [ErrorType.MALICIOUS_REQUEST]: "Permintaan tidak valid",
  };

  // HTTP status codes based on error type
  const statusCodes: Record<ErrorType, number> = {
    [ErrorType.VALIDATION]: 400,
    [ErrorType.AUTHENTICATION]: 401,
    [ErrorType.AUTHORIZATION]: 403,
    [ErrorType.NOT_FOUND]: 404,
    [ErrorType.CONFLICT]: 409,
    [ErrorType.RATE_LIMIT]: 429,
    [ErrorType.DATABASE]: 503,
    [ErrorType.EXTERNAL_SERVICE]: 502,
    [ErrorType.SYSTEM]: 500,
    [ErrorType.MALICIOUS_REQUEST]: 400,
  };

  const message = userMessage || messages[type];
  const statusCode = statusCodes[type];

  const errorResponse: SecureErrorResponse = {
    error: message,
    code: type,
    requestId,
    timestamp,
  };

  // Include safe details (non-sensitive)
  if (details && Object.keys(details).length > 0) {
    const safeDetails: Record<string, unknown> = {};

    // Only include non-sensitive fields
    const allowedFields = [
      "field",
      "limit",
      "maxSize",
      "allowedTypes",
      "retryAfter",
    ];
    for (const field of allowedFields) {
      if (details[field] !== undefined) {
        safeDetails[field] = details[field];
      }
    }

    if (Object.keys(safeDetails).length > 0) {
      errorResponse.details = safeDetails;
    }
  }

  return NextResponse.json(errorResponse, { status: statusCode });
}

/**
 * Creates a validation error response
 */
export function createValidationError(
  errors: Array<{ field: string; message: string }>,
): NextResponse {
  return createSecureError(ErrorType.VALIDATION, "Validation failed", {
    validationErrors: errors.map((err) => ({
      field: err.field,
      // Don't expose detailed validation messages to prevent information leakage
      message: "Nilai tidak valid",
    })),
  });
}

/**
 * Creates an authentication error response
 */
export function createAuthError(message?: string): NextResponse {
  return createSecureError(
    ErrorType.AUTHENTICATION,
    message || "Autentikasi diperlukan",
  );
}

/**
 * Creates an authorization error response
 */
export function createAuthorizationError(message?: string): NextResponse {
  return createSecureError(ErrorType.AUTHORIZATION, message || "Akses ditolak");
}

/**
 * Creates a rate limit error response
 */
export function createRateLimitError(retryAfter?: number): NextResponse {
  const response = createSecureError(
    ErrorType.RATE_LIMIT,
    "Too many requests. Please try again later.",
    retryAfter ? { retryAfter } : undefined,
  );

  if (retryAfter) {
    response.headers.set("Retry-After", retryAfter.toString());
  }

  return response;
}

/**
 * Creates a file upload error response
 */
export function createFileUploadError(
  type: "size" | "type" | "malicious",
  details?: {
    maxSize?: number | string;
    allowedTypes?: string[] | string;
    retryAfter?: number;
  },
): NextResponse {
  const messages = {
    size: "File size exceeds maximum allowed limit",
    type: "File type not allowed",
    malicious: "Invalid file content",
  };

  return createSecureError(ErrorType.VALIDATION, messages[type], details);
}

/**
 * Logs errors securely for internal monitoring
 */
export function logSecureError(
  type: ErrorType,
  severity: ErrorSeverity,
  originalError: unknown,
  context: Record<string, unknown>,
  userMessage?: string,
): void {
  const requestId = crypto.randomUUID();

  const err = originalError as { message?: string };
  const logEntry: ErrorLogEntry = {
    requestId,
    type,
    severity,
    message: userMessage || err?.message || "Terjadi kesalahan",
    originalError:
      process.env.NODE_ENV === "development" ? originalError : undefined,
    context: {
      ...context,
      // Sanitize sensitive fields
      password: undefined,
      token: undefined,
      apiKey: undefined,
      secret: undefined,
      // Keep other fields for debugging
      method: context.method as string,
      url: context.url as string,
      ip: context.ip as string,
      userAgent: context.userAgent as string,
      userId: context.userId as string,
    },
    timestamp: new Date().toISOString(),
  };

  // In production, this would log to a secure logging service
  if (severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH) {
    logger.error("[SECURITY ERROR]", JSON.stringify(logEntry));
  } else {
    logger.warn(
      "[ERROR]",
      JSON.stringify({
        requestId: logEntry.requestId,
        type: logEntry.type,
        severity: logEntry.severity,
        message: logEntry.message,
        timestamp: logEntry.timestamp,
      }),
    );
  }
}

/**
 * Handles API route errors securely
 */
export function handleApiError(
  error: unknown,
  context: Record<string, unknown>,
): NextResponse {
  // Classify the error type
  let type = ErrorType.SYSTEM;
  let severity = ErrorSeverity.MEDIUM;

  const err = error as {
    name?: string;
    type?: string;
    code?: string;
    message?: string;
    errors?: unknown;
  };

  if (err.name === "ZodError" || err.type === "validation") {
    type = ErrorType.VALIDATION;
    severity = ErrorSeverity.LOW;
  } else if (err.code === "P2002") {
    // Prisma unique constraint
    type = ErrorType.CONFLICT;
    severity = ErrorSeverity.LOW;
  } else if (err.code === "P2025") {
    // Prisma not found
    type = ErrorType.NOT_FOUND;
    severity = ErrorSeverity.LOW;
  } else if (err.message?.includes("auth") || err.type === "authentication") {
    type = ErrorType.AUTHENTICATION;
    severity = ErrorSeverity.HIGH;
  } else if (
    err.message?.includes("unauthorized") ||
    err.type === "authorization"
  ) {
    type = ErrorType.AUTHORIZATION;
    severity = ErrorSeverity.HIGH;
  } else if (err.message?.includes("rate limit") || err.type === "rate_limit") {
    type = ErrorType.RATE_LIMIT;
    severity = ErrorSeverity.MEDIUM;
  } else if (err.message?.includes("malicious") || err.type === "malicious") {
    type = ErrorType.MALICIOUS_REQUEST;
    severity = ErrorSeverity.CRITICAL;
  }

  // Log the error securely
  logSecureError(type, severity, error, context);

  // Return appropriate error response
  if (type === ErrorType.VALIDATION && err.errors) {
    return createValidationError(
      err.errors as Array<{ field: string; message: string }>,
    );
  }

  return createSecureError(type);
}

/**
 * Wrapper for API route handlers with secure error handling
 */
export function withSecureErrorHandler<
  T extends Record<string, unknown> = Record<string, never>,
>(handler: (request: Request, context: T) => Promise<NextResponse>) {
  return async (request: Request, context: T): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      const requestContext = {
        method: request.method,
        url: request.url,
        ip: "unknown", // Will be extracted in middleware
        userAgent: request.headers.get("user-agent") || undefined,
        ...context,
      };

      return handleApiError(error, requestContext);
    }
  };
}

/**
 * Creates a success response with consistent format
 */
// Alias for backward compatibility
export const createSecureErrorResponse = createSecureError;

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>,
): NextResponse {
  const response = {
    success: true,
    message: message || "Request completed successfully",
    data,
    meta,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
