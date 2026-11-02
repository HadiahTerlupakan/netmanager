import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  chatFailureResponse,
  parseChatBody,
  parseChatQuery,
} from "@/lib/api/chat-route";
import { isTrustedChatImageUrl } from "@/lib/upload/trusted-upload-url";
import {
  ChatService,
  messagesQuerySchema,
  resolveChatActor,
  sendMessageSchema,
} from "@/modules/chat";

const chatService = new ChatService();

const PESAN_GAMBAR_LUAR =
  "Gambar ini bukan dari aplikasi. Kirim gambar lewat tombol foto di aplikasi.";

/** Halaman pesan sebuah percakapan; hanya untuk anggotanya. */
export const GET = createHandler(
  { auth: true, permissions: ["m_chat:read"] },
  async (req, ctx) => {
    const query = parseChatQuery(req, messagesQuerySchema);
    if (query.response) return query.response;

    const result = await chatService.getMessages({
      conversationId: ctx.params.id,
      actor: resolveChatActor(ctx.session!.user),
      tenantId: ctx.session!.user.tenantId!,
      cursor: query.data.cursor,
      limit: query.data.limit,
    });
    if (!result.success) return chatFailureResponse(result);
    return apiSuccess(result.data);
  },
);

/** Kirim pesan ke percakapan; hanya untuk anggotanya. */
export const POST = createHandler(
  { auth: true, permissions: ["m_chat:create"] },
  async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId!;
    const parsed = await parseChatBody(req, sendMessageSchema);
    if (parsed.response) return parsed.response;

    const { content, imageUrl } = parsed.data;
    if (imageUrl && !(await isTrustedChatImageUrl(imageUrl, req, tenantId))) {
      return ApiErrors.badRequest(PESAN_GAMBAR_LUAR);
    }

    const result = await chatService.sendMessage({
      conversationId: ctx.params.id,
      sender: resolveChatActor(ctx.session!.user),
      senderName: ctx.session!.user.name || "Mobile User",
      tenantId,
      ...(content !== undefined ? { content } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    });
    if (!result.success) return chatFailureResponse(result);
    return apiSuccess(result.data);
  },
);
