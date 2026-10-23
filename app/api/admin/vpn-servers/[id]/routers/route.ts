import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { vpnIdSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** DELETE /api/admin/vpn-servers/[id]/routers - mengeluarkan server dari semua router (superadmin). */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user, false);
  if (denied) return denied;
  const id = vpnIdSchema.safeParse(ctx.params.id);
  if (!id.success) return ApiErrors.badRequest("Server VPN tidak valid");
  try {
    return apiSuccess(await createVpnServerService().detachServer(id.data));
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
