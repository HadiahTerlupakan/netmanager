import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { tenantVpnServersSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/admin/tenants/[id]/vpn-servers - id server VPN tenant (superadmin). */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user, false);
  if (denied) return denied;
  try {
    const serverIds = await createVpnServerService().getTenantServerIds(
      ctx.params.id,
    );
    return apiSuccess({ serverIds });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});

/** PUT /api/admin/tenants/[id]/vpn-servers - mengganti server VPN tenant (superadmin). */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user, false);
  if (denied) return denied;
  const parsed = tenantVpnServersSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    await createVpnServerService().setTenantServers(
      ctx.params.id,
      parsed.data.serverIds,
    );
    return apiSuccess({ serverIds: parsed.data.serverIds });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
