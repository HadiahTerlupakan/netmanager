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

const itemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().min(1),
    unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
    category: z.nativeEnum(RabItemCategory).default(RabItemCategory.HARDWARE),
    expenseType: z.nativeEnum(RabExpenseType).default(RabExpenseType.CAPEX),
});

const rabSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
    projectedRevenue: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(v)),
    projectedOpex: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(v)),

    // Growth period fields
    targetSubscribers: z.number().optional(),
    arpu: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null) ? BigInt(v) : undefined),
    growthType: z.nativeEnum(RabGrowthType).default(RabGrowthType.LINEAR),
    paymentType: z.nativeEnum(RabPaymentType).default(RabPaymentType.PREPAID),
    growthSettings: z.union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema]).optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    investmentDurationMonths: z.number().min(1).default(12),
    investmentRecoveryType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
    investmentRecoveryValue: z.number().default(50),
    investorProfitSharePercent: z.number().default(50),

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
    const status = searchParams.get("status");

    const where: Record<string, string> = {};
    if (siteId) where.siteId = siteId;
    if (mixRadiusGroupId) where.mixRadiusGroupId = mixRadiusGroupId;
    if (status) where.status = status;

    const projects = await prisma.rabProject.findMany({
        where,
        include: {
            items: true,
            site: { select: { name: true } },
            mixRadiusGroup: { select: { name: true } },
            creator: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Serialize BigInt and new fields
    const serialized = projects.map(p => ({
        ...p,
        projectedRevenue: p.projectedRevenue.toString(),
        projectedOpex: p.projectedOpex.toString(),
        arpu: p.arpu?.toString() || null,
        items: p.items.map(i => ({
            ...i,
            unitPrice: i.unitPrice.toString(),
            totalPrice: i.totalPrice.toString()
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

    // Validation already handled by createHandler + schema
    const {
        name, description, siteId, mixRadiusGroupId,
        projectedRevenue, projectedOpex, items,
        targetSubscribers, arpu, growthType, paymentType, growthSettings, startDate,
        investmentDurationMonths, investmentRecoveryType, investmentRecoveryValue, investorProfitSharePercent
    } = ctx.validated;

    // Calculate item totals - category and expenseType already validated by Zod as proper enums
    const itemsWithTotal = items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        category: item.category,
        expenseType: item.expenseType,
        totalPrice: BigInt(item.quantity) * item.unitPrice
    }));

    const project = await prisma.rabProject.create({
        data: {
            name,
            description,
            site: siteId ? { connect: { id: siteId } } : undefined,
            mixRadiusGroup: mixRadiusGroupId ? { connect: { id: mixRadiusGroupId } } : undefined,
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
            createdBy: user.id,
            items: {
                create: itemsWithTotal
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        include: {
            items: true
        }
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
            totalPrice: i.totalPrice.toString()
        }))
    };

    return apiSuccess(serialized, { status: 201 });
});
