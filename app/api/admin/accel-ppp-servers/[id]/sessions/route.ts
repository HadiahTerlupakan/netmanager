import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { requireFullRadiusMode } from "@/lib/security/requireFullRadiusMode";
import { AccelPppServerService } from "@/modules/network";
import { mapAccelPppErrorToResponse } from "../../_helpers";

/** GET /api/admin/accel-ppp-servers/[id]/sessions — daftar sesi live. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
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
    const sessions = await service.getLiveSessions(id, tenantId);
    return apiSuccess({ items: sessions });
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
