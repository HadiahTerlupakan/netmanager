import { logger } from "@/lib/logger";
import { AdminHolidayRouteService } from "@/modules/attendance";
import { createHandler } from "@/lib/api";
import { NextResponse } from "next/server";

const holidayService = new AdminHolidayRouteService();

/**
 * GET /api/mobile/holidays
 * Get holidays by year for mobile calendar view (read-only)
 */
export const GET = createHandler({ auth: true }, async (_request, ctx) => {
  try {
    const tenantId = ctx.session!.user.tenantId as string;
    const yearParam = ctx.query.year as string;
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    const holidays = await holidayService.getHolidaysByYear(year, tenantId);

    return NextResponse.json({
      success: true,
      data: holidays.map((h) => ({
        id: h.id,
        name: h.description,
        date: h.date,
        isNational: h.isNational,
      })),
    });
  } catch (error) {
    logger.error("Get holidays error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data hari libur" },
      { status: 500 },
    );
  }
});
