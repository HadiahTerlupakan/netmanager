import { apiSuccess, createHandler } from "@/lib/api";
import {
  createVpnRouterMigrationService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/revert - kembalikan router VPN ke IP publiknya. */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  try {
    const result = await createVpnRouterMigrationService().revert(
      ctx.params.id,
      user.tenantId,
    );
    return apiSuccess({ success: true, ...result });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
