import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";
import { vpnIdSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  VPN_SECRET_HEADERS,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/admin/vpn-admin-peers/[id]/config - berkas wg-quick perangkat admin (superadmin). */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  const id = vpnIdSchema.safeParse(ctx.params.id);
  if (!id.success) return ApiErrors.badRequest("Id perangkat tidak valid");
  try {
    const config = await createVpnServerService().adminPeerConfig(id.data);
    return new NextResponse(config, {
      headers: {
        ...VPN_SECRET_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="netmanager-admin-${id.data}.conf"`,
      },
    });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
