import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { RabItemCategory, RabExpenseType, RabGrowthType } from "@prisma/client";

export const dynamic = 'force-dynamic';

// GET: List RAB Projects
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:read")) ||
                         (await hasPermission("mixradius_expenses:read"));

        if (!hasAccess) {
             return NextResponse.json({
                 error: "Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read"
             }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
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

        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error fetching RAB projects:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

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
    arpu: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : undefined),
    growthType: z.nativeEnum(RabGrowthType).default(RabGrowthType.LINEAR),
    growthSettings: z.union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema]).optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),

    items: z.array(itemSchema).default([]),
});

// POST: Create RAB Project
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:create")) ||
                         (await hasPermission("mixradius_expenses:create"));

        if (!hasAccess) {
             return NextResponse.json({
                 error: "Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create"
             }, { status: 403 });
        }

        const body = await req.json();
        console.log('[RAB_CREATE] Request body:', JSON.stringify(body, null, 2));

        const validation = rabSchema.safeParse(body);

        if (!validation.success) {
            console.log('[RAB_CREATE] Validation failed:', validation.error.format());
            return NextResponse.json({ error: "Data tidak valid", details: validation.error.format() }, { status: 400 });
        }

        console.log('[RAB_CREATE] Validation passed, items count:', validation.data.items.length);

        const {
            name, description, siteId, mixRadiusGroupId,
            projectedRevenue, projectedOpex, items,
            targetSubscribers, arpu, growthType, growthSettings, startDate
        } = validation.data;

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
                siteId,
                mixRadiusGroupId,
                projectedRevenue,
                projectedOpex,
                targetSubscribers,
                arpu,
                growthType,
                growthSettings: growthSettings || undefined,
                startDate,
                createdBy: session.user.id,
                items: {
                    create: itemsWithTotal
                }
            },
            include: {
                items: true
            }
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

        return NextResponse.json(serialized, { status: 201 });

    } catch (error) {
        console.error("[RAB_CREATE] Error creating RAB project:", error);
        const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
        return NextResponse.json({
            error: "Terjadi kesalahan server",
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 });
    }
}
