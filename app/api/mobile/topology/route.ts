import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { MobileTopologyService } from "@/modules/network";

const topologyService = new MobileTopologyService();
const CACHE_HEADER = "public, s-maxage=60, stale-while-revalidate=300";

export const GET = createHandler(
  { auth: true, permissions: ["m_topology:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId as string;

    try {
      const topology = await topologyService.getTopology(tenantId);
      return NextResponse.json(topology, {
        headers: { "Cache-Control": CACHE_HEADER },
      });
    } catch (error: unknown) {
      logger.error("Error fetching topology data:", error);
      return apiError(
        "Gagal mengambil data topologi",
        ErrorCodes.INTERNAL_ERROR,
        { status: 500 },
      );
    }
  },
);
