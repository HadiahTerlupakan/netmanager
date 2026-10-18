import { apiSuccess, createHandler } from "@/lib/api";
import {
  AttendanceTrackingStatusService,
  trackingStatusReportSchema,
} from "@/modules/attendance";

const trackingStatusService = new AttendanceTrackingStatusService();

/** POST /api/mobile/attendance/tracking-status — status tracking lokasi dari aplikasi. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["m_absensi:create"],
    schema: trackingStatusReportSchema,
  },
  async (_request, ctx) => {
    const result = await trackingStatusService.record({
      userId: ctx.session!.user.id,
      tenantId: ctx.session!.user.tenantId ?? undefined,
      status: ctx.validated.status,
    });
    return apiSuccess(result);
  },
);
