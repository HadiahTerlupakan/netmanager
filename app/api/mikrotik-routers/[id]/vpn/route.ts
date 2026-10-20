import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { routerVpnServersSchema } from "@/lib/validations/vpn";
import {
  createVpnRouterService,
  routerVpnAccessGuard,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

// Daftar tersimpan, tetapi skrip switch belum sampai ke router.
const HTTP_ACCEPTED = 202;

/** GET /api/mikrotik-routers/[id]/vpn - daftar server, server aktif, dan riwayat perpindahan router VPN. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:read"));
  if (denied) return denied;
  try {
    const detail = await createVpnRouterService().getRouterVpn(
      ctx.params.id,
      user.tenantId,
    );
    return apiSuccess(detail);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});

/** PUT /api/mikrotik-routers/[id]/vpn - mengganti daftar urut server VPN router tanpa tempel ulang. */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const denied =
    vpnConfiguredGuard() ??
    (await routerVpnAccessGuard(ctx.params.id, user, "mikrotik:update"));
  if (denied) return denied;
  const parsed = routerVpnServersSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const result = await createVpnRouterService().updateServers(
      ctx.params.id,
      user.tenantId,
      parsed.data.serverIds,
    );
    return result.scriptStale
      ? apiSuccess(result, { status: HTTP_ACCEPTED })
      : apiSuccess(result);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
