import * as z from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { vpnDraftCreateSchema } from "@/lib/validations/vpn";
import {
  createVpnDraftService,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** POST /api/mikrotik-routers/vpn-draft - membuat/memakai ulang draft VPN dan script tempel. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  const denied = vpnConfiguredGuard();
  if (denied) return denied;
  const parsed = vpnDraftCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return ApiErrors.badRequest(
      "Data tidak valid",
      z.flattenError(parsed.error),
    );
  }
  try {
    const draft = await createVpnDraftService().createDraft(
      ctx.session!.user.tenantId,
      parsed.data,
    );
    return apiSuccess(draft);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
