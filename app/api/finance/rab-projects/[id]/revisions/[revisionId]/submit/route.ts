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

const submitSchema = z.object({
  reason: z.string().trim().min(1),
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

  const payload = submitSchema.safeParse(await req.json());

  if (!payload.success) {
    return ApiErrors.badRequest("Alasan revisi wajib diisi");
  }

  try {
    const submittedRevision = await rabRevisionRouteService.submitRevision({
      projectId: ctx.params.id,
      revisionId: ctx.params.revisionId,
      reason: payload.data.reason,
      userId: user.id,
    });

    return apiSuccess(submittedRevision);
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
