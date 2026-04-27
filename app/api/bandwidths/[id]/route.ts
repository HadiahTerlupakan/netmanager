import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
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

/** Ambil detail bandwidth berdasarkan ID. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof Response) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { id } = await params;
    const bandwidth = await bandwidthRouteService.getBandwidthById(id);
    if (!bandwidth) {
      return ApiErrors.notFound("Bandwidth");
    }

    return apiSuccess(bandwidth);
  } catch (error: unknown) {
    console.error("Error fetching bandwidth:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Gagal mengambil data bandwidth";
    return ApiErrors.internalError(errorMessage);
  }
}

/** Perbarui bandwidth berdasarkan ID. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof Response) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { id } = await params;
    const body = await req.json();
    if (!isRequestBodyRecord(body)) {
      return apiError("Validasi gagal", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const bandwidth = await bandwidthRouteService.updateBandwidth(id, body);
    return apiSuccess(bandwidth, { message: "Bandwidth berhasil diperbarui" });
  } catch (error: unknown) {
    console.error("Error updating bandwidth:", error);
    const structuredError = error as {
      code?: string;
      message?: string;
      details?: unknown;
    };

    if (structuredError.code === "P2025") {
      return ApiErrors.notFound("Bandwidth");
    }

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
      structuredError.message || "Gagal memperbarui bandwidth",
    );
  }
}

/** Hapus bandwidth berdasarkan ID. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(req);
    if (session instanceof Response) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { id } = await params;
    await bandwidthRouteService.deleteBandwidth(id);
    return apiSuccess(null, { message: "Bandwidth berhasil dihapus" });
  } catch (error: unknown) {
    console.error("Error deleting bandwidth:", error);
    const structuredError = error as { code?: string; message?: string };

    if (structuredError.code === "P2025") {
      return ApiErrors.notFound("Bandwidth");
    }

    if (structuredError.code === "P2003") {
      return apiError(
        "Bandwidth tidak dapat dihapus karena masih digunakan oleh paket",
        ErrorCodes.CONFLICT,
        { status: 409 },
      );
    }

    if (structuredError.message?.startsWith("CONFLICT:")) {
      return apiError(
        structuredError.message.replace("CONFLICT:", ""),
        ErrorCodes.CONFLICT,
        { status: 409 },
      );
    }

    if (structuredError.message?.startsWith("NOT_FOUND:")) {
      return ApiErrors.notFound(
        structuredError.message.replace("NOT_FOUND:", ""),
      );
    }

    return ApiErrors.internalError(
      structuredError.message || "Gagal menghapus bandwidth",
    );
  }
}
