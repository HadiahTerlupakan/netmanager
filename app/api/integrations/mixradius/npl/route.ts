import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { syncService } from "@/modules/integrations/services/MixRadiusSyncService";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user
  const isSuper = isSuperAdmin(user)

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id);
    const hasAccess = permissions.includes('*') || permissions.includes("mixradius:read");
    if (!hasAccess) {
      return ApiErrors.forbidden("Anda tidak memiliki izin untuk mengakses statistik MixRadius");
    }
  }

  const { searchParams } = req.nextUrl;
  const groupId = searchParams.get('groupId') || undefined;
  
  const stats = await syncService.getNPLStatistics(groupId);
  return apiSuccess(stats);
})
