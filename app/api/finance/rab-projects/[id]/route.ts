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

    const project = await prisma.rabProject.findUnique({
        where: { id },
        include: {
            items: true,
            actualAchievements: {
                orderBy: [
                    { year: 'asc' },
                    { month: 'asc' }
                ]
            },
            site: { select: { name: true } },
            mixRadiusGroup: { select: { name: true, owners: true } },
            creator: { select: { name: true } }
        }
    });

    if (!project) {
        return ApiErrors.notFound("Proyek RAB");
    }

    const serialized = {
        ...project,
        projectedRevenue: project.projectedRevenue.toString(),
        projectedOpex: project.projectedOpex.toString(),
        arpu: project.arpu?.toString() || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (project as any).items.map((i: any) => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString()
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
    status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    projectedRevenue: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null) ? BigInt(v) : undefined),
    projectedOpex: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null) ? BigInt(v) : undefined),

    // Growth period fields
    targetSubscribers: z.number().optional(),
    arpu: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null) ? BigInt(v) : undefined),
    growthType: z.nativeEnum(RabGrowthType).optional(),
    paymentType: z.nativeEnum(RabPaymentType).optional(),
    growthSettings: z.union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema]).optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    investmentDurationMonths: z.number().min(1).optional(),
    investmentRecoveryType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
    investmentRecoveryValue: z.number().optional(),
    investorProfitSharePercent: z.number().optional(),

    items: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        quantity: z.number(),
        unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
        category: z.nativeEnum(RabItemCategory),
        expenseType: z.nativeEnum(RabExpenseType).default(RabExpenseType.CAPEX),
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
        name, description, status, siteId, mixRadiusGroupId, projectedRevenue, projectedOpex, items,
        targetSubscribers, arpu, growthType, paymentType, growthSettings, startDate,
        investmentDurationMonths, investmentRecoveryType, investmentRecoveryValue, investorProfitSharePercent
    } = ctx.validated;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (siteId !== undefined) {
        updateData.site = siteId ? { connect: { id: siteId } } : { disconnect: true };
    }

    if (mixRadiusGroupId !== undefined) {
        updateData.mixRadiusGroup = mixRadiusGroupId ? { connect: { id: mixRadiusGroupId } } : { disconnect: true };
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

    if (items) {
        // Calculate totals - category and expenseType already validated by Zod as proper enums
        const itemsWithTotal = items.map(item => ({
            ...item,
            totalPrice: BigInt(item.quantity) * item.unitPrice
        }));

        updateData.items = {
            deleteMany: {}, // Clear existing items
            create: itemsWithTotal // Add new items
        };
    }

    const project = await prisma.rabProject.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: updateData as any,
        include: { items: true }
    });

    const serialized = {
        ...project,
        projectedRevenue: project.projectedRevenue.toString(),
        projectedOpex: project.projectedOpex.toString(),
        arpu: project.arpu?.toString() || null,
        items: project.items.map(i => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString()
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
