import * as z from "zod";

import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  RabRevisionRouteService,
  isRouteServiceError,
} from "@/modules/finance";

export const dynamic = "force-dynamic";

const RAB_EXPENSE_TYPES = ["CAPEX", "OPEX"] as const;
const RAB_ITEM_CATEGORIES = [
  "HARDWARE",
  "LICENSE",
  "INSTALLATION",
  "OTHER",
  "DEVICE",
  "CABLE",
  "ACCESSORIES",
  "SERVICE",
  "OPERATIONAL",
] as const;

const revisionItemSchema = z.object({
  rabItemId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().min(1),
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((value) => BigInt(Math.round(Number(value)))),
  category: z.enum(RAB_ITEM_CATEGORIES).default("HARDWARE"),
  expenseType: z.enum(RAB_EXPENSE_TYPES).default("CAPEX"),
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

export const GET = createHandler(
  { auth: true, permissions: ["expense:read", "mixradius_expenses:read"] },
  async (_req, ctx) => {
    const user = ctx.session!.user;

    try {
      await rabRevisionRouteService.assertRevisionAccess(user);

      const revision = await rabRevisionRouteService.getRevision(
        ctx.params.id,
        ctx.params.revisionId,
      );

      return apiSuccess(revision);
    } catch (error) {
      if (isRouteServiceError(error) && error.status === 403) {
        return ApiErrors.forbidden(error.message);
      }

      if (isRouteServiceError(error) && error.status === 404) {
        return ApiErrors.notFound(error.message);
      }

      throw error;
    }
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["expense:update", "mixradius_expenses:update"],
  },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const payload = updateRevisionSchema.parse(await req.json());

    try {
      await rabRevisionRouteService.assertRevisionAccess(user);
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
      if (isRouteServiceError(error) && error.status === 403) {
        return ApiErrors.forbidden(error.message);
      }

      if (isRouteServiceError(error) && error.status === 404) {
        return ApiErrors.notFound(error.message);
      }

      if (isRouteServiceError(error) && error.status === 400) {
        return ApiErrors.badRequest(error.message);
      }

      throw error;
    }
  },
);
