import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { routerVpnMigrateSchema } from "@/lib/validations/vpn";
import {
  createVpnRouterMigrationService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/[id]/vpn/migrate - pindahkan router publik ke VPN lewat draft yang tunnelnya hidup. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  const parsed = routerVpnMigrateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const result = await createVpnRouterMigrationService().migrate(
      ctx.params.id,
      user.tenantId,
      parsed.data,
    );
    return apiSuccess({ success: true, ...result });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
