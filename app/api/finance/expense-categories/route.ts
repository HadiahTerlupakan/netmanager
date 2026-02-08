import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type"); // CAPEX or OPEX

        const where: { type?: string } = {};
        if (type) {
            where.type = type;
        }

        const categories = await prisma.expenseCategory.findMany({
            where,
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(categories);
    } catch (error) {
        console.error("[EXPENSE_CATEGORIES_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

const createCategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.string().refine(val => ['CAPEX', 'OPEX'].includes(val), "Invalid category type"),
});

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Basic permission check - creating config requires 'expense:create' permission or super admin
        const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'Super Admin';
        const hasAccess = isSuperAdmin ||
                         (await hasPermission("expense:create")) ||
                         (await hasPermission("mixradius_expenses:create"));

        if (!hasAccess) {
             return NextResponse.json({
                 success: false,
                 error: "Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create",
                 code: "FORBIDDEN"
             }, { status: 403 });
        }

        const body = await req.json();
        const validation = createCategorySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { name, type } = validation.data;

        // Check if exists
        const existing = await prisma.expenseCategory.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive'
                },
                type
            }
        });

        if (existing) {
            return NextResponse.json(existing);
        }

        const category = await prisma.expenseCategory.create({
            data: {
                name,
                type
            }
        });

        await logger.logActivity({
            action: 'CREATE',
            subject: 'ExpenseCategory',
            details: { id: category.id, name: category.name, type: category.type },
            userId: user.id
        });

        return NextResponse.json(category);
    } catch (error) {
        console.error("[EXPENSE_CATEGORIES_POST]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
