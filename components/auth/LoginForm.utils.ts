/**
 * Utility functions for LoginForm
 * Extracted to improve testability and reduce complexity
 */

import {
  AUTH_ERROR_CODES,
  ERROR_MESSAGES,
  PORTAL_PATHS,
} from "./LoginForm.constants";

/**
 * Map NextAuth error codes to user-friendly messages
 */
export function getErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;

  switch (errorCode) {
    case AUTH_ERROR_CODES.ACCESS_DENIED:
      return ERROR_MESSAGES.ACCESS_DENIED;
    case AUTH_ERROR_CODES.CREDENTIALS_SIGNIN:
      return ERROR_MESSAGES.INVALID_CREDENTIALS;
    case AUTH_ERROR_CODES.SESSION_REQUIRED:
      return ERROR_MESSAGES.SESSION_REQUIRED;
    default:
      return ERROR_MESSAGES.UNKNOWN;
  }
}

/**
 * Check if error is related to rate limiting
 */
export function isRateLimitError(error: string): boolean {
  return (
    error.includes("Terlalu banyak percobaan") ||
    error.includes(AUTH_ERROR_CODES.RATE_LIMIT)
  );
}

/**
 * Check if error is related to database connection
 */
export function isDatabaseError(error: string): boolean {
  return error.includes(AUTH_ERROR_CODES.DATABASE_ERROR);
}

/**
 * Check if error is related to invalid credentials
 */
export function isCredentialsError(error: string): boolean {
  return (
    error.includes(AUTH_ERROR_CODES.CREDENTIALS_SIGNIN) ||
    error.includes("credentials") ||
    error.includes("password")
  );
}

/**
 * Determine if current environment is localhost
 */
export function isLocalhostEnvironment(): boolean {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Get target path after successful login
 */
export function getTargetPath(
  responseUrl: string | null | undefined,
  callbackUrl: string,
  isEmployeePortal: boolean,
): string {
  // Extract path from response URL
  const targetPathBase = responseUrl
    ? responseUrl.startsWith("http")
      ? new URL(responseUrl).pathname
      : responseUrl
    : callbackUrl;

  // Ensure correct portal prefix
  if (isEmployeePortal) {
    return targetPathBase.startsWith(PORTAL_PATHS.EMPLOYEE)
      ? targetPathBase
      : PORTAL_PATHS.EMPLOYEE;
  }

  return targetPathBase.startsWith(PORTAL_PATHS.ADMIN)
    ? targetPathBase
    : PORTAL_PATHS.ADMIN;
}
