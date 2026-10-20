import { apiSuccess, createHandler } from "@/lib/api";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** DELETE /api/admin/vpn-servers/[id] - menghapus server VPN (superadmin). */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  try {
    await createVpnServerService().deleteServer(ctx.params.id);
    return apiSuccess({ id: ctx.params.id });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
