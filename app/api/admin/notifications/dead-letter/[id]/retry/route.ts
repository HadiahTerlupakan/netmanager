import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";
import { NotificationDispatcher } from "@/modules/notification";
import type { NotificationChannel } from "@/modules/notification";

/**
 * POST /api/admin/notifications/dead-letter/[id]/retry
 * Resend notifikasi yang gagal via channel yang sama, lalu mark resolved.
 */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;

  const entry = await prisma.notificationDeadLetter.findUnique({
    where: { id },
  });

  if (!entry) {
    return ApiErrors.notFound("Entry dead letter");
  }

  if (entry.resolvedAt) {
    return ApiErrors.badRequest("Entry ini sudah resolved");
  }

  const dispatcher = new NotificationDispatcher();
  await dispatcher.dispatch({
    pelangganId: entry.pelangganId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    templateKey: entry.templateKey as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: entry.params as any,
    sourceType: "RETRY_DLQ",
    sourceId: entry.id,
    channels: [entry.channel as NotificationChannel],
  });

  await prisma.notificationDeadLetter.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });

  return apiSuccess({ retried: true });
});
