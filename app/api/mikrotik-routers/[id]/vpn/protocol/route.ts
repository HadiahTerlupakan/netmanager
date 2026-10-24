import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { routerVpnProtocolSchema } from "@/lib/validations/vpn";
import {
  createVpnRouterProtocolService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/protocol - pindahkan router ke protokol baru setelah script ditempel. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  const parsed = routerVpnProtocolSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    await createVpnRouterProtocolService().apply(
      ctx.params.id,
      user.tenantId,
      parsed.data.protocol,
    );
    return apiSuccess({ success: true });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
