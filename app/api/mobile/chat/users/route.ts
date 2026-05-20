import { createHandler, apiSuccess } from "@/lib/api";
import { ChatService } from "@/modules/chat";

const chatService = new ChatService();

/**
 * Get list of chat users for current tenant.
 */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId!;

    const search = new URL(req.url).searchParams.get("search") || "";
    const users = await chatService.searchUsers(tenantId, search, userId);
    return apiSuccess(users);
  },
);
