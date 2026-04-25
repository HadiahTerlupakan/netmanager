import { prisma } from "@/modules/database";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

type ActualAchievementPayload = {
  actualSubscribers: number;
  actualRevenue: bigint;
  actualOpex: bigint;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
  manualInvestorProfitSharePercent: number | null;
  notes?: string;
};

type RabActualAchievementUpsertResult = ActualAchievementPayload & {
  id: string;
  rabProjectId: string;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
};

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

    // Verify RAB exists
    const project = await prisma.rabProject.findUnique({
      where: { id: rabProjectId },
    });

    if (!project) {
      return ApiErrors.notFound("RAB Project");
    }

    const {
      month,
      year,
      actualSubscribers,
      actualRevenue,
      actualOpex,
      manualRecoveryInstallment,
      manualInvestorShare,
      manualCompanyShare,
      manualInvestorProfitSharePercent,
      notes,
    } = data;

    const achievement: RabActualAchievementUpsertResult =
      await prisma.rabActualAchievement.upsert({
        where: {
          rabProjectId_month_year: {
            rabProjectId,
            month,
            year,
          },
        },
        create: {
          rabProjectId,
          month,
          year,
          actualSubscribers,
          actualRevenue,
          actualOpex,
          manualRecoveryInstallment,
          manualInvestorShare,
          manualCompanyShare,
          manualInvestorProfitSharePercent,
          notes,
        },
        update: {
          actualSubscribers,
          actualRevenue,
          actualOpex,
          manualRecoveryInstallment,
          manualInvestorShare,
          manualCompanyShare,
          manualInvestorProfitSharePercent,
          notes,
        },
      });

    return apiSuccess({
      ...achievement,
      actualRevenue: achievement.actualRevenue.toString(),
      actualOpex: achievement.actualOpex.toString(),
      manualRecoveryInstallment:
        achievement.manualRecoveryInstallment?.toString() || null,
      manualInvestorShare: achievement.manualInvestorShare?.toString() || null,
      manualCompanyShare: achievement.manualCompanyShare?.toString() || null,
      manualInvestorProfitSharePercent:
        achievement.manualInvestorProfitSharePercent,
    });
  },
);
