import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/admin/vpn-admin-peers/[id]/config - berkas wg-quick perangkat admin (superadmin). */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  try {
    const config = await createVpnServerService().adminPeerConfig(
      ctx.params.id,
    );
    return new NextResponse(config, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="netmanager-admin-${ctx.params.id}.conf"`,
      },
    });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
