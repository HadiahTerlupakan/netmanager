import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { toEndOfDay } from '@/lib/utils/datetime'


export const dynamic = 'force-dynamic';

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = req.nextUrl;
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
            end.setTime(toEndOfDay(end).getTime());
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

    return apiSuccess(categoriesWithTotal);
});

const createCategorySchema = z.object({
    name: z.string().min(1, "Nama kategori wajib diisi"),
    type: z.string().refine(val => ['CAPEX', 'OPEX'].includes(val), "Tipe kategori tidak valid (harus CAPEX atau OPEX)"),
    parentId: z.string().optional().nullable(),
});

export const POST = createHandler({ 
    auth: true,
    schema: createCategorySchema 
}, async (req, ctx) => {
    const user = ctx.session!.user;

    // Basic permission check - creating config requires 'expense:create' permission or super admin
    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper ||
                     (await hasPermission("expense:create")) ||
                     (await hasPermission("mixradius_expenses:create"));

    if (!hasAccess) {
         return ApiErrors.forbidden("Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create");
    }

    const { name, type, parentId } = ctx.validated;

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
        return ApiErrors.badRequest(`Kategori "${name}" sudah ada di level ini.`);
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

    return apiSuccess(category);
});
