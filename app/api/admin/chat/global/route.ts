import { ChatService, resolveChatActor } from "@/modules/chat";
import { apiSuccess, createHandler } from "@/lib/api";

/** Ambil (atau buat) chat global tenant dan jadikan admin anggotanya. */
export const GET = createHandler(
  { auth: true, permissions: ["chat:read"], feature: "chat" },
  async (_req, ctx) => {
    const globalChat = await new ChatService().getGlobalChat(
      resolveChatActor(ctx.session!.user),
      ctx.session!.user.tenantId as string,
    );
    return apiSuccess(globalChat);
  },
);
