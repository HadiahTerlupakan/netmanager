import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { ChatService, resolveChatActor } from "@/modules/chat";

const chatService = new ChatService();

/** Get messages for a conversation. */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId!;
    const conversationId = ctx.params.id;

    const { searchParams } = new URL(req.url);
    const result = await chatService.getMessages({
      conversationId,
      actor: resolveChatActor(ctx.session!.user),
      tenantId,
      cursor: searchParams.get("cursor") || undefined,
      limit: parseInt(searchParams.get("limit") || "50"),
    });

    return apiSuccess(result);
  },
);

/** Send a message to a conversation. */
export const POST = createHandler(
  { auth: true, permissions: ["m_chat:create"] },
  async (req, ctx) => {
    const userName = ctx.session!.user.name;
    const tenantId = ctx.session!.user.tenantId!;
    const conversationId = ctx.params.id;

    const body = await req.json();
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
      sender: resolveChatActor(ctx.session!.user),
      senderName: userName || "Mobile User",
      tenantId,
      content,
      imageUrl,
    });

    return apiSuccess(message);
  },
);
