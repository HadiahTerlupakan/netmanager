import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors, ErrorCodes, apiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Category is required"),
    expenseCategoryId: z.string().optional(),
    description: z.string().optional(),
    siteId: z.string().optional(),
    mixRadiusGroupId: z.string().optional(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    rabProjectId: z.string().optional(),
    rabItemId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceFile: z.string().optional(),
});

export const PUT = createHandler({
    auth: true,
    schema: expenseSchema
}, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!id) return apiError('ID tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

    // Allow SUPER_ADMIN to bypass permission check
    const isSuper = isSuperAdmin(user);

    const hasAccess = isSuper ||
        (await hasPermission("expense:update")) ||
        (await hasPermission("mixradius_expenses:update"));

    if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update');
    }

    const { amount, date, category, expenseCategoryId, description, siteId, mixRadiusGroupId, categoryId, accountId, rabProjectId, rabItemId, invoiceNumber, invoiceFile } = ctx.validated;

    // Build where clause to prevent IDOR
    const where: Prisma.ExpenseWhereUniqueInput = { id };

    // Only restrict by site if user has expense:site_only permission
    const isSiteRestricted = !isSuper && (await hasPermission("expense:site_only", null, { silent: true }));
    if (isSiteRestricted) {
        // Fetch user siteId
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true }
        });
        const userSiteId = dbUser?.siteId;

        if (userSiteId) {
            where.siteId = userSiteId;
        } else {
            // User restricted but has no site -> cannot edit anything
            return ApiErrors.forbidden('Akses terbatas: Site tidak ditemukan di profil anda');
        }
    }

    const updateData: Prisma.ExpenseUpdateInput = {
        amount,
        date,
        category,
        ...(expenseCategoryId !== undefined ? { expenseCategory: expenseCategoryId ? { connect: { id: expenseCategoryId } } : { disconnect: true } } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(mixRadiusGroupId !== undefined ? { mixRadiusGroupId: mixRadiusGroupId || null } : {}),
        ...(categoryId !== undefined ? { categoryId: categoryId || null } : {}),
        ...(accountId !== undefined ? { financialAccount: accountId ? { connect: { id: accountId } } : { disconnect: true } } : {}),
        ...(rabProjectId !== undefined ? { rabProject: rabProjectId ? { connect: { id: rabProjectId } } : { disconnect: true } } : {}),
        ...(rabItemId !== undefined ? { rabItem: rabItemId ? { connect: { id: rabItemId } } : { disconnect: true } } : {}),
        ...(invoiceNumber !== undefined ? { invoiceNumber: invoiceNumber || null } : {}),
        ...(invoiceFile !== undefined ? { invoiceFile: invoiceFile || null } : {}),
    };

    if (isSiteRestricted) {
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true }
        });
        const userSiteId = dbUser?.siteId;
        // Force siteId to be user's siteId
        updateData.site = userSiteId ? { connect: { id: userSiteId } } : undefined;
    } else if (siteId !== undefined) {
        // Admin or user with permission can change siteId freely
        updateData.site = siteId ? { connect: { id: siteId } } : { disconnect: true };
    }

    try {
        const expense = await prisma.expense.update({
            where,
            data: updateData,
            include: {
                user: {
                    select: {
                        name: true
                    }
                },
                expenseCategory: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            }
        });

        return apiSuccess({
            ...expense,
            amount: expense.amount.toString(),
        }, { message: 'Expense berhasil diperbarui' })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return apiError('Pengeluaran tidak ditemukan atau anda tidak memiliki akses', ErrorCodes.NOT_FOUND, { status: 404 });
        }
        throw error; // Let createHandler handle other errors
    }
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!id) return apiError('ID tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

    // Allow SUPER_ADMIN to bypass permission check
    const isSuper = isSuperAdmin(user);

    const hasAccess = isSuper ||
        (await hasPermission("expense:delete")) ||
        (await hasPermission("mixradius_expenses:delete"));

    if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete');
    }

    // Build where clause to prevent IDOR
    const where: Prisma.ExpenseWhereUniqueInput = { id };

    // Only restrict by site if user has expense:site_only permission
    const isSiteRestricted = !isSuper && (await hasPermission("expense:site_only"));
    if (isSiteRestricted) {
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true }
        });
        const userSiteId = dbUser?.siteId;

        if (userSiteId) {
            where.siteId = userSiteId;
        } else {
            return ApiErrors.forbidden('Akses terbatas: Site tidak ditemukan di profil anda');
        }
    }

    // Check if expense exists first
    const existingExpense = await prisma.expense.findUnique({ where });
    if (!existingExpense) {
        return apiError('Pengeluaran tidak ditemukan atau anda tidak memiliki akses', ErrorCodes.NOT_FOUND, { status: 404 });
    }

    const expense = await prisma.expense.delete({
        where,
    });

    return apiSuccess({
        ...expense,
        amount: expense.amount.toString(),
    }, { message: 'Expense berhasil dihapus' })
});
