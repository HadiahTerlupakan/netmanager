import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { vpnServerCreateSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/admin/vpn-servers - daftar server VPN (superadmin). */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  try {
    return apiSuccess(await createVpnServerService().listServers());
  } catch (error) {
    return vpnErrorResponse(error);
  }
});

/** POST /api/admin/vpn-servers - membuat server VPN (superadmin). */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  const parsed = vpnServerCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const result = await createVpnServerService().createServer(parsed.data);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
