import { createHandler, apiSuccess } from "@/lib/api";
import { ChatService } from "@/modules/chat";

const chatService = new ChatService();

/**
 * Get or create global chat for current user.
 */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (_req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId!;

    const globalChat = await chatService.getGlobalChat(userId, tenantId);
    return apiSuccess(globalChat);
  },
);
