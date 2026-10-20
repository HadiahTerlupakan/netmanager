import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  createVpnDraftService,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/mikrotik-routers/vpn-draft/[draftId]/status - apakah tunnel draft sudah hidup. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("mikrotik:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  const denied = vpnConfiguredGuard();
  if (denied) return denied;
  try {
    const status = await createVpnDraftService().getStatus(
      ctx.session!.user.tenantId,
      ctx.params.draftId,
    );
    return apiSuccess(status);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
