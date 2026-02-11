import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { RabItemCategory, RabExpenseType, RabGrowthType } from "@prisma/client";

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

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
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

        const project = await prisma.rabProject.findUnique({
            where: { id: params.id },
            include: {
                items: true,
                site: { select: { name: true } },
                mixRadiusGroup: { select: { name: true, owners: true } },
                creator: { select: { name: true } }
            }
        });

        if (!project) {
            return NextResponse.json({ error: "Proyek RAB tidak ditemukan" }, { status: 404 });
        }

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

        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error fetching RAB project:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

const updateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    projectedRevenue: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : undefined),
    projectedOpex: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : undefined),

    // Growth period fields
    targetSubscribers: z.number().optional(),
    arpu: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : undefined),
    growthType: z.nativeEnum(RabGrowthType).optional(),
    growthSettings: z.union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema]).optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),

    items: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        quantity: z.number(),
        unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
        category: z.nativeEnum(RabItemCategory),
        expenseType: z.nativeEnum(RabExpenseType).default(RabExpenseType.CAPEX),
    })).optional()
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:update")) ||
                         (await hasPermission("mixradius_expenses:update"));

        if (!hasAccess) {
             return NextResponse.json({
                 error: "Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update"
             }, { status: 403 });
        }

        const body = await req.json();
        const validation = updateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Data tidak valid", details: validation.error.format() }, { status: 400 });
        }

        const {
            name, description, status, projectedRevenue, projectedOpex, items,
            targetSubscribers, arpu, growthType, growthSettings, startDate
        } = validation.data;

        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (status) updateData.status = status;
        if (projectedRevenue !== undefined) updateData.projectedRevenue = projectedRevenue;
        if (projectedOpex !== undefined) updateData.projectedOpex = projectedOpex;

        // Growth period fields
        if (targetSubscribers !== undefined) updateData.targetSubscribers = targetSubscribers;
        if (arpu !== undefined) updateData.arpu = arpu;
        if (growthType !== undefined) updateData.growthType = growthType;
        if (growthSettings !== undefined) updateData.growthSettings = growthSettings;
        if (startDate !== undefined) updateData.startDate = startDate;

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
            where: { id: params.id },
            data: updateData,
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

        return NextResponse.json(serialized);

    } catch (error) {
        console.error("Error updating RAB project:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper ||
                         (await hasPermission("expense:delete")) ||
                         (await hasPermission("mixradius_expenses:delete"));

        if (!hasAccess) {
             return NextResponse.json({
                 error: "Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete"
             }, { status: 403 });
        }

        const project = await prisma.rabProject.findUnique({
            where: { id: params.id }
        });

        if (!project) {
            return NextResponse.json({ error: "Proyek RAB tidak ditemukan" }, { status: 404 });
        }

        if (project.status !== 'DRAFT') {
            return NextResponse.json({ error: "Hanya proyek RAB dengan status DRAFT yang dapat dihapus" }, { status: 400 });
        }

        await prisma.rabProject.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error deleting RAB project:", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
