import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

import { ApiErrors, apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getMobilePartners } from "@/modules/users";

/** Mengambil daftar partner mobile yang dapat diundang. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const permissions = authResult.permissions || [];
    if (!permissions.includes("m_partners:read")) {
      return ApiErrors.forbidden(
        "Akses ditolak: Memerlukan izin m_partners:read",
      );
    }

    const search = request.nextUrl.searchParams.get("search") || "";
    const page = Number.parseInt(
      request.nextUrl.searchParams.get("page") || "1",
      10,
    );
    const limit = Number.parseInt(
      request.nextUrl.searchParams.get("limit") || "20",
      10,
    );
    const result = await getMobilePartners({
      tenantId: authResult.tenantId as string,
      userId: authResult.id as string,
      search,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("Mobile Partner List Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
