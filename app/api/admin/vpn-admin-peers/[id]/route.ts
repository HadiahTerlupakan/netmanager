import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { vpnIdSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** DELETE /api/admin/vpn-admin-peers/[id] - menghapus perangkat admin (superadmin). */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  const id = vpnIdSchema.safeParse(ctx.params.id);
  if (!id.success) return ApiErrors.badRequest("Id perangkat tidak valid");
  try {
    await createVpnServerService().deleteAdminPeer(id.data);
    return apiSuccess({ id: id.data });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
