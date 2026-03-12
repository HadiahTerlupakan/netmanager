import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { RabItemCategory, RabExpenseType, RabGrowthType, RabPaymentType } from "@prisma/client";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const dynamic = 'force-dynamic';

// Growth settings schemas
const linearGrowthSchema = z.object({
    subscribersPerMonth: z.number().min(1),
});

const percentageGrowthSchema = z.object({
    initialPercent: z.number().min(0).max(100),
    monthlyGrowthPercent: z.number().min(0).max(100),
});

const customMilestoneSchema = z.object({
    month: z.number().min(1),
    percent: z.number().min(0).max(100),
});

const customGrowthSchema = z.object({
    milestones: z.array(customMilestoneSchema).min(1),
});

const wbsSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    order: z.number().default(0),
});

const disbursementSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    amount: z.union([z.string(), z.number()]).transform(v => BigInt(Math.round(Number(v)))),
    estimatedDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    isPaid: z.boolean().default(false),
});

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:read")) ||
        (await hasPermission("mixradius_expenses:read"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = await (prisma as any).rabProject.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    disbursements: true
                }
            },
            fundingSources: true,
            wbsGroups: true,
            actualAchievements: {
                orderBy: [
                    { year: 'asc' },
                    { month: 'asc' }
                ]
            },
            site: { select: { name: true } },
            mixRadiusGroup: { select: { name: true, owners: true } },
            mixRadiusInvestorSite: { select: { name: true } },
            creator: { select: { name: true } },
            investors: true,
            revisions: {
                select: {
                    id: true,
                    revisionNumber: true,
                    status: true
                },
                orderBy: { revisionNumber: 'desc' },
                take: 1
            },
            _count: {
                select: {
                    revisions: true
                }
            }
        }
    });

    if (!project) {
        return ApiErrors.notFound("Proyek RAB");
    }

    const { revisions, _count, ...projectData } = project
    const serialized = {
        ...projectData,
        projectedRevenue: project.projectedRevenue.toString(),
        projectedOpex: project.projectedOpex.toString(),
        arpu: project.arpu?.toString() || null,
        contingencyAmount: project.contingencyAmount?.toString() || "0",
        revisionCount: _count?.revisions || 0,
        latestRevision: revisions?.[0] || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: project.items.map((i: any) => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            disbursements: (i.disbursements || []).map((d: any) => ({
                ...d,
                amount: d.amount.toString()
            }))
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actualAchievements: ((project as any).actualAchievements || []).map((a: any) => ({
            ...a,
            actualRevenue: a.actualRevenue.toString(),
            actualOpex: a.actualOpex.toString()
        }))
    };

    return apiSuccess(serialized);
});

const updateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    siteId: z.string().nullable().optional(),
    mixRadiusGroupId: z.string().nullable().optional(),
    mixRadiusInvestorSiteId: z.string().nullable().optional(),
    status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PENGADAAN", "PENGGELARAN_JARINGAN", "PENJUALAN", "TARGET_TERCAPAI", "SELESAI", "CANCELLED"]).optional(),
    projectedRevenue: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== "") ? BigInt(Math.round(Number(v))) : undefined),
    projectedOpex: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== "") ? BigInt(Math.round(Number(v))) : undefined),

    // Growth period fields
    targetSubscribers: z.number().optional(),
    arpu: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== "") ? BigInt(Math.round(Number(v))) : undefined),
    growthType: z.nativeEnum(RabGrowthType).optional(),
    paymentType: z.nativeEnum(RabPaymentType).optional(),
    growthSettings: z.union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema]).optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    investmentDurationMonths: z.number().min(1).optional(),
    investmentRecoveryType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
    investmentRecoveryValue: z.number().optional(),
    investorProfitSharePercent: z.number().optional(),

    // Enterprise features
    contingencyPercent: z.number().min(0).max(100).optional(),
    contingencyAmount: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== "") ? BigInt(Math.round(Number(v))) : undefined),
    nplTolerancePercent: z.number().min(0).max(100).optional(),
    hasDisbursementPlan: z.boolean().optional(),
    wbsGroups: z.array(wbsSchema).optional(),
    investorIds: z.array(z.string()).optional(),

    items: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        quantity: z.number(),
        unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(Math.round(Number(v)))),
        category: z.nativeEnum(RabItemCategory),
        expenseType: z.nativeEnum(RabExpenseType).default(RabExpenseType.CAPEX),
        expenseCategoryId: z.string().optional(),
        wbsGroupId: z.string().optional(),
        disbursements: z.array(disbursementSchema).optional(),
    })).optional()
});

