import { apiSuccess, createHandler } from "@/lib/api";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/admin/vpn-servers/[id]/upgrade-command - perintah upgrade hub (superadmin). */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  try {
    const command = await createVpnServerService().upgradeCommand(
      ctx.params.id,
    );
    return apiSuccess({ command });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
