import { RabExpenseType, RabItemCategory } from "@prisma/client";
import * as z from "zod";

import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  RabRevisionRouteService,
  isRouteServiceError,
} from "@/modules/finance";
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

const rabRevisionRouteService = new RabRevisionRouteService();

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

  try {
    const revision = await rabRevisionRouteService.getRevision(
      ctx.params.id,
      ctx.params.revisionId,
    );

    return apiSuccess(revision);
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});

export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const accessError = await assertRevisionAccess(user);

  if (accessError) {
    return accessError;
  }

  const payload = updateRevisionSchema.parse(await req.json());

  try {
    const revision = await rabRevisionRouteService.updateRevision({
      projectId: ctx.params.id,
      revisionId: ctx.params.revisionId,
      notes: payload.notes,
      projectedOpex: payload.projectedOpex,
      items: payload.items?.map((item) => ({
        ...item,
        unitPrice: item.unitPrice,
      })),
    });

    return apiSuccess(revision);
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }

    if (isRouteServiceError(error) && error.status === 400) {
      return ApiErrors.badRequest(error.message);
    }

    throw error;
  }
});
