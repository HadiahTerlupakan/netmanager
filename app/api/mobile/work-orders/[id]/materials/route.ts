import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { WorkOrderService } from "@/modules/work-order";

// POST - Add materials/barang to work order (creates barang keluar)
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Body request tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError("Body request tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const { items } = body as { items?: unknown };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError("Items wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    for (const item of items) {
      if (!item || typeof item !== "object") {
        return apiError(
          "Item material tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      const { barangId, gudangId, jumlah, kondisi } = item as {
        barangId?: unknown;
        gudangId?: unknown;
        jumlah?: unknown;
        kondisi?: unknown;
      };

      if (typeof barangId !== "string" || !barangId.trim()) {
        return apiError("barangId wajib diisi", ErrorCodes.VALIDATION_ERROR, {
          status: 400,
        });
      }

      if (typeof gudangId !== "string" || !gudangId.trim()) {
        return apiError("gudangId wajib diisi", ErrorCodes.VALIDATION_ERROR, {
          status: 400,
        });
      }

      if (typeof jumlah !== "number" || Number.isNaN(jumlah)) {
        return apiError(
          "jumlah wajib berupa angka",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      if (
        kondisi !== undefined &&
        kondisi !== "BARU" &&
        kondisi !== "BEKAS" &&
        kondisi !== "RUSAK"
      ) {
        return apiError("kondisi tidak valid", ErrorCodes.VALIDATION_ERROR, {
          status: 400,
        });
      }
    }

    const workOrderService = new WorkOrderService();
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
