import { ChatService, resolveChatActor } from "@/modules/chat";
import { apiSuccess, createHandler } from "@/lib/api";

// GET - Get or create global chat and add user as participant
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const chatService = new ChatService();
  const globalChat = await chatService.getGlobalChat(
    resolveChatActor(ctx.session!.user),
    ctx.session!.user.tenantId as string,
  );

  return apiSuccess(globalChat);
});
