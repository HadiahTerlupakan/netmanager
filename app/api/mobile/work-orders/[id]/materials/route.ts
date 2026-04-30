import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  WorkOrderService,
  validateMobileMaterialPayload,
} from "@/modules/work-order";

const workOrderService = new WorkOrderService();

/** POST - Tambah material mobile ke work order. */
export async function POST(
  req: NextRequest,
  params: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const decoded = authResult;
    const userId = decoded.id as string;
    const userName = (decoded.name as string) || undefined;
    const { id } = await params.params;
    const { items } = validateMobileMaterialPayload(await req.json());

    const result = await workOrderService.addMobileMaterials(
      id,
      items,
      {
        id: userId,
        name: userName,
        role: decoded.role as string | undefined,
        siteId: decoded.siteId as string | undefined,
        departmentId: decoded.departmentId as string | undefined,
        tenantId: decoded.tenantId as string | undefined,
        isSuperAdmin: Boolean(decoded.isSuperAdmin),
      },
      userName,
    );

    if (!result.success || !result.data) {
      const code = result.code ?? "INTERNAL_ERROR";
      const status =
        code === "FORBIDDEN"
          ? 403
          : code === "NOT_FOUND"
            ? 404
            : code === "VALIDATION_ERROR"
              ? 400
              : 500;
      const errorCode =
        code === "FORBIDDEN"
          ? ErrorCodes.FORBIDDEN
          : code === "NOT_FOUND"
            ? ErrorCodes.NOT_FOUND
            : code === "VALIDATION_ERROR"
              ? ErrorCodes.VALIDATION_ERROR
              : ErrorCodes.INTERNAL_ERROR;

      return apiError(result.error || "Terjadi kesalahan server", errorCode, {
        status,
      });
    }

    return NextResponse.json({ success: true, items: result.data.items });
  } catch (error) {
    logger.error(
      "Error adding materials to work order (mobile)",
      error instanceof Error ? error : undefined,
    );

    if (error instanceof ZodError) {
      return apiError(
        error.issues[0]?.message || "Body request tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        {
          status: 400,
        },
      );
    }

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.includes("tidak ditemukan")) {
      return apiError(message, ErrorCodes.NOT_FOUND, { status: 404 });
    }
    if (
      message.includes("Akses ditolak") ||
      message.includes("tidak memiliki akses")
    ) {
      return apiError(message, ErrorCodes.FORBIDDEN, { status: 403 });
    }
    if (
      message.includes("wajib") ||
      message.includes("harus") ||
      message.includes("Stok") ||
      message.includes("Data stok")
    ) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    return apiError(message, ErrorCodes.INTERNAL_ERROR, { status: 500 });
  }
}
