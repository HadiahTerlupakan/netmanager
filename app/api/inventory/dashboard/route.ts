import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { inventoryDashboardService } from "@/modules/inventory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  if (!(await hasPermission("barang:read"))) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const result = await inventoryDashboardService.getDashboardData({
      session,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat data dashboard inventaris" },
      { status: 500 },
    );
  }
}
