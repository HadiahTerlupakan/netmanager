import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";

/**
 * POST /api/admin/notifications/dead-letter/[id]/resolve
 * Tandai DLQ entry sebagai resolved tanpa melakukan retry.
 */
export const POST = createHandler(
  { auth: true, permissions: ["notifications:manage"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;

    const entry = await prisma.notificationDeadLetter.findUnique({
      where: { id },
    });

    if (!entry) {
      return ApiErrors.notFound("Entry dead letter");
    }

    // Tenant ownership check — cegah IDOR
    if (!isSuperAdmin && entry.tenantId !== ctx.session!.user.tenantId) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    if (entry.resolvedAt) {
      return ApiErrors.badRequest("Entry ini sudah resolved");
    }

    await prisma.notificationDeadLetter.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });

    return apiSuccess({ resolved: true });
  },
);
