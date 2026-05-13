import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";

/**
 * POST /api/admin/notifications/dead-letter/[id]/resolve
 * Tandai DLQ entry sebagai resolved tanpa melakukan retry.
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

  await prisma.notificationDeadLetter.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });

  return apiSuccess({ resolved: true });
});
