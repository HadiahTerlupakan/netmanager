import {
  RabExpenseType,
  RabItemCategory,
  RabRevisionStatus,
} from "@prisma/client";
import * as z from "zod";

import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  calculateRevisionTotals,
  normalizeRevisionSnapshotItems,
  serializeRabRevision,
  type RevisionSnapshotSourceItem,
} from "@/modules/finance";
import { prisma } from "@/modules/database";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const revisionItemSchema = z.object({
  rabItemId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().min(1),
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((value) => BigInt(Math.round(Number(value)))),
  category: z.enum(RabItemCategory).default(RabItemCategory.HARDWARE),
  expenseType: z.enum(RabExpenseType).default(RabExpenseType.CAPEX),
  expenseCategoryId: z.string().nullable().optional(),
  wbsId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

const updateRevisionSchema = z.object({
  notes: z.string().optional(),
  projectedOpex: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) =>
      value === undefined || value === null || value === ""
        ? undefined
        : BigInt(Math.round(Number(value))),
    ),
  items: z.array(revisionItemSchema).optional(),
});

async function assertRevisionAccess(user: {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}) {
  const hasAccess =
    isSuperAdmin(user) ||
    (await hasPermission("expense:update")) ||
    (await hasPermission("mixradius_expenses:update"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update",
    );
  }

  return null;
}

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const accessError = await assertRevisionAccess(user);

  if (accessError) {
    return accessError;
  }

  const revision = await prisma.rabRevision.findUnique({
    where: { id: ctx.params.revisionId },
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

  if (!revision || revision.rabProjectId !== ctx.params.id) {
    return ApiErrors.notFound("Revisi RAB");
  }

  return apiSuccess(serializeRabRevision(revision));
});

export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const accessError = await assertRevisionAccess(user);

  if (accessError) {
    return accessError;
  }

  const payload = updateRevisionSchema.parse(await req.json());
  const existingRevision = await prisma.rabRevision.findUnique({
    where: { id: ctx.params.revisionId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!existingRevision || existingRevision.rabProjectId !== ctx.params.id) {
    return ApiErrors.notFound("Revisi RAB");
  }

  if (existingRevision.status !== RabRevisionStatus.DRAFT) {
    return ApiErrors.badRequest(
      "Hanya revisi dengan status DRAFT yang dapat diubah",
    );
  }

  const snapshotItems = payload.items
    ? normalizeRevisionSnapshotItems(
        payload.items.map<RevisionSnapshotSourceItem>((item) => ({
          rabItemId: item.rabItemId,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
          expenseType: item.expenseType,
          expenseCategoryId: item.expenseCategoryId,
          wbsId: item.wbsId,
          sortOrder: item.sortOrder,
          totalPrice: BigInt(item.quantity) * item.unitPrice,
        })),
      )
    : normalizeRevisionSnapshotItems(existingRevision.items);
  const totals = calculateRevisionTotals(
    snapshotItems,
    payload.projectedOpex ?? existingRevision.totalOpex,
  );

  const revision = await prisma.rabRevision.update({
    where: { id: existingRevision.id },
    data: {
      notes: payload.notes,
      totalCapex: totals.totalCapex,
      totalOpex: totals.totalOpex,
      items: payload.items
        ? {
            deleteMany: {},
            create: snapshotItems,
          }
        : undefined,
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
