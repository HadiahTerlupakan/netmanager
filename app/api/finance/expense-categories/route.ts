import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, isSuperAdmin } from "@/lib/auth";
import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type"); // CAPEX or OPEX
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        const where: { type?: string } = {};
        if (type) {
            where.type = type;
        }

        // Build expense filter
        const expenseWhere: { date?: { gte: Date; lte: Date } } = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                // Set end date to end of day
                end.setHours(23, 59, 59, 999);
                expenseWhere.date = {
                    gte: start,
                    lte: end
                };
            }
        }

        const categories = await prisma.expenseCategory.findMany({
            where,
            include: {
                parent: {
                    select: { name: true }
                },
                _count: {
                    select: { children: true }
                },
                expenses: {
                    where: expenseWhere,
                    select: { amount: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Calculate direct total per category
        const categoriesWithTotal = categories.map(cat => {
            const { expenses, ...rest } = cat;
            return {
                ...rest,
                totalDirect: expenses.reduce((sum, e) => sum + Number(e.amount), 0)
            };
        });

        return NextResponse.json(categoriesWithTotal);
    } catch (error) {
        console.error("[EXPENSE_CATEGORIES_GET]", error);
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}

const createCategorySchema = z.object({
    name: z.string().min(1, "Nama kategori wajib diisi"),
    type: z.string().refine(val => ['CAPEX', 'OPEX'].includes(val), "Tipe kategori tidak valid (harus CAPEX atau OPEX)"),
    parentId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

        // Basic permission check - creating config requires 'expense:create' permission or super admin
        const isSuper = isSuperAdmin(user);
        const hasAccess = isSuper ||
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
            return NextResponse.json({ error: "Input tidak valid", details: validation.error.format() }, { status: 400 });
        }

        const { name, type, parentId } = validation.data;

        // Check if exists
        const existing = await prisma.expenseCategory.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive'
                },
                type,
                parentId: parentId || null
            }
        });

        if (existing) {
            return NextResponse.json({
                error: `Kategori "${name}" sudah ada di level ini.`
            }, { status: 400 });
        }

        const category = await prisma.expenseCategory.create({
            data: {
                name,
                type,
                ...(parentId ? { parentId } : {})
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
        return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
