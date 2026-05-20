import { ZodError } from "zod";
import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  WorkOrderService,
  validateMobileMaterialPayload,
} from "@/modules/work-order";

const workOrderService = new WorkOrderService();

/** POST - Tambah material mobile ke work order. */
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    try {
      const { items } = validateMobileMaterialPayload(await req.json());

      const result = await workOrderService.addMobileMaterials(
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
        "Error adding materials to work order (mobile)",
        error instanceof Error ? error : undefined,
      );

      if (error instanceof ZodError) {
        return apiError(
          error.issues[0]?.message || "Body request tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
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
  },
);
