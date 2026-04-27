import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { RabProjectRouteService } from "@/modules/finance";

const rabProjectRouteService = new RabProjectRouteService();

const actualSchema = z.object({
  month: z.number().min(1).max(120),
  year: z.number().min(2000),
  actualSubscribers: z.number().min(0),
  actualRevenue: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(Math.round(Number(v)))),
  actualOpex: z
    .union([z.string(), z.number()])
    .optional()
    .default(0)
    .transform((v) => BigInt(Math.round(Number(v)))),
  manualRecoveryInstallment: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v ? BigInt(Math.round(Number(v))) : null)),
  manualInvestorShare: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v ? BigInt(Math.round(Number(v))) : null)),
  manualCompanyShare: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v ? BigInt(Math.round(Number(v))) : null)),
  manualInvestorProfitSharePercent: z.number().optional().nullable(),
  notes: z.string().optional(),
});

export const POST = createHandler(
  {
    auth: true,
    schema: actualSchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;
    const { id: rabProjectId } = ctx.params;
    const data = ctx.validated!;

    const isSuper = isSuperAdmin(user);
    const hasAccess =
      isSuper ||
      (await hasPermission("expense:update")) ||
      (await hasPermission("mixradius_expenses:update"));

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
        manualInvestorProfitSharePercent: data.manualInvestorProfitSharePercent,
        notes: data.notes,
      });

      return apiSuccess(achievement);
    } catch (error) {
      if (error instanceof Error && error.message === "RAB Project") {
        return ApiErrors.notFound("RAB Project");
      }
      throw error;
    }
  },
);
