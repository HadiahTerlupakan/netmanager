import { apiSuccess, apiError, createHandler, ErrorCodes } from "@/lib/api";
import { getMobileWorkOrderRequestService } from "@/modules/work-order";

/**
 * GET /api/mobile/work-orders/request
 * Daftar pengajuan milik pengguna sendiri, beserta nasibnya.
 *
 * Hanya `m_work_order:read` yang dibutuhkan: ini membaca pengajuan sendiri,
 * bukan antrean persetujuan admin.
 */
export const GET = createHandler(
  { auth: true, permissions: ["m_work_order:read"] },
  async (_req, ctx) => {
    const pengajuan = await getMobileWorkOrderRequestService().listMyRequests(
      ctx.session!.user.id,
    );

    return apiSuccess(pengajuan);
  },
);

/**
 * POST /api/mobile/work-orders/request
 * Create a Work Order Request from Mobile App
 */
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:create"] },
  async (req, ctx) => {
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
  },
);
