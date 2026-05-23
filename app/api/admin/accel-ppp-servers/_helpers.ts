import { NextResponse } from "next/server";
import { apiError, ApiErrors, ErrorCodes } from "@/lib/api-response";
import {
  AccelPppCliCommandError,
  AccelPppCliConnectionError,
  AccelPppCliTimeoutError,
  AccelPppDuplicateIpError,
  AccelPppRadiusNasSyncError,
  AccelPppServerNotFoundError,
  AccelPppSessionNotFoundError,
  FullRadiusModeDisabledError,
} from "@/modules/network";

/**
 * Map domain error accel-ppp ke NextResponse.
 * Why: route handler API jadi tipis—tidak perlu duplikasi mapping di tiap file.
 * Return null kalau error bukan domain accel-ppp; caller wajib re-throw.
 */
export function mapAccelPppErrorToResponse(
  error: unknown,
): NextResponse | null {
  if (error instanceof FullRadiusModeDisabledError) {
    return ApiErrors.forbidden(error.message);
  }

  if (error instanceof AccelPppServerNotFoundError) {
    return ApiErrors.notFound("Accel-PPP server");
  }

  if (error instanceof AccelPppSessionNotFoundError) {
    return ApiErrors.notFound("Sesi");
  }

  if (error instanceof AccelPppDuplicateIpError) {
    return ApiErrors.conflict(error.message);
  }

  if (error instanceof AccelPppCliCommandError) {
    // Command error mencakup "session aktif" (409) dan auth gagal (503).
    // Pakai 409 utk pesan yg jelas about state, 503 utk infra issue.
    if (
      error.message.toLowerCase().includes("sesi aktif") ||
      error.message.toLowerCase().includes("active session")
    ) {
      return ApiErrors.conflict(error.message);
    }
    return apiError(error.message, ErrorCodes.INTERNAL_ERROR, { status: 503 });
  }

  if (error instanceof AccelPppCliConnectionError) {
    return apiError(error.message, ErrorCodes.INTERNAL_ERROR, { status: 503 });
  }

  if (error instanceof AccelPppCliTimeoutError) {
    return apiError(error.message, ErrorCodes.INTERNAL_ERROR, { status: 504 });
  }

  if (error instanceof AccelPppRadiusNasSyncError) {
    return apiError(error.message, ErrorCodes.INTERNAL_ERROR, { status: 503 });
  }

  return null;
}
