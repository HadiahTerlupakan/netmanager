import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { routerVpnEnableSchema } from "@/lib/validations/vpn";
import {
  createVpnRouterMigrationService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/enable - draft VPN dan script tempel untuk router publik v7. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  const parsed = routerVpnEnableSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const draft = await createVpnRouterMigrationService().enable(
      ctx.params.id,
      user.tenantId,
      parsed.data,
    );
    return apiSuccess(draft);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
