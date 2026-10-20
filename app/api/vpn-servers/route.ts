import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  createVpnDraftService,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/vpn-servers - server VPN yang di-assign ke tenant pemanggil. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("mikrotik:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  const denied = vpnConfiguredGuard();
  if (denied) return denied;
  try {
    const servers = await createVpnDraftService().listTenantServers(
      ctx.session!.user.tenantId,
    );
    return apiSuccess({ servers });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
