import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { logger } from "@/lib/logger";
import { WorkOrderService } from "@/modules/work-order";

// POST - Return materials to warehouse (creates barang masuk) for work orders
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
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

      if (!Number.isInteger(jumlah) || jumlah <= 0) {
        return apiError(
          "jumlah harus berupa angka bulat positif",
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

    try {
      const workOrderService = new WorkOrderService();
      const result = await workOrderService.returnMobileMaterials(
        ctx.params.id,
        items,
        {
          id: ctx.session!.user.id,
          name: ctx.session!.user.name,
          role: ctx.session!.user.role,
          siteId: ctx.session!.user.siteId,
          departmentId: undefined,
          tenantId: ctx.session!.user.tenantId,
          isSuperAdmin: Boolean(ctx.session!.user.isSuperAdmin),
        },
        ctx.session!.user.name,
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

      return apiSuccess({ items: result.data.items });
    } catch (error) {
      logger.error(
        "Error returning materials from work order (mobile)",
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
        message.includes("Data stok") ||
        message.includes("Kondisi")
      ) {
        return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
      }

      return apiError(message, ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }
  },
);