export const PATCH = createHandler({
    auth: true,
    schema: updateSchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:update")) ||
        (await hasPermission("mixradius_expenses:update"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update");
    }

    const {
        name, description, status, siteId, mixRadiusGroupId, mixRadiusInvestorSiteId, projectedRevenue, projectedOpex, items,
        targetSubscribers, arpu, growthType, paymentType, growthSettings, startDate,
        investmentDurationMonths, investmentRecoveryType, investmentRecoveryValue, investorProfitSharePercent,
        contingencyPercent, contingencyAmount, nplTolerancePercent, hasDisbursementPlan, wbsGroups, investorIds
    } = ctx.validated;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (siteId !== undefined) {
        updateData.siteId = siteId;
    }

    if (mixRadiusGroupId !== undefined) {
        updateData.mixRadiusGroupId = mixRadiusGroupId;
    }

    if (mixRadiusInvestorSiteId !== undefined) {
        updateData.mixRadiusInvestorSiteId = mixRadiusInvestorSiteId;
    }

    if (status) updateData.status = status;
    if (projectedRevenue !== undefined) updateData.projectedRevenue = projectedRevenue;
    if (projectedOpex !== undefined) updateData.projectedOpex = projectedOpex;

    // Growth period fields
    if (targetSubscribers !== undefined) updateData.targetSubscribers = targetSubscribers;
    if (arpu !== undefined) updateData.arpu = arpu;
    if (growthType !== undefined) updateData.growthType = growthType;
    if (paymentType !== undefined) updateData.paymentType = paymentType;
    if (growthSettings !== undefined) updateData.growthSettings = growthSettings;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (investmentDurationMonths !== undefined) updateData.investmentDurationMonths = investmentDurationMonths;
    if (investmentRecoveryType !== undefined) updateData.investmentRecoveryType = investmentRecoveryType;
    if (investmentRecoveryValue !== undefined) updateData.investmentRecoveryValue = investmentRecoveryValue;
    if (investorProfitSharePercent !== undefined) updateData.investorProfitSharePercent = investorProfitSharePercent;
    if (contingencyPercent !== undefined) updateData.contingencyPercent = contingencyPercent;
    if (contingencyAmount !== undefined) updateData.contingencyAmount = contingencyAmount;
    if (nplTolerancePercent !== undefined) updateData.nplTolerancePercent = nplTolerancePercent;
    if (hasDisbursementPlan !== undefined) updateData.hasDisbursementPlan = hasDisbursementPlan;

    const project = await prisma.$transaction(async (tx) => {
        // 1. Update basic fields first
        await tx.rabProject.update({
            where: { id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: updateData as any
        });

        // 2. Recreation of Items and WBS if provided (full replace approach for simplicity)
        if (items !== undefined) {
            await tx.rabItem.deleteMany({ where: { rabProjectId: id } });
            await tx.rabWbs.deleteMany({ where: { rabProjectId: id } });

            const wbsMap = new Map<string, string>();
            if (wbsGroups && wbsGroups.length > 0) {
                for (const wbs of wbsGroups) {
                    const createdWbs = await tx.rabWbs.create({
                        data: {
                            rabProjectId: id,
                            name: wbs.name,
                            order: wbs.order,
                        }
                    });
                    if (wbs.id) {
                        wbsMap.set(wbs.id, createdWbs.id);
                    }
                }
            }

            if (items.length > 0) {
                for (const item of items) {
                    const createdItem = await tx.rabItem.create({
                        data: {
                            rabProjectId: id,
                            name: item.name,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            category: item.category,
                            expenseType: item.expenseType,
                            expenseCategoryId: item.expenseCategoryId,
                            totalPrice: BigInt(item.quantity) * item.unitPrice,
                            wbsId: item.wbsGroupId ? wbsMap.get(item.wbsGroupId) : undefined,
                        }
                    });

                    if (item.disbursements && item.disbursements.length > 0) {
                        const disbData = item.disbursements.map(d => ({
                            rabItemId: createdItem.id,
                            name: d.name,
                            percentage: d.percentage,
                            amount: d.amount,
                            estimatedDate: d.estimatedDate,
                            isPaid: d.isPaid,
                        }));
                        await tx.rabDisbursement.createMany({ data: disbData });
                    }
                }
            }
        }

        // 3. Update Investors
        if (investorIds !== undefined) {
            await tx.rabInvestor.deleteMany({ where: { rabProjectId: id } });

            if (investorIds.length > 0) {
                // If investorProfitSharePercent was updated, use it, else get it from existing project
                let currentProfitShare = investorProfitSharePercent;
                if (currentProfitShare === undefined) {
                    const existing = await tx.rabProject.findUnique({ where: { id }, select: { investorProfitSharePercent: true } });
                    currentProfitShare = existing?.investorProfitSharePercent || 50;
                }

                await tx.rabInvestor.createMany({
                    data: investorIds.map(investorId => {
                        const totalCapex = items
                            ? items.filter(i => i.expenseType === 'CAPEX').reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unitPrice)), 0)
                            : 0;
                        const splitAmount = investorIds.length > 0 ? Math.floor(totalCapex / investorIds.length) : 0;

                        return {
                            rabProjectId: id,
                            investorId,
                            investmentAmount: splitAmount,
                            profitSharePercent: currentProfitShare
                        };
                    })
                });
            }
        }

        return tx.rabProject.findUnique({
            where: { id },
            include: {
                items: { include: { disbursements: true } },
                wbsGroups: true
            }
        });
    });

    if (!project) return ApiErrors.notFound("Proyek RAB");

    const serialized = {
        ...project,
        projectedRevenue: project.projectedRevenue.toString(),
        projectedOpex: project.projectedOpex.toString(),
        arpu: project.arpu?.toString() || null,
        contingencyAmount: project.contingencyAmount?.toString() || "0",
        items: project.items.map(i => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            disbursements: ((i as any).disbursements || []).map((d: any) => ({
                ...d,
                amount: d.amount.toString()
            }))
        }))
    };

    return apiSuccess(serialized);
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:delete")) ||
        (await hasPermission("mixradius_expenses:delete"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete");
    }

    const project = await prisma.rabProject.findUnique({
        where: { id }
    });

    if (!project) {
        return ApiErrors.notFound("Proyek RAB");
    }

    if (project.status !== 'DRAFT') {
        return ApiErrors.badRequest("Hanya proyek RAB dengan status DRAFT yang dapat dihapus");
    }

    await prisma.rabProject.delete({
        where: { id }
    });

    return apiSuccess({ success: true });
});
