import { RabRevisionStatus } from "@prisma/client";
import { z } from "zod";

import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { serializeRabRevision } from "@/lib/finance/rab-revisions";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const submitSchema = z.object({
  reason: z.string().trim().min(1),
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess =
    isSuperAdmin(user) ||
    (await hasPermission("expense:update")) ||
    (await hasPermission("mixradius_expenses:update"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update",
    );
  }

  const payload = submitSchema.safeParse(await req.json());

  if (!payload.success) {
    return ApiErrors.badRequest("Alasan revisi wajib diisi");
  }

  const revision = await prisma.rabRevision.findUnique({
    where: { id: ctx.params.revisionId },
    include: { items: true, approvals: true },
  });

  if (!revision || revision.rabProjectId !== ctx.params.id) {
    return ApiErrors.notFound("Revisi RAB");
  }

  if (revision.status !== RabRevisionStatus.DRAFT) {
    return ApiErrors.badRequest("Hanya revisi dengan status DRAFT yang dapat diajukan");
  }

  if (revision.items.length === 0) {
    return ApiErrors.badRequest("Revisi harus memiliki minimal satu item");
  }

  const submittedRevision = await prisma.rabRevision.update({
    where: { id: revision.id },
    data: {
      status: RabRevisionStatus.PENDING_APPROVAL,
      reason: payload.data.reason,
      submittedById: user.id,
      submittedAt: new Date(),
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      approvals: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return apiSuccess(serializeRabRevision(submittedRevision));
});
