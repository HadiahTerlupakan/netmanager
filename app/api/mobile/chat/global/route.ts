import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { ChatService } from "@/modules/chat";

const chatService = new ChatService();

/**
 * Get or create global chat for current user.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.id as string;
    const tenantId = authResult.tenantId as string;
    if (!userId) {
      return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    const globalChat = await chatService.getGlobalChat(userId, tenantId);
    return NextResponse.json({ success: true, data: globalChat });
  } catch (error: unknown) {
    console.error("Error getting global chat:", error);

    if (
      error instanceof Error &&
      error.message === "Fitur chat hanya tersedia untuk karyawan."
    ) {
      return apiError(error.message, ErrorCodes.FORBIDDEN, { status: 403 });
    }

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
