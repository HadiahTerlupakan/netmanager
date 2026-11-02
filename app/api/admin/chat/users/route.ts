import {
  ChatService,
  resolveChatActor,
  userSearchQuerySchema,
} from "@/modules/chat";
import { apiSuccess, createHandler } from "@/lib/api";
import { chatFailureResponse, parseChatQuery } from "@/lib/api/chat-route";

/** Cari karyawan aktif tenant untuk diajak chat baru. */
export const GET = createHandler(
  { auth: true, permissions: ["chat:create"], feature: "chat" },
  async (req, ctx) => {
    const query = parseChatQuery(req, userSearchQuerySchema);
    if (query.response) return query.response;

    const result = await new ChatService().searchUsers(
      resolveChatActor(ctx.session!.user),
      ctx.session!.user.tenantId as string,
      query.data.search,
    );
    if (!result.success) return chatFailureResponse(result);
    return apiSuccess(result.data);
  },
);
