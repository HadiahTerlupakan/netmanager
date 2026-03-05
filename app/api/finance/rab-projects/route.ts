import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { RabItemCategory, RabExpenseType, RabGrowthType, RabPaymentType } from "@prisma/client";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const dynamic = 'force-dynamic';

// Growth settings schemas for different growth types
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
    id: z.string().optional(), // Frontend temp ID
    name: z.string().min(1),
    order: z.number().default(0),
});

const disbursementSchema = z.object({
    id: z.string().optional(), // Frontend temp ID
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    amount: z.union([z.string(), z.number()]).transform(v => BigInt(Math.round(Number(v)))),
    estimatedDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    isPaid: z.boolean().default(false),
});

const itemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().min(1),
    unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(Math.round(Number(v)))),
    category: z.nativeEnum(RabItemCategory).default(RabItemCategory.HARDWARE),
    expenseType: z.nativeEnum(RabExpenseType).default(RabExpenseType.CAPEX),
    expenseCategoryId: z.string().optional(),
    wbsGroupId: z.string().optional(),
    disbursements: z.array(disbursementSchema).default([]),
});

const rabSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    siteId: z.string().optional().nullable(),
    mixRadiusGroupId: z.string().optional().nullable(),
    mixRadiusInvestorSiteId: z.string().optional().nullable(),
    projectedRevenue: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(Math.round(Number(v)))),
    projectedOpex: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(Math.round(Number(v)))),

    // Growth period fields
    targetSubscribers: z.number().optional(),
    arpu: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== "") ? BigInt(Math.round(Number(v))) : undefined),
    growthType: z.nativeEnum(RabGrowthType).default(RabGrowthType.LINEAR),
    paymentType: z.nativeEnum(RabPaymentType).default(RabPaymentType.PREPAID),
    growthSettings: z.union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema]).optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    investmentDurationMonths: z.number().min(1).default(12),
    investmentRecoveryType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
    investmentRecoveryValue: z.number().default(50),
    investorProfitSharePercent: z.number().default(50),

    // Enterprise features
    contingencyPercent: z.number().min(0).max(100).default(0),
    contingencyAmount: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(Math.round(Number(v)))),
    nplTolerancePercent: z.number().min(0).max(100).default(0),
    hasDisbursementPlan: z.boolean().default(false),
    wbsGroups: z.array(wbsSchema).default([]),
    investorIds: z.array(z.string()).optional().default([]),

    items: z.array(itemSchema).default([]),
});

// GET: List RAB Projects
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:read")) ||
        (await hasPermission("mixradius_expenses:read"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read");
    }

    const { searchParams } = req.nextUrl;
    const siteId = searchParams.get("siteId");
    const mixRadiusGroupId = searchParams.get("mixRadiusGroupId");
    const mixRadiusInvestorSiteId = searchParams.get("mixRadiusInvestorSiteId");
    const status = searchParams.get("status");

    const where: Record<string, string> = {};
    if (siteId) where.siteId = siteId;
    if (mixRadiusGroupId) where.mixRadiusGroupId = mixRadiusGroupId;
    if (mixRadiusInvestorSiteId) where.mixRadiusInvestorSiteId = mixRadiusInvestorSiteId;
    if (status) where.status = status;

    const projects = await prisma.rabProject.findMany({
        where,
        include: {
            items: {
                include: {
                    disbursements: true,
                    expenseCategory: {
                        include: {
                            parent: true
                        }
                    }
                }
            },
            wbsGroups: true,
            site: { select: { name: true } },
            investors: true,
            creator: { select: { name: true } },
            approvals: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: {
                                select: { name: true }
                            }
                        }
                    }
                }
            }
        },
    });

    // Serialize BigInt and new fields
    const serialized = projects.map(p => ({
        ...p,
        projectedRevenue: p.projectedRevenue.toString(),
        projectedOpex: p.projectedOpex.toString(),
        arpu: p.arpu?.toString() || null,
        contingencyAmount: p.contingencyAmount?.toString() || "0",
        investors: (p.investors || []).map((i: { investmentAmount: bigint }) => ({
            ...i,
            investmentAmount: i.investmentAmount?.toString() || "0"
        })),
        items: p.items.map(i => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            disbursements: (i.disbursements || []).map((d: any) => ({
                ...d,
                amount: d.amount.toString()
            }))
        }))
    }));

    return apiSuccess(serialized);
});

