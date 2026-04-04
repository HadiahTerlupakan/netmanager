import { RabRevisionStatus } from "@prisma/client";
import * as z from "zod";

import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  calculateRevisionTotals,
  normalizeRevisionSnapshotItems,
  serializeRabRevision,
} from "@/modules/finance/utils/rab-revisions";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const createRevisionSchema = z.object({
  notes: z.string().optional(),
});

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess =
    isSuperAdmin(user) ||
    (await hasPermission("expense:read")) ||
    (await hasPermission("mixradius_expenses:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read",
    );
  }

  const revisions = await prisma.rabRevision.findMany({
    where: { rabProjectId: ctx.params.id },
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
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { revisionNumber: "desc" },
  });

  return apiSuccess(revisions.map(serializeRabRevision));
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

  const payload = createRevisionSchema.parse(await req.json().catch(() => ({})));

  const project = await prisma.rabProject.findUnique({
    where: { id: ctx.params.id },
    include: {
      items: true,
      revisions: {
        select: { revisionNumber: true },
        orderBy: { revisionNumber: "desc" },
        take: 1,
      },
      finalApprovedRevision: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!project) {
    return ApiErrors.notFound("Proyek RAB");
  }

  // Check if a DRAFT revision already exists to prevent duplicate creation on double-click
  const existingDraft = await prisma.rabRevision.findFirst({
    where: {
      rabProjectId: project.id,
      status: "DRAFT", // Hardcoded string if RabRevisionStatus is not easily accessible here, but the model has it.
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

  if (existingDraft) {
    return apiSuccess(serializeRabRevision(existingDraft));
  }

  const baseItems = project.finalApprovedRevision
    ? normalizeRevisionSnapshotItems(project.finalApprovedRevision.items)
    : normalizeRevisionSnapshotItems(project.items);
  const totals = calculateRevisionTotals(
    baseItems,
    project.finalApprovedRevision?.totalOpex ?? project.projectedOpex,
  );

  const revision = await prisma.rabRevision.create({
    data: {
      rabProjectId: project.id,
      revisionNumber: (project.revisions[0]?.revisionNumber ?? 0) + 1,
      status: RabRevisionStatus.DRAFT,
      notes: payload.notes,
      createdById: user.id,
      totalCapex: totals.totalCapex,
      totalOpex: totals.totalOpex,
      items: {
        create: baseItems,
      },
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

  return apiSuccess(serializeRabRevision(revision));
});
