import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { vpnAdminPeerCreateSchema } from "@/lib/validations/vpn";
import {
  createVpnServerService,
  vpnAdminGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/admin/vpn-admin-peers - daftar perangkat admin (superadmin). */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  try {
    return apiSuccess(await createVpnServerService().listAdminPeers());
  } catch (error) {
    return vpnErrorResponse(error);
  }
});

/** POST /api/admin/vpn-admin-peers - menambah perangkat admin (superadmin). */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const denied = vpnAdminGuard(ctx.session?.user);
  if (denied) return denied;
  const parsed = vpnAdminPeerCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const peer = await createVpnServerService().createAdminPeer(
      parsed.data.label,
    );
    return apiSuccess(peer, { status: 201 });
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