// POST: Create RAB Project
export const POST = createHandler({
    auth: true,
    schema: rabSchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
        (await hasPermission("expense:create")) ||
        (await hasPermission("mixradius_expenses:create"));

    if (!hasAccess) {
        return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create");
    }

    const {
        name, description, siteId, mixRadiusGroupId, mixRadiusInvestorSiteId,
        projectedRevenue, projectedOpex, items,
        targetSubscribers, arpu, growthType, paymentType, growthSettings, startDate,
        investmentDurationMonths, investmentRecoveryType, investmentRecoveryValue, investorProfitSharePercent,
        contingencyPercent, contingencyAmount, nplTolerancePercent, hasDisbursementPlan, wbsGroups, investorIds
    } = ctx.validated;

    // Calculate item totals - category and expenseType already validated by Zod as proper enums
    // Items mapped but never used
    // Removed unused itemsWithTotal

    const project = await prisma.$transaction(async (tx) => {
        // Create base project
        const p = await tx.rabProject.create({
            data: {
                name,
                description,
                siteId,
                mixRadiusGroupId,
                mixRadiusInvestorSiteId,
                projectedRevenue,
                projectedOpex,
                targetSubscribers,
                arpu,
                growthType,
                paymentType,
                growthSettings: growthSettings || undefined,
                startDate,
                investmentDurationMonths,
                investmentRecoveryType,
                investmentRecoveryValue,
                investorProfitSharePercent,
                contingencyPercent,
                contingencyAmount,
                nplTolerancePercent,
                hasDisbursementPlan,
                createdBy: user.id
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any
        });

        // WBS mapping
        const wbsMap = new Map<string, string>(); // tempId -> dbId
        for (const wbs of wbsGroups) {
            const createdWbs = await tx.rabWbs.create({
                data: {
                    rabProjectId: p.id,
                    name: wbs.name,
                    order: wbs.order,
                }
            });
            if (wbs.id) {
                wbsMap.set(wbs.id, createdWbs.id);
            }
        }

        // Items and their nested disbursements
        if (items.length > 0) {
            for (const item of items) {
                const createdItem = await tx.rabItem.create({
                    data: {
                        rabProjectId: p.id,
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

        if (investorIds && investorIds.length > 0) {
            const totalCapex = items
                .filter(i => i.expenseType === 'CAPEX')
                .reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unitPrice)), 0);

            const splitAmount = Math.floor(totalCapex / investorIds.length);

            await tx.rabInvestor.createMany({
                data: investorIds.map(id => ({
                    rabProjectId: p.id,
                    investorId: id,
                    investmentAmount: splitAmount,
                    profitSharePercent: p.investorProfitSharePercent
                }))
            });
        }

        return tx.rabProject.findUnique({
            where: { id: p.id },
            include: {
                items: { include: { disbursements: true } },
                wbsGroups: true
            }
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = project as any;
    const serialized = {
        ...proj,
        projectedRevenue: proj.projectedRevenue.toString(),
        projectedOpex: proj.projectedOpex.toString(),
        arpu: proj.arpu?.toString() || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (proj.items || []).map((i: any) => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            disbursements: (i.disbursements || []).map((d: any) => ({
                ...d,
                amount: d.amount.toString()
            }))
        })),
        contingencyAmount: proj.contingencyAmount?.toString()
    };

    return apiSuccess(serialized, { status: 201 });
});
