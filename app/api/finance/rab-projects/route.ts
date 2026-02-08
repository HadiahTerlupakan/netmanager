import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { RabItemCategory, RabExpenseType } from "@prisma/client";

export const dynamic = 'force-dynamic';

// GET: List RAB Projects
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper || (await hasPermission("expense:read")); // Reuse expense permission for now

        if (!hasAccess) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const siteId = searchParams.get("siteId");
        const status = searchParams.get("status");

        const where: any = {};
        if (siteId) where.siteId = siteId;
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

        // Serialize BigInt
        const serialized = projects.map(p => ({
            ...p,
            projectedRevenue: p.projectedRevenue.toString(),
            projectedOpex: p.projectedOpex.toString(),
            items: p.items.map(i => ({
                ...i,
                unitPrice: i.unitPrice.toString(),
                totalPrice: i.totalPrice.toString()
            }))
        }));

        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error fetching RAB projects:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

const itemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().min(1),
    unitPrice: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
    category: z.enum(["HARDWARE", "LICENSE", "INSTALLATION", "OTHER", "DEVICE", "CABLE", "ACCESSORIES", "SERVICE", "OPERATIONAL"]).default("HARDWARE"), // Updated enum based on frontend
    expenseType: z.enum(["CAPEX", "OPEX"]).default("CAPEX"),
});

const rabSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
    projectedRevenue: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(v)),
    projectedOpex: z.union([z.string(), z.number()]).default(0).transform(v => BigInt(v)),
    items: z.array(itemSchema).default([]),
});

// POST: Create RAB Project
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isSuper = isSuperAdmin(session.user);
        const hasAccess = isSuper || (await hasPermission("expense:create"));

        if (!hasAccess) {
             return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const validation = rabSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid data", details: validation.error.format() }, { status: 400 });
        }

        const { name, description, siteId, mixRadiusGroupId, projectedRevenue, projectedOpex, items } = validation.data;

        // Calculate item totals and explicit mapping to satisfy Prisma types
        const itemsWithTotal = items.map(item => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            category: item.category as RabItemCategory,
            expenseType: item.expenseType as RabExpenseType,
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
            items: project.items.map(i => ({
                ...i,
                unitPrice: i.unitPrice.toString(),
                totalPrice: i.totalPrice.toString()
            }))
        };

        return NextResponse.json(serialized, { status: 201 });

    } catch (error) {
        console.error("Error creating RAB project:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
