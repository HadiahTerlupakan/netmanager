import {
  ChatService,
  createConversationSchema,
  resolveChatActor,
} from "@/modules/chat";
import { apiSuccess, createHandler } from "@/lib/api";
import { chatFailureResponse, parseChatBody } from "@/lib/api/chat-route";

/** Daftar percakapan milik admin yang login. */
export const GET = createHandler(
  { auth: true, permissions: ["chat:read"], feature: "chat" },
  async (_req, ctx) => {
    const conversations = await new ChatService().getConversations(
      resolveChatActor(ctx.session!.user),
      ctx.session!.user.tenantId as string,
    );
    return apiSuccess(conversations);
  },
);

/** Buat percakapan baru, atau kembalikan chat langsung yang sudah ada. */
export const POST = createHandler(
  { auth: true, permissions: ["chat:create"], feature: "chat" },
  async (req, ctx) => {
    const parsed = await parseChatBody(req, createConversationSchema);
    if (parsed.response) return parsed.response;

    const { participantIds, name } = parsed.data;
    const result = await new ChatService().createConversation({
      creator: resolveChatActor(ctx.session!.user),
      participants: participantIds.map((id) => ({ type: "user", id })),
      tenantId: ctx.session!.user.tenantId as string,
      ...(name ? { name } : {}),
    });
    if (!result.success) return chatFailureResponse(result);

    return apiSuccess(result.data, {
      status: 201,
      message: "Percakapan berhasil dibuat",
    });
  },
);
