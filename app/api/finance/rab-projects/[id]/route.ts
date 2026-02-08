import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { RabItemCategory, RabExpenseType } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper || (await hasPermission("expense:read"));

        if (!hasAccess) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const project = await prisma.rabProject.findUnique({
            where: { id: params.id },
            include: {
                items: true,
                site: { select: { name: true } },
                mixRadiusGroup: { select: { name: true } },
                creator: { select: { name: true } }
            }
        });

        if (!project) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const serialized = {
            ...project,
            projectedRevenue: project.projectedRevenue.toString(),
            projectedOpex: project.projectedOpex.toString(),
            items: project.items.map(i => ({
                ...i,
                unitPrice: i.unitPrice.toString(),
                totalPrice: i.totalPrice.toString()
            }))
        };

        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error fetching RAB project:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

const updateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    projectedRevenue: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : undefined),
    projectedOpex: z.union([z.string(), z.number()]).optional().transform(v => v ? BigInt(v) : undefined),
    // For now, let's assume we might want to update items separately or simply not support deep update here for now unless requested
    // But typically an edit form sends everything.
    // If items are sent, we replace them.
    items: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        quantity: z.number(),
        unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
        category: z.enum(["HARDWARE", "LICENSE", "INSTALLATION", "OTHER", "DEVICE", "CABLE", "ACCESSORIES", "SERVICE", "OPERATIONAL"]),
        expenseType: z.enum(["CAPEX", "OPEX"]).default("CAPEX"),
    })).optional()
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper || (await hasPermission("expense:update"));

        if (!hasAccess) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const validation = updateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid data", details: validation.error.format() }, { status: 400 });
        }

        const { name, description, status, projectedRevenue, projectedOpex, items } = validation.data;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (status) updateData.status = status;
        if (projectedRevenue !== undefined) updateData.projectedRevenue = projectedRevenue;
        if (projectedOpex !== undefined) updateData.projectedOpex = projectedOpex;

        if (items) {
             // Calculate totals
             const itemsWithTotal = items.map(item => ({
                ...item,
                category: item.category as RabItemCategory,
                expenseType: item.expenseType as RabExpenseType,
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
            items: project.items.map(i => ({
                ...i,
                unitPrice: i.unitPrice.toString(),
                totalPrice: i.totalPrice.toString()
            }))
        };

        return NextResponse.json(serialized);

    } catch (error) {
        console.error("Error updating RAB project:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper || (await hasPermission("expense:delete"));

        if (!hasAccess) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const project = await prisma.rabProject.findUnique({
            where: { id: params.id }
        });

        if (!project) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (project.status !== 'DRAFT') {
            return NextResponse.json({ error: "Only DRAFT projects can be deleted" }, { status: 400 });
        }

        await prisma.rabProject.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error deleting RAB project:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
