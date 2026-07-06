import { apiSuccess, apiError, ErrorCodes, createHandler } from "@/lib/api";
import { logger } from "@/lib/logger";
import { getMobileAvailableWorkOrderService } from "@/modules/work-order";
import { WorkOrderValidationError } from "@/modules/work-order";

// GET - List available work orders (PENDING status, not assigned)
export const GET = createHandler(
  { auth: true, permissions: ["m_work_order:read"] },
  async (_req, ctx) => {
    const workOrders =
      await getMobileAvailableWorkOrderService().getAvailableWorkOrders(
        ctx.session!.user,
      );

    return apiSuccess(workOrders);
  },
);

// POST - Take a work order (assign to self)
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    const body = await req.json();
    const { workOrderId } = body;

    if (!workOrderId) {
      return apiError("workOrderId wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    try {
      const result =
        await getMobileAvailableWorkOrderService().claimAvailableWorkOrder(
          workOrderId,
          ctx.session!.user,
        );

      return apiSuccess(result);
    } catch (error) {
      logger.error("Work order claim validation failed", {
        workOrderId,
        userId: ctx.session!.user.id,
        userEmail: ctx.session!.user.email,
        userRole: ctx.session!.user.role,
        tenantId: ctx.session!.user.tenantId,
        errorCode:
          error instanceof WorkOrderValidationError ? error.code : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetails:
          error instanceof WorkOrderValidationError ? error.details : undefined,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof WorkOrderValidationError) {
        const response = error.toApiResponse();
        return apiError(response.message, response.error, {
          status: 400,
          details: response.details,
        });
      }

      throw error;
    }
  },
);
