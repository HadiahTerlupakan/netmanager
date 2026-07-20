import { hasPermission } from "@/lib/rbac";
import { ChatService, resolveChatActor } from "@/modules/chat";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import * as z from "zod";

const imageUrlSchema = z.string().refine((value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, "URL gambar tidak valid");

const sendMessageSchema = z
  .object({
    content: z.string().max(5000).optional(),
    imageUrl: imageUrlSchema.optional(),
  })
  .refine((data) => data.content?.trim() || data.imageUrl, {
    message: "Pesan atau gambar wajib diisi",
  });

// GET - Get messages for a conversation
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("chat:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat chat");
  }

  const { id: conversationId } = ctx.params;
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get("cursor") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50");

  const chatService = new ChatService();
  try {
    const result = await chatService.getMessages({
      conversationId,
      actor: resolveChatActor(ctx.session!.user),
      tenantId: ctx.session!.user.tenantId as string,
      cursor,
      limit,
    });
    return apiSuccess(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (message === "Not a participant") {
      return ApiErrors.forbidden("Anda bukan peserta percakapan ini");
    }
    throw error;
  }
});

// POST - Send a message
export const POST = createHandler(
  {
    auth: true,
    schema: sendMessageSchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;

    if (!(await hasPermission("chat:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengirim pesan",
      );
    }

    const { id: conversationId } = ctx.params;
    const { content, imageUrl } = ctx.validated;

    const chatService = new ChatService();
    try {
      const result = await chatService.sendMessage({
        conversationId,
        sender: resolveChatActor(user),
        senderName: user.name || "Admin",
        tenantId: user.tenantId as string,
        ...(content !== undefined ? { content } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      });

      return apiSuccess(result, {
        status: 201,
        message: "Pesan berhasil dikirim",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      if (message === "Not a participant") {
        return ApiErrors.forbidden("Anda bukan peserta percakapan ini");
      }
      throw error;
    }
  },
);
