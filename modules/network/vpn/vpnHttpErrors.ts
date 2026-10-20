import type { NextResponse } from "next/server";
import { apiError, ApiErrors, ErrorCodes } from "@/lib/api-response";
import { isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  VpnDraftForbiddenError,
  VpnDraftInvalidError,
  VpnRouterActivationError,
  VpnRouterInvalidError,
  VpnRouterUnreachableError,
  VpnServerInUseError,
  VpnServerNotAvailableError,
  VpnServerUnknownError,
} from "./errors";
import { isVpnConfigured, VpnCoreError } from "./VpnCoreClient";
import { RouterNotFoundError } from "../services/mikrotik-router.access";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** True bila galat berasal dari modul VPN sehingga `vpnErrorResponse` tahu statusnya. */
export function isVpnError(error: unknown): boolean {
  return (
    error instanceof VpnServerInUseError ||
    error instanceof VpnServerUnknownError ||
    error instanceof VpnServerNotAvailableError ||
    error instanceof VpnDraftInvalidError ||
    error instanceof VpnDraftForbiddenError ||
    error instanceof VpnRouterActivationError ||
    error instanceof VpnRouterInvalidError ||
    error instanceof VpnRouterUnreachableError ||
    error instanceof VpnCoreError
  );
}

/** Mengubah galat modul VPN menjadi respons API; galat lain menjadi 500. */
export function vpnErrorResponse(error: unknown): NextResponse {
  if (error instanceof VpnServerInUseError) {
    return apiError(error.message, ErrorCodes.CONFLICT, {
      status: HTTP_CONFLICT,
      details: { routers: error.routers },
    });
  }
  if (
    error instanceof VpnServerUnknownError ||
    error instanceof VpnServerNotAvailableError ||
    error instanceof VpnDraftInvalidError ||
    error instanceof VpnRouterInvalidError
  ) {
    return ApiErrors.badRequest(error.message);
  }
  if (error instanceof RouterNotFoundError) return ApiErrors.notFound("Router");
  if (error instanceof VpnDraftForbiddenError) {
    return ApiErrors.forbidden(error.message);
  }
  if (
    error instanceof VpnRouterActivationError ||
    error instanceof VpnRouterUnreachableError
  ) {
    return apiError(error.message, ErrorCodes.EXTERNAL_SERVICE_ERROR, {
      status: HTTP_BAD_GATEWAY,
    });
  }
  if (error instanceof VpnCoreError) {
    if (error.status === HTTP_BAD_REQUEST) {
      return ApiErrors.badRequest(error.message);
    }
    if (error.status === HTTP_NOT_FOUND)
      return ApiErrors.notFound("Server VPN");
    if (error.status === HTTP_CONFLICT)
      return ApiErrors.conflict(error.message);
    return apiError(
      "Server VPN pusat tidak merespons",
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      { status: HTTP_BAD_GATEWAY },
    );
  }
  logger.error("[VPN_ADMIN]", error);
  return apiError("Terjadi kesalahan internal", ErrorCodes.INTERNAL_ERROR, {
    status: 500,
  });
}

function notConfiguredResponse(): NextResponse {
  return apiError(
    "Layanan VPN belum dikonfigurasi",
    ErrorCodes.INTERNAL_ERROR,
    {
      status: HTTP_SERVICE_UNAVAILABLE,
    },
  );
}

/**
 * Pemeriksaan awal route admin VPN: hanya superadmin, dan bila `needsCore`
 * core VPN harus sudah dikonfigurasi. Mengembalikan respons penolakan atau null.
 */
export function vpnAdminGuard(
  user: Parameters<typeof isSuperAdmin>[0],
  needsCore = true,
): NextResponse | null {
  if (!isSuperAdmin(user)) return ApiErrors.forbidden();
  if (needsCore && !isVpnConfigured()) return notConfiguredResponse();
  return null;
}

/** Pemeriksaan awal route VPN tenant: core VPN harus sudah dikonfigurasi. */
export function vpnConfiguredGuard(): NextResponse | null {
  return isVpnConfigured() ? null : notConfiguredResponse();
}
