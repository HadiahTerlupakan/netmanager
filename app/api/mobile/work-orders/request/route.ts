import { apiSuccess, apiError, createHandler, ErrorCodes } from "@/lib/api";
import { getMobileWorkOrderRequestService } from "@/modules/work-order";

/**
 * POST /api/mobile/work-orders/request
 * Create a Work Order Request from Mobile App
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const userSession = ctx.session!.user;

  const body = await req.json();
  ctx.validated = body; // Sync for audit log

  if (!body.type || !body.title || !body.description) {
    return apiError(
      "Tipe, judul, dan deskripsi wajib diisi",
      ErrorCodes.BAD_REQUEST,
      { status: 400 },
    );
  }

  const workOrder = await getMobileWorkOrderRequestService().createRequest(
    body,
    userSession,
  );

  return apiSuccess(workOrder, {
    message:
      "Work Order request berhasil diajukan. Menunggu persetujuan Admin.",
    status: 201,
  });
});
