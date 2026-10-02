import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import { RabProjectRouteService } from "@/modules/finance";

const rabProjectRouteService = new RabProjectRouteService();

/** Rupiah ≥ 0, desimal dibulatkan. */
const rupiah = z.coerce
  .number()
  .min(0, "Nilai rupiah tidak boleh negatif")
  .transform((v) => BigInt(Math.round(v)));
/** Rupiah opsional; kosong/null = tidak diisi. */
const rupiahOpsional = z
  .union([rupiah, z.null(), z.literal("")])
  .optional()
  .transform((v) => (typeof v === "bigint" ? v : null));

const actualSchema = z.object({
  month: z.number().int().min(1).max(120),
  /** Diabaikan bila proyek punya tanggal mulai (tahun dihitung server). */
  year: z.number().int().min(2000).optional(),
  actualSubscribers: z.number().int().min(0),
  actualRevenue: rupiah,
  actualOpex: rupiahOpsional,
  manualRecoveryInstallment: rupiahOpsional,
  manualInvestorShare: rupiahOpsional,
  manualCompanyShare: rupiahOpsional,
  manualInvestorProfitSharePercent: z.number().min(0).max(100).nullable().optional(),
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
