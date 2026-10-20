import { apiSuccess, createHandler } from "@/lib/api";
import {
  createVpnRouterService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/first-server - arahkan tunnel router kembali ke server pertama. */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  try {
    await createVpnRouterService().returnToFirstServer(
      ctx.params.id,
      user.tenantId,
    );
    return apiSuccess({ success: true });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
