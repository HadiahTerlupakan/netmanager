import * as z from "zod";

import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  RabRevisionRouteService,
  isRouteServiceError,
} from "@/modules/finance";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const rabRevisionRouteService = new RabRevisionRouteService();

const createRevisionSchema = z.object({
  notes: z.string().optional(),
});

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess = isSuperAdmin(user) || (await hasPermission("expense:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read",
    );
  }

  const revisions = await rabRevisionRouteService.getRevisions(ctx.params.id);
  return apiSuccess(revisions);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess =
    isSuperAdmin(user) || (await hasPermission("expense:update"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:update",
    );
  }

  const payload = createRevisionSchema.parse(
    await req.json().catch(() => ({})),
  );

  try {
    const revision = await rabRevisionRouteService.createRevision(
      ctx.params.id,
      user.id,
      payload.notes,
    );

    return apiSuccess(revision);
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
