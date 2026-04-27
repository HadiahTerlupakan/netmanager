import { NextResponse } from "next/server";
import { ensureAdminAccess } from "@/lib/server-auth";
import { AdminNotificationMonitoringRouteService } from "@/modules/notification";

const monitoringService = new AdminNotificationMonitoringRouteService();

export async function GET() {
  try {
    await ensureAdminAccess();
    const stats = await monitoringService.getPushRetryQueueStats();
    return NextResponse.json({
      success: true,
      data: stats,
      message: "Berhasil mengambil statistik antrean push retry",
    });
  } catch (error: unknown) {
    console.error("[API] Error fetching push queue stats:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Gagal mengambil statistik antrean push";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
