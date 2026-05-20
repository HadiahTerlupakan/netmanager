import { apiSuccess, apiError, ErrorCodes, createHandler } from "@/lib/api";
import { getMobileAvailableWorkOrderService } from "@/modules/work-order";

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

    const result =
      await getMobileAvailableWorkOrderService().claimAvailableWorkOrder(
        workOrderId,
        ctx.session!.user,
      );

    if (result instanceof Response) {
      return result;
    }

    return apiSuccess(result);
  },
);
