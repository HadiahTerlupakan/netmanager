import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import { BandwidthRouteService } from "@/modules/network";

const bandwidthRouteService = new BandwidthRouteService();

function isRequestBodyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorDetails(value: unknown): Record<string, unknown> | undefined {
  return isRequestBodyRecord(value) ? value : undefined;
}

/** Ambil daftar bandwidth sesuai filter request. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("bandwidth:read"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat bandwidth",
      );
    }

    const bandwidths = await bandwidthRouteService.getBandwidths(
      req.url,
      session,
    );
    return apiSuccess(bandwidths);
  } catch (error: unknown) {
    logger.error("Error fetching bandwidths:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Gagal mengambil data bandwidth";
    return ApiErrors.internalError(errorMessage);
  }
}

/** Buat bandwidth baru dari payload request. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("bandwidth:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat bandwidth",
      );
    }

    const body = await req.json();
    if (!isRequestBodyRecord(body)) {
      return apiError("Validasi gagal", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const bandwidth = await bandwidthRouteService.createBandwidth(
      body,
      session,
    );
    return apiSuccess(bandwidth, {
      status: 201,
      message: "Bandwidth berhasil dibuat",
    });
  } catch (error: unknown) {
    logger.error("Error creating bandwidth:", error);
    const structuredError = error as {
      code?: string;
      message?: string;
      details?: unknown;
    };

    if (structuredError.code === "P2002") {
      return apiError("Nama bandwidth sudah digunakan", ErrorCodes.CONFLICT, {
        status: 409,
      });
    }

    if (structuredError.code === "VALIDATION_ERROR") {
      return apiError("Validasi gagal", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: toErrorDetails(structuredError.details),
      });
    }

    return ApiErrors.internalError(
      structuredError.message || "Gagal membuat bandwidth",
    );
  }
}
