import { logger } from "@/lib/logger";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { ChatService } from "@/modules/chat";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const chatService = new ChatService();

/**
 * Get messages for a conversation.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const result = await chatService.getMessages({
      conversationId,
      userId,
      tenantId,
      cursor: searchParams.get("cursor") || undefined,
      limit: parseInt(searchParams.get("limit") || "50"),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error("Error fetching messages:", error);

    if (error instanceof Error && error.message === "Not a participant") {
      return apiError("Not a participant", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Send a message to a conversation.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.id as string;
    const userName = authResult.name as string | undefined;
    const tenantId = authResult.tenantId as string;
    if (!userId) {
      return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    const { id: conversationId } = await params;
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content : undefined;
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl : undefined;
    if ((!content || content.trim().length === 0) && !imageUrl) {
      return apiError(
        "Message content or image is required",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const message = await chatService.sendMessage({
      conversationId,
      senderId: userId,
      senderName: userName || "Mobile User",
      tenantId,
      content,
      imageUrl,
    });

    return NextResponse.json({ success: true, data: message });
  } catch (error: unknown) {
    logger.error("Error sending message:", error);

    if (error instanceof Error && error.message === "Not a participant") {
      return apiError("Not a participant", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
