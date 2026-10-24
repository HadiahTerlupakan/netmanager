import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { routerVpnProtocolSchema } from "@/lib/validations/vpn";
import {
  createVpnRouterProtocolService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/protocol-script - script tempel protokol baru, tanpa mengganti protokol. */
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
    const script = await createVpnRouterProtocolService().previewScript(
      ctx.params.id,
      user.tenantId,
      parsed.data.protocol,
    );
    return apiSuccess({ script });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
