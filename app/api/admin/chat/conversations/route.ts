import { hasPermission } from "@/lib/rbac";
import { ChatService, resolveChatActor } from "@/modules/chat";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import * as z from "zod";

const createConversationSchema = z.object({
  participantIds: z.array(z.uuid()).min(1, "Minimal 1 peserta"),
  name: z.string().max(100).optional(),
});

// GET - Get all conversations for current admin user
export const GET = createHandler(
  { auth: true, feature: "chat" },
  async (_req, ctx) => {
    const chatService = new ChatService();
    const conversations = await chatService.getConversations(
      resolveChatActor(ctx.session!.user),
      ctx.session!.user.tenantId as string,
    );

    return apiSuccess(conversations);
  },
);

// POST - Create a new conversation
export const POST = createHandler(
  {
    auth: true,
    schema: createConversationSchema,
    feature: "chat",
  },
  async (_req, ctx) => {
    // Check permission
    if (!(await hasPermission("chat:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat percakapan",
      );
    }

    const { participantIds, name } = ctx.validated;
    const creator = resolveChatActor(ctx.session!.user);

    const chatService = new ChatService();
    const result = await chatService.createConversation({
      creator,
      participants: participantIds.map((id) => ({ type: "user", id })),
      tenantId: ctx.session!.user.tenantId as string,
      ...(name ? { name } : {}),
    });

    return apiSuccess(result, {
      status: 201,
      message: "Percakapan berhasil dibuat",
    });
  },
);
