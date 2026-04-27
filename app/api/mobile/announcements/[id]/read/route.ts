import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  AnnouncementServiceError,
  announcementService,
} from "@/modules/notification";

/** Menandai announcement mobile sebagai sudah dibaca. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;
    const userId = payload.sub as string;
    const tenantId = payload.tenantId as string | undefined;
    const { id: announcementId } = await params;
    const body = await request.json().catch(() => ({}));
    const portal = typeof body.portal === "string" ? body.portal : "mobile";
    const result = await announcementService.markMobileAnnouncementAsRead(
      announcementId,
      {
        userId,
        tenantId: tenantId ?? null,
        role: payload.role,
        isSuperAdmin: payload.isSuperAdmin,
      },
      portal,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AnnouncementServiceError && error.status === 404) {
      return apiError("Pengumuman tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    console.error("Mobile mark announcement read error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
