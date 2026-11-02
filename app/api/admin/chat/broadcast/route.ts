import { broadcastSchema, ChatService, resolveChatActor } from "@/modules/chat";
import { apiSuccess, createHandler } from "@/lib/api";
import { chatFailureResponse, parseChatBody } from "@/lib/api/chat-route";

/** Kirim broadcast ke chat global seluruh karyawan aktif tenant. */
export const POST = createHandler(
  { auth: true, permissions: ["broadcast:create"], feature: "chat" },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const parsed = await parseChatBody(req, broadcastSchema);
    if (parsed.response) return parsed.response;

    const result = await new ChatService().broadcastMessage({
      sender: resolveChatActor(user),
      senderName: user.name || "Admin",
      tenantId: user.tenantId as string,
      content: parsed.data.content,
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
    });
    if (!result.success) return chatFailureResponse(result);

    return apiSuccess(result.data, {
      status: 201,
      message: "Broadcast berhasil dikirim",
    });
  },
);
