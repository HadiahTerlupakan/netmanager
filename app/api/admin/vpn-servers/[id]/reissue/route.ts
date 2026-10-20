import { apiSuccess, createHandler } from "@/lib/api";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/admin/vpn-servers/[id]/reissue - perintah instalasi baru (superadmin). */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  try {
    return apiSuccess(await createVpnServerService().reissue(ctx.params.id));
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
