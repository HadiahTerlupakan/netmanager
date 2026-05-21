import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { getMobileDashboardService } from "@/modules/mitra";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!user.id || !user.role || !user.tenantId) {
    return apiError("Token mobile tidak valid", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  const result = await getMobileDashboardService().getDashboardStats({
    id: user.id,
    role: user.role as string,
    tenantId: user.tenantId,
  });

  return apiSuccess(result);
});
