import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import {
  rabActualAchievementSchema,
  RabProjectRouteService,
} from "@/modules/finance";

const rabProjectRouteService = new RabProjectRouteService();

/** POST: simpan capaian bulan ke-n proyek RAB (bulan yang sudah dibagikan → 409). */
export const POST = createHandler(
  {
    auth: true,
    schema: rabActualAchievementSchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;
    const { id: rabProjectId } = ctx.params;
    const data = ctx.validated!;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper || (await hasPermission("expense:update"));

    if (!hasAccess) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    try {
      const achievement = await rabProjectRouteService.upsertActualAchievement({
        rabProjectId,
        month: data.month,
        year: data.year,
        actualSubscribers: data.actualSubscribers,
        actualRevenue: data.actualRevenue,
        actualOpex: data.actualOpex,
        manualRecoveryInstallment: data.manualRecoveryInstallment,
        manualInvestorShare: data.manualInvestorShare,
        manualCompanyShare: data.manualCompanyShare,
        manualInvestorProfitSharePercent: data.manualInvestorProfitSharePercent ?? null,
        notes: data.notes,
      });

      return apiSuccess(achievement);
    } catch (error) {
      if (isRouteServiceError(error)) {
        return ApiErrors.conflict(error.message);
      }
      if (error instanceof Error && error.message === "RAB Project") {
        return ApiErrors.notFound("RAB Project");
      }
      throw error;
    }
  },
);
