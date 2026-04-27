import { NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { MobileTopologyService } from "@/modules/network";

const topologyService = new MobileTopologyService();
const CACHE_HEADER = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: Request) {
  const authResult = await getMobileAuthPayload(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const permissions = authResult.permissions || [];
  if (!permissions.includes("m_topology:read")) {
    return apiError(
      "Akses ditolak: Memerlukan izin m_topology:read",
      ErrorCodes.FORBIDDEN,
      { status: 403 },
    );
  }

  try {
    const topology = await topologyService.getTopology(
      authResult.tenantId as string,
    );
    return NextResponse.json(topology, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (error: unknown) {
    console.error("Error fetching topology data:", error);
    return apiError(
      "Gagal mengambil data topologi",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
