import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { vpnIdSchema } from "@/lib/validations/vpn";
import {
  createVpnDraftService,
  vpnConfiguredGuard,
  vpnErrorResponse,
} from "@/modules/network";

/** GET /api/mikrotik-routers/vpn-draft/[draftId]/status - apakah tunnel draft sudah hidup. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("mikrotik:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  const denied = vpnConfiguredGuard();
  if (denied) return denied;
  const draftId = vpnIdSchema.safeParse(ctx.params.draftId);
  if (!draftId.success) return ApiErrors.badRequest("Id draft tidak valid");
  try {
    const status = await createVpnDraftService().getStatus(
      ctx.session!.user.tenantId,
      draftId.data,
    );
    return apiSuccess(status);
  } catch (error) {
    return vpnErrorResponse(error);
  }
});
