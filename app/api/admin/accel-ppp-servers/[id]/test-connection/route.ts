import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { requireFullRadiusMode } from "@/lib/security/requireFullRadiusMode";
import { AccelPppServerService } from "@/modules/network";
import { mapAccelPppErrorToResponse } from "../../_helpers";

/** POST /api/admin/accel-ppp-servers/[id]/test-connection */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  try {
    await requireFullRadiusMode();
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!(await hasPermission("accel_ppp:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const id = ctx.params.id;
  const tenantId = ctx.session!.user.tenantId ?? null;
  const service = new AccelPppServerService();
  try {
    const result = await service.testConnection(id, tenantId);
    return apiSuccess(result);
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
