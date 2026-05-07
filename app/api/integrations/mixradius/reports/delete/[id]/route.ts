import {
  getMixRadiusAccessService,
  getMixRadiusService,
} from "@/modules/integrations";
import { isSuperAdmin } from "@/lib/auth";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:delete"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus data MixRadius",
    );
  }

  const service = getMixRadiusService();
  const success = await service.deleteIncomeRecord(id);

  if (success) {
    return apiSuccess({ success: true });
  } else {
    return ApiErrors.internalError("Gagal menghapus data di server MixRadius");
  }
});
