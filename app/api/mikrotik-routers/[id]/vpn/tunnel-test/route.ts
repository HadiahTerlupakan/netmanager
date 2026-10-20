import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { routerVpnTunnelTestSchema } from "@/lib/validations/vpn";
import {
  createVpnRouterMigrationService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/tunnel-test - test login API router lewat tunnel draft. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  const parsed = routerVpnTunnelTestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const result = await createVpnRouterMigrationService().testTunnel(
      ctx.params.id,
      user.tenantId,
      parsed.data.draftId,
    );
    return apiSuccess(result);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
