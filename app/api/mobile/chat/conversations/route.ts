import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { ChatService } from "@/modules/chat";

const chatService = new ChatService();

/**
 * Get conversation list for mobile chat.
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

    const conversations = await chatService.getConversations(userId, tenantId);
    return NextResponse.json({ success: true, data: conversations });
  } catch (error: unknown) {
    console.error("Error fetching conversations:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Create a new mobile chat conversation.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const participantIds = Array.isArray(body.participantIds)
      ? body.participantIds
      : [];
    if (participantIds.length === 0) {
      return apiError(
        "participantIds is required",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const conversation = await chatService.createConversation({
      creatorId: userId,
      participantIds,
      tenantId,
      name: body.name,
    });

    return NextResponse.json({ success: true, data: conversation });
  } catch (error: unknown) {
    console.error("Error creating conversation:", error);

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
