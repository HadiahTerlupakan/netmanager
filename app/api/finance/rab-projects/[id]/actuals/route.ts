import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

const actualSchema = z.object({
    month: z.number().min(1).max(120),
    year: z.number().min(2000),
    actualSubscribers: z.number().min(0),
    actualRevenue: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
    actualOpex: z.union([z.string(), z.number()]).optional().default(0).transform(v => BigInt(v)),
    manualRecoveryInstallment: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : null),
    manualInvestorShare: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : null),
    manualCompanyShare: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : null),
    manualInvestorProfitSharePercent: z.number().optional().nullable(),
    notes: z.string().optional()
});

export const POST = createHandler({
    auth: true,
    schema: actualSchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id: rabProjectId } = ctx.params;
    const data = ctx.validated!;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:create")) ||
        (await hasPermission("mixradius_expenses:create"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak");
    }

    // Verify RAB exists
    const project = await prisma.rabProject.findUnique({
        where: { id: rabProjectId }
    });

    if (!project) {
        return ApiErrors.notFound("RAB Project");
    }

    const {
        month, year, actualSubscribers, actualRevenue, actualOpex,
        manualRecoveryInstallment, manualInvestorShare, manualCompanyShare,
        manualInvestorProfitSharePercent,
        notes
    } = data;

    // Upsert the achievement for that specific month and year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const achievement = await (prisma.rabActualAchievement.upsert as any)({
        where: {
            rabProjectId_month_year: {
                rabProjectId,
                month,
                year
            }
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
            notes
        },
        update: {
            actualSubscribers,
            actualRevenue,
            actualOpex,
            manualRecoveryInstallment,
            manualInvestorShare,
            manualCompanyShare,
            manualInvestorProfitSharePercent,
            notes
        }
    });

    return apiSuccess({
        ...achievement,
        actualRevenue: achievement.actualRevenue.toString(),
        actualOpex: achievement.actualOpex.toString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manualRecoveryInstallment: (achievement as any).manualRecoveryInstallment?.toString() || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manualInvestorShare: (achievement as any).manualInvestorShare?.toString() || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manualCompanyShare: (achievement as any).manualCompanyShare?.toString() || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manualInvestorProfitSharePercent: (achievement as any).manualInvestorProfitSharePercent
    });
});
