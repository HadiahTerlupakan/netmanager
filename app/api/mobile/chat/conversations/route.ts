import { createHandler, apiSuccess } from "@/lib/api";
import { chatFailureResponse, parseChatBody } from "@/lib/api/chat-route";
import {
  ChatService,
  createConversationSchema,
  resolveChatActor,
} from "@/modules/chat";

const chatService = new ChatService();

/** Daftar percakapan untuk chat mobile. */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (_req, ctx) => {
    const conversations = await chatService.getConversations(
      resolveChatActor(ctx.session!.user),
      ctx.session!.user.tenantId!,
    );
    return apiSuccess(conversations);
  },
);

/** Buat percakapan baru dari aplikasi mobile. */
export const POST = createHandler(
  { auth: true, permissions: ["m_chat:create"] },
  async (req, ctx) => {
    const parsed = await parseChatBody(req, createConversationSchema);
    if (parsed.response) return parsed.response;

    const { participantIds, name } = parsed.data;
    const result = await chatService.createConversation({
      creator: resolveChatActor(ctx.session!.user),
      participants: participantIds.map((id) => ({ type: "user", id })),
      tenantId: ctx.session!.user.tenantId!,
      ...(name ? { name } : {}),
    });
    if (!result.success) return chatFailureResponse(result);
    return apiSuccess(result.data);
  },
);
