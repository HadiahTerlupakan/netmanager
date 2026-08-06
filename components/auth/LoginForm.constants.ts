/**
 * Constants for LoginForm component
 * Extracted to avoid magic strings and improve maintainability
 */

export const PORTAL_PATHS = {
  ADMIN: "/admin",
  EMPLOYEE: "/karyawan",
  EMPLOYEE_DASHBOARD: "/karyawan/dashboard",
  ERROR: "/error",
} as const;

export const AUTH_ERROR_CODES = {
  ACCESS_DENIED: "AccessDenied",
  CREDENTIALS_SIGNIN: "CredentialsSignin",
  SESSION_REQUIRED: "SessionRequired",
  RATE_LIMIT: "rate limit",
  DATABASE_ERROR: "Database connection error",
} as const;

export const ERROR_MESSAGES = {
  ACCESS_DENIED:
    "Akses ditolak. Anda tidak memiliki izin untuk mengakses portal ini.",
  INVALID_CREDENTIALS: "Email atau password salah",
  SESSION_REQUIRED: "Silakan masuk untuk melanjutkan.",
  RATE_LIMIT: "Terlalu banyak percobaan login. Coba lagi dalam 1 menit.",
  DATABASE_ERROR:
    "Tidak dapat terhubung ke database. Silakan coba lagi beberapa saat.",
  UNKNOWN: "Terjadi kesalahan saat login. Silakan coba lagi.",
  UNEXPECTED: "Terjadi kesalahan tak terduga. Silakan coba lagi.",
} as const;

export const VALIDATION = {
  EMAIL_MIN_LENGTH: 1,
  PASSWORD_MIN_LENGTH: 6,
} as const;
