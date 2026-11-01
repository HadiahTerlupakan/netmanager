import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryDashboardService,
  PESAN_BELUM_MASUK,
  pesanGagalMuat,
  pesanTanpaIzin,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) {
    return NextResponse.json({ error: PESAN_BELUM_MASUK }, { status: 401 });
  }

  if (!(await hasPermission("barang:read"))) {
    return NextResponse.json(
      { error: pesanTanpaIzin("melihat ringkasan gudang") },
      { status: 403 },
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const data = await inventoryDashboardService.getDashboardData({
      session,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });

    return apiSuccess(data);
  } catch (error: unknown) {
    logger.error("Dashboard inventaris gagal dimuat", error);
    return NextResponse.json(
      { error: pesanGagalMuat("ringkasan gudang") },
      { status: 500 },
    );
  }
}
