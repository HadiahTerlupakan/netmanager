import { NextRequest, NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobilePartners } from "@/modules/users";
import { logger } from "@/lib/logger";

/** Mengambil daftar partner mobile yang dapat diundang. */
export const GET = createHandler(
  { auth: true, permissions: ["m_partners:read"] },
  async (req: NextRequest, ctx) => {
    try {
      const search = req.nextUrl.searchParams.get("search") || "";
      const page = Number.parseInt(
        req.nextUrl.searchParams.get("page") || "1",
        10,
      );
      const limit = Number.parseInt(
        req.nextUrl.searchParams.get("limit") || "20",
        10,
      );
      const result = await getMobilePartners({
        tenantId: ctx.session!.user.tenantId as string,
        userId: ctx.session!.user.id as string,
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
  },
);
