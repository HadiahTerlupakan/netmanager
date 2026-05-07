import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { announcementService } from "@/modules/notification";

/** Mengambil daftar announcement mobile sesuai portal user. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.userId ?? authResult.sub;
    const tenantId =
      authResult.tenantId ??
      (authResult as { tenant?: string | null }).tenant ??
      null;

    if (!userId) {
      return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    const announcements = await announcementService.getMobileAnnouncements({
      userId,
      tenantId,
      role: authResult.role,
      isSuperAdmin: authResult.isSuperAdmin,
      accessAdminPanel: Boolean(authResult.accessAdminPanel),
    });

    return NextResponse.json(announcements);
  } catch (error) {
    logger.error("Mobile announcement listing error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
