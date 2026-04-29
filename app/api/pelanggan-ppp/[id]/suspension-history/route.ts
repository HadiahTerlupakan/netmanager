import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig } from "@/lib/auth";
import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan";

const pelangganPppRouteService = new PelangganPppRouteService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authConfig)) as Session | null;
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const result = await pelangganPppRouteService.getSuspensionHistory({
      id,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      suspensionType: searchParams.get("suspensionType"),
      status: (searchParams.get("status") || "all") as Parameters<
        PelangganPppRouteService["getSuspensionHistory"]
      >[0]["status"],
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      sortBy: (searchParams.get("sortBy") || "suspendedAt") as Parameters<
        PelangganPppRouteService["getSuspensionHistory"]
      >[0]["sortBy"],
      sortOrder: (searchParams.get("sortOrder") || "desc") as Parameters<
        PelangganPppRouteService["getSuspensionHistory"]
      >[0]["sortOrder"],
    });

    if (!result) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error fetching suspension history:", error);
    if (error instanceof RouteServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
