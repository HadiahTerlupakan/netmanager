import { logger } from "@/lib/logger";
import * as z from "zod";

import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { MobileWorkOrderPartnerService } from "@/modules/work-order";

const service = new MobileWorkOrderPartnerService();
const partnerResponseSchema = z.object({
  response: z.enum(["APPROVED", "REJECTED"], {
    error: "Response harus APPROVED atau REJECTED",
  }),
});

/**
 * Handle partner invitation response from mobile app.
 */
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    try {
      const body = partnerResponseSchema.parse(await req.json());
      const result = await service.respondToInvitation({
        workOrderId: ctx.params.id,
        actorId: ctx.session!.user.id,
        tenantId: ctx.session!.user.tenantId as string,
        response: body.response,
      });

      if (result.isAlreadyResponded === true) {
        return apiError(
          `Undangan sudah ${result.currentStatus === "APPROVED" ? "diterima" : "ditolak"} sebelumnya`,
          ErrorCodes.VALIDATION_ERROR,
          {
            status: 400,
            details: { currentStatus: result.currentStatus as string },
          },
        );
      }

      const assignment = result.assignment;

      return apiSuccess({
        assignment: {
          id: assignment.id,
          workOrderId: assignment.workOrderId,
          userId: assignment.userId,
          role: assignment.role,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          respondedAt: assignment.respondedAt,
          assignedById: assignment.assignedById,
          user: assignment.user,
        },
        message: `Undangan berhasil ${body.response === "APPROVED" ? "diterima" : "ditolak"}`,
      });
    } catch (error) {
      logger.error("[API] Error responding to partner invitation:", error);

      if (error instanceof z.ZodError) {
        return apiError("Validasi gagal", ErrorCodes.VALIDATION_ERROR, {
          status: 400,
          details: Object.fromEntries(
            error.issues.map((i) => [i.path.join(".") || "general", i.message]),
          ),
        });
      }

      if (error instanceof Error && error.message === "WORK_ORDER_NOT_FOUND") {
        return apiError("Work order tidak ditemukan", ErrorCodes.NOT_FOUND, {
          status: 404,
        });
      }

      if (
        error instanceof Error &&
        error.message === "PARTNER_ASSIGNMENT_NOT_FOUND"
      ) {
        return apiError(
          "Anda tidak diundang sebagai partner di work order ini",
          ErrorCodes.NOT_FOUND,
          { status: 404 },
        );
      }

      return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
        status: 500,
      });
    }
  },
);
