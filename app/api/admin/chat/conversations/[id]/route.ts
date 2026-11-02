import {
  ChatService,
  messagesQuerySchema,
  resolveChatActor,
  sendMessageSchema,
} from "@/modules/chat";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  chatFailureResponse,
  parseChatBody,
  parseChatQuery,
} from "@/lib/api/chat-route";
import { isTrustedChatImageUrl } from "@/lib/upload/trusted-upload-url";

const PESAN_GAMBAR_LUAR =
  "Gambar ini bukan dari aplikasi. Kirim gambar lewat tombol foto di aplikasi.";

/** Halaman pesan sebuah percakapan; hanya untuk anggotanya. */
export const GET = createHandler(
  { auth: true, permissions: ["chat:read"], feature: "chat" },
  async (req, ctx) => {
    const query = parseChatQuery(req, messagesQuerySchema);
    if (query.response) return query.response;

    const result = await new ChatService().getMessages({
      conversationId: ctx.params.id,
      actor: resolveChatActor(ctx.session!.user),
      tenantId: ctx.session!.user.tenantId as string,
      cursor: query.data.cursor,
      limit: query.data.limit,
    });
    if (!result.success) return chatFailureResponse(result);
    return apiSuccess(result.data);
  },
);

/** Kirim pesan ke percakapan; hanya untuk anggotanya. */
export const POST = createHandler(
  { auth: true, permissions: ["chat:create"], feature: "chat" },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const tenantId = user.tenantId as string;
    const parsed = await parseChatBody(req, sendMessageSchema);
    if (parsed.response) return parsed.response;

    const { content, imageUrl } = parsed.data;
    if (imageUrl && !(await isTrustedChatImageUrl(imageUrl, req, tenantId))) {
      return ApiErrors.badRequest(PESAN_GAMBAR_LUAR);
    }

    const result = await new ChatService().sendMessage({
      conversationId: ctx.params.id,
      sender: resolveChatActor(user),
      senderName: user.name || "Admin",
      tenantId,
      ...(content !== undefined ? { content } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    });
    if (!result.success) return chatFailureResponse(result);

    return apiSuccess(result.data, {
      status: 201,
      message: "Pesan berhasil dikirim",
    });
  },
);
