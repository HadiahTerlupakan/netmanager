import { createHandler, apiSuccess } from "@/lib/api";
import { AdminNotificationMonitoringRouteService } from "@/modules/notification";

const monitoringService = new AdminNotificationMonitoringRouteService();

/** GET /api/admin/notifications/monitoring — statistik antrean push retry. */
export const GET = createHandler(
  { auth: true, permissions: ["notifications:read"] },
  async () => {
    const stats = await monitoringService.getPushRetryQueueStats();
    return apiSuccess(stats, {
      message: "Berhasil mengambil statistik antrean push retry",
    });
  },
);
