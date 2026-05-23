import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { requireFullRadiusMode } from "@/lib/security/requireFullRadiusMode";
import {
  AccelPppServerService,
  accelPppKickParamSchema,
} from "@/modules/network";
import { mapAccelPppErrorToResponse } from "../../../../_helpers";

/** POST /api/admin/accel-ppp-servers/[id]/sessions/[username]/kick */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  try {
    await requireFullRadiusMode();
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!(await hasPermission("accel_ppp:session:kick"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const parsed = accelPppKickParamSchema.safeParse(ctx.params);
  if (!parsed.success) {
    return ApiErrors.badRequest("Parameter tidak valid");
  }

  const user = ctx.session!.user;
  const service = new AccelPppServerService();
  try {
    const result = await service.kickSession(
      parsed.data.id,
      parsed.data.username,
      user.tenantId ?? null,
      user.id,
    );
    return apiSuccess(result);
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
