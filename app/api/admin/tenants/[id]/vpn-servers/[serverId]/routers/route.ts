import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { vpnIdSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/admin/tenants/[id]/vpn-servers/[serverId]/routers - menambahkan server ke semua router VPN tenant (superadmin). */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user, false);
  if (denied) return denied;
  const serverId = vpnIdSchema.safeParse(ctx.params.serverId);
  if (!serverId.success) return ApiErrors.badRequest("Server VPN tidak valid");
  try {
    return apiSuccess(
      await createVpnServerService().appendServerToTenantRouters(
        ctx.params.id,
        serverId.data,
      ),
    );
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
