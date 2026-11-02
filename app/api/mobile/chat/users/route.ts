import { createHandler, apiSuccess } from "@/lib/api";
import { chatFailureResponse, parseChatQuery } from "@/lib/api/chat-route";
import {
  ChatService,
  resolveChatActor,
  userSearchQuerySchema,
} from "@/modules/chat";

const chatService = new ChatService();

/** Cari karyawan aktif tenant untuk chat baru; hanya untuk akun karyawan. */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (req, ctx) => {
    const query = parseChatQuery(req, userSearchQuerySchema);
    if (query.response) return query.response;

    const result = await chatService.searchUsers(
      resolveChatActor(ctx.session!.user),
      ctx.session!.user.tenantId!,
      query.data.search,
    );
    if (!result.success) return chatFailureResponse(result);
    return apiSuccess(result.data);
  },
);
