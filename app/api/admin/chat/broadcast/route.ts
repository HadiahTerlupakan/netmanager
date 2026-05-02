import { hasPermission } from "@/lib/rbac";
import { ChatService } from "@/modules/chat";
import {
  apiSuccess,
  ApiErrors,
  createHandler,
  apiError,
  ErrorCodes,
} from "@/lib/api";

function parseBroadcastPayload(
  payload: unknown,
): { content: string; title?: string } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as { content?: unknown; title?: unknown };
  if (typeof raw.content !== "string") {
    return null;
  }

  const content = raw.content.trim();
  if (content.length === 0 || content.length > 5000) {
    return null;
  }

  if (raw.title !== undefined && typeof raw.title !== "string") {
    return null;
  }

  if (typeof raw.title === "string" && raw.title.length > 200) {
    return null;
  }

  return {
    content,
    ...(typeof raw.title === "string" && raw.title.trim().length > 0
      ? { title: raw.title.trim() }
      : {}),
  };
}

// POST - Send broadcast message to all users
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("broadcast:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk broadcast");
  }

  const payload = parseBroadcastPayload(await req.json());
  if (!payload) {
    return apiError(
      "Payload broadcast tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      {
        status: 400,
      },
    );
  }

  const chatService = new ChatService();
  const result = await chatService.broadcastMessage({
    senderId: user.id,
    senderName: user.name || "Admin",
    tenantId: user.tenantId as string,
    content: payload.content,
    ...(payload.title ? { title: payload.title } : {}),
  });

  return apiSuccess(result, {
    status: 201,
    message: "Broadcast berhasil dikirim",
  });
});
