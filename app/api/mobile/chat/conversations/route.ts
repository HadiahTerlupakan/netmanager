import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { ChatService } from "@/modules/chat";

const chatService = new ChatService();

/**
 * Get conversation list for mobile chat.
 */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId!;

    const conversations = await chatService.getConversations(userId, tenantId);
    return apiSuccess(conversations);
  },
);

/**
 * Create a new mobile chat conversation.
 */
export const POST = createHandler(
  { auth: true, permissions: ["m_chat:create"] },
  async (req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId!;

    const body = await req.json();
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

    return apiSuccess(conversation);
  },
);
